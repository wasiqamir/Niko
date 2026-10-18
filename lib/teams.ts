import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { appUrl, sendTeamInviteEmail, sendTeamScheduledEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { hashToken, randomToken } from "@/lib/tokens";
import { formatMeetingWhen, slotStart, todayKey, weekdayOfKey } from "@/lib/time";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

type Db = Prisma.TransactionClient | typeof prisma;

export async function teamOverlap(db: Db, userId: string, start: Date, end: Date) {
  return db.teamMeeting.findFirst({
    where: {
      status: "SCHEDULED",
      startAt: { lt: end },
      endAt: { gt: start },
      team: {
        OR: [{ ownerId: userId }, { members: { some: { userId, status: "ACTIVE" } } }],
      },
    },
    select: { id: true },
  });
}

export async function activateTeamAfterVerify(userId: string) {
  const team = await prisma.team.findUnique({
    where: { ownerId: userId },
    include: { owner: true, members: true },
  });
  if (!team || team.status !== "PENDING") return;

  await prisma.team.update({ where: { id: team.id }, data: { status: "ACTIVE" } });

  for (const member of team.members) {
    try {
      await sendMemberInvite(team.id, team.name, team.owner.name, member.id, member.name, member.email);
    } catch (error) {
      console.error("Team invite email failed", error);
    }
  }
}

export async function resendMemberInvite(ownerId: string, memberId: string) {
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, status: "PENDING", team: { ownerId, status: "ACTIVE" } },
    include: { team: { include: { owner: true } } },
  });
  if (!member) return { error: "That invite is no longer waiting." };
  if (member.invitedAt && Date.now() - member.invitedAt.getTime() < 60_000) {
    return { error: "Wait a minute before sending that invite again." };
  }

  await sendMemberInvite(
    member.teamId,
    member.team.name,
    member.team.owner.name,
    member.id,
    member.name,
    member.email,
  );
  return { error: undefined };
}

async function sendMemberInvite(
  teamId: string,
  teamName: string,
  ownerName: string,
  memberId: string,
  name: string,
  email: string,
) {
  const token = randomToken();
  await prisma.teamMember.update({
    where: { id: memberId, teamId },
    data: {
      inviteTokenHash: hashToken(token),
      inviteExpiresAt: new Date(Date.now() + WEEK_MS),
      invitedAt: new Date(),
    },
  });

  const link = `${appUrl()}/teams/join?token=${encodeURIComponent(token)}`;
  await sendTeamInviteEmail({
    to: email,
    name,
    ownerName,
    teamName,
    link,
  });
}

export async function arrangeToday(ownerId: string) {
  const team = await prisma.team.findUnique({
    where: { ownerId },
    include: {
      owner: true,
      members: { include: { user: true } },
    },
  });
  if (!team || team.status !== "ACTIVE") return { error: "Create and confirm a team before arranging a meeting." };

  const now = new Date();
  const day = todayKey(now);
  const dayStart = slotStart(day, 0);
  const dayEnd = slotStart(day, 24);
  const existing = await prisma.teamMeeting.findFirst({
    where: {
      teamId: team.id,
      status: "SCHEDULED",
      startAt: { gte: dayStart, lt: dayEnd },
      endAt: { gt: now },
    },
  });
  if (existing) return { error: "Today's team meeting is already set." };

  const pending = team.members.filter((member) => member.status !== "ACTIVE" || !member.user);
  if (pending.length > 0) {
    return { error: `Waiting for ${names(pending.map((member) => member.name))} to join the team.` };
  }

  const people = [team.owner, ...team.members.map((member) => member.user!)];
  const unscheduled = people.filter((person) => !person.hoursReady);
  if (unscheduled.length > 0) {
    return { error: `${names(unscheduled.map((person) => person.name))} still need to set their schedule.` };
  }

  const slot = await findOpenHour(people.map((person) => person.id), day, now);
  if (!slot) return { error: "No time today fits everyone's schedule." };

  const meeting = await prisma.$transaction(async (tx) => {
    for (const person of people) {
      const busy = await personBusy(tx, person.id, slot.start, slot.end);
      if (busy) throw new Error("taken");
    }
    return tx.teamMeeting.create({
      data: { teamId: team.id, startAt: slot.start, endAt: slot.end, status: "SCHEDULED" },
    });
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "taken") return null;
    throw error;
  });

  if (!meeting) return { error: "That time was just taken. Try again." };

  const when = formatMeetingWhen(meeting.startAt, meeting.endAt);
  let failed = 0;
  for (const person of people) {
    try {
      await sendTeamScheduledEmail({ to: person, teamName: team.name, when });
    } catch (error) {
      failed += 1;
      console.error("Team schedule email failed", error);
    }
  }

  return { error: undefined, mailed: failed === 0 };
}

async function findOpenHour(userIds: string[], day: string, now: Date) {
  const weekday = weekdayOfKey(day);
  let shared: Set<number> | null = null;

  for (const userId of userIds) {
    const windows = await prisma.availability.findMany({
      where: { hostId: userId, weekday },
    });
    const hours = new Set<number>();
    for (const window of windows) {
      for (let hour = window.startHour; hour < window.endHour; hour += 1) hours.add(hour);
    }
    if (shared === null) {
      shared = hours;
    } else {
      const next = new Set<number>();
      for (const hour of shared) {
        if (hours.has(hour)) next.add(hour);
      }
      shared = next;
    }
  }

  if (!shared) return null;

  for (const hour of [...shared].sort((a, b) => a - b)) {
    const start = slotStart(day, hour);
    const end = new Date(start.getTime() + HOUR_MS);
    if (start.getTime() <= now.getTime()) continue;
    const busy = await Promise.all(userIds.map((userId) => personBusy(prisma, userId, start, end)));
    if (busy.every((taken) => !taken)) return { start, end };
  }

  return null;
}

async function personBusy(db: Db, userId: string, start: Date, end: Date) {
  const [meeting, link, guest, team] = await Promise.all([
    db.meeting.findFirst({
      where: {
        status: "SCHEDULED",
        startAt: { lt: end },
        endAt: { gt: start },
        OR: [{ hostId: userId }, { participantId: userId }],
      },
      select: { id: true },
    }),
    db.meetingLink.findFirst({
      where: { hostId: userId, status: "SCHEDULED", startAt: { lt: end }, endAt: { gt: start } },
      select: { id: true },
    }),
    db.meetingLinkGuest.findFirst({
      where: {
        participantId: userId,
        meetingLink: { status: "SCHEDULED", startAt: { lt: end }, endAt: { gt: start } },
      },
      select: { id: true },
    }),
    teamOverlap(db, userId, start, end),
  ]);

  return Boolean(meeting || link || guest || team);
}

function names(list: string[]) {
  if (list.length <= 1) return list[0] ?? "Someone";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}
