"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  appUrl,
  sendMeetingBookedEmail,
  sendMeetingDeclinedEmail,
  sendMeetingLinkCancelledEmail,
  sendMeetingLinkJoinedEmail,
} from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { getOpenHours, slotFitsOpenHours } from "@/lib/schedule";
import { hashToken, randomToken } from "@/lib/tokens";
import { dateKeyFromParts, formatMeetingWhen, parseClock, parseDateKey, todayKey, WEEKDAYS, zonedDate, zonedParts } from "@/lib/time";

export type HoursState = { error?: string; saved?: boolean };
export type DeclineState = { error?: string; message?: string };
export type LinkState = {
  error?: string;
  startTime?: string;
  endTime?: string;
  participantName?: string;
  title?: string;
};

type HourRange = { weekday: number; startHour: number; endHour: number };

class BookingError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function bookPath(email: string, start: Date, extra: Record<string, string>) {
  const parts = zonedParts(start);
  const params = new URLSearchParams({
    email,
    date: dateKeyFromParts(parts.year, parts.month, parts.day),
    ...extra,
  });
  return `/book?${params.toString()}`;
}

function parseRanges(value: FormDataEntryValue | null): HourRange[] | null {
  if (typeof value !== "string") return null;
  let data: unknown;
  try {
    data = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(data) || data.length > 42) return null;

  const ranges: HourRange[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const weekday = Number(record.weekday);
    const startHour = Number(record.startHour);
    const endHour = Number(record.endHour);
    if (![weekday, startHour, endHour].every(Number.isInteger)) return null;
    if (weekday < 0 || weekday > 6 || startHour < 0 || endHour > 24 || startHour >= endHour) {
      return null;
    }
    ranges.push({ weekday, startHour, endHour });
  }
  return ranges;
}

export async function saveOpenHours(_state: HoursState, formData: FormData): Promise<HoursState> {
  const user = await getCurrentUser();
  if (user.accountType !== "HOST") return { error: "Only a host can set open hours." };

  const ranges = parseRanges(formData.get("ranges"));
  if (!ranges) return { error: "Each block needs an end time after the start." };

  const byDay = new Map<number, HourRange[]>();
  for (const range of ranges) {
    const list = byDay.get(range.weekday) ?? [];
    list.push(range);
    byDay.set(range.weekday, list);
  }
  for (const [weekday, list] of byDay) {
    list.sort((a, b) => a.startHour - b.startHour);
    for (let index = 1; index < list.length; index += 1) {
      if (list[index].startHour < list[index - 1].endHour) {
        const name = WEEKDAYS.find((day) => day.value === weekday)?.name ?? "That day";
        return { error: `${name} has overlapping hours. Separate them or remove one.` };
      }
    }
  }

  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { hostId: user.id } }),
    ...(ranges.length
      ? [
          prisma.availability.createMany({
            data: ranges.map((range) => ({ hostId: user.id, ...range })),
          }),
        ]
      : []),
    prisma.user.update({ where: { id: user.id }, data: { hoursReady: true } }),
  ]);

  revalidatePath("/home");
  revalidatePath("/book");
  return { saved: true };
}

export async function bookMeeting(formData: FormData) {
  const user = await getCurrentUser();
  const email = String(formData.get("hostEmail") ?? "").trim().toLowerCase();
  const start = new Date(String(formData.get("start") ?? ""));
  const fallback = `/book?email=${encodeURIComponent(email)}`;

  if (user.accountType !== "PARTICIPANT") redirect("/home");
  if (Number.isNaN(start.getTime())) redirect(`${fallback}&error=closed`);

  try {
    const host = await prisma.user.findUnique({ where: { email } });
    if (!host || host.accountType !== "HOST" || !host.emailVerifiedAt) {
      throw new BookingError("host");
    }

    const end = new Date(start.getTime() + 60 * 60 * 1000);
    if (end.getTime() <= Date.now()) throw new BookingError("past");

    const hostMeeting = await prisma.meeting.findFirst({
      where: { hostId: host.id, status: "SCHEDULED", startAt: { lt: end }, endAt: { gt: start } },
    });
    const hostLink = await prisma.meetingLink.findFirst({
      where: { hostId: host.id, status: "SCHEDULED", startAt: { lt: end }, endAt: { gt: start } },
    });
    if (hostMeeting || hostLink) throw new BookingError("taken");

    const windows = await getOpenHours(host.id);
    if (!slotFitsOpenHours(windows, start)) throw new BookingError("closed");

    const participantClash = await prisma.meeting.findFirst({
      where: {
        participantId: user.id,
        status: "SCHEDULED",
        startAt: { lt: end },
        endAt: { gt: start },
      },
    });
    const guestClash = await prisma.meetingLinkGuest.findFirst({
      where: {
        participantId: user.id,
        meetingLink: { status: "SCHEDULED", startAt: { lt: end }, endAt: { gt: start } },
      },
    });
    if (participantClash || guestClash) throw new BookingError("overlap");

    const token = randomToken();
    const meeting = await prisma.$transaction(async (tx) => {
      const clash = await tx.meeting.findFirst({
        where: {
          hostId: host.id,
          status: "SCHEDULED",
          startAt: { lt: end },
          endAt: { gt: start },
        },
      });
      const linkClash = await tx.meetingLink.findFirst({
        where: {
          hostId: host.id,
          status: "SCHEDULED",
          startAt: { lt: end },
          endAt: { gt: start },
        },
      });
      if (clash || linkClash) throw new BookingError("taken");

      return tx.meeting.create({
        data: {
          hostId: host.id,
          participantId: user.id,
          startAt: start,
          endAt: end,
          status: "SCHEDULED",
          declineTokenHash: hashToken(token),
        },
      });
    });

    try {
      await sendMeetingBookedEmail({
        host: { id: host.id, name: host.name, email: host.email },
        participant: { id: user.id, name: user.name, email: user.email },
        when: formatMeetingWhen(start),
        declineUrl: `${appUrl()}/meetings/decline?token=${encodeURIComponent(token)}`,
        callUrl: `${appUrl()}/meetings/${meeting.id}/call`,
      });
    } catch (error) {
      await prisma.meeting.delete({ where: { id: meeting.id } });
      throw error;
    }
  } catch (error) {
    unstable_rethrow(error);
    const code = error instanceof BookingError ? error.code : "mail";
    redirect(bookPath(email, start, { error: code }));
  }

  revalidatePath("/home");
  revalidatePath("/book");
  redirect(bookPath(email, start, { booked: "1" }));
}

async function declineMeeting(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { host: true, participant: true },
  });
  if (!meeting) return { missing: true as const };
  if (meeting.status === "DECLINED") return { already: true as const, meeting };

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: "DECLINED" },
  });

  try {
    await sendMeetingDeclinedEmail({
      host: { id: meeting.host.id, name: meeting.host.name, email: meeting.host.email },
      participant: {
        id: meeting.participant.id,
        name: meeting.participant.name,
        email: meeting.participant.email,
      },
      when: formatMeetingWhen(meeting.startAt),
      rebookUrl: `${appUrl()}/book?email=${encodeURIComponent(meeting.host.email)}`,
    });
  } catch (error) {
    unstable_rethrow(error);
    revalidatePath("/home");
    revalidatePath("/book");
    return { mailed: false as const, meeting };
  }

  revalidatePath("/home");
  revalidatePath("/book");
  return { mailed: true as const, meeting };
}

export async function declineAsHost(formData: FormData) {
  const user = await getCurrentUser();
  const meetingId = String(formData.get("meetingId") ?? "");
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, hostId: user.id },
  });
  if (!meeting) redirect("/home");

  const result = await declineMeeting(meeting.id);
  redirect(result && "mailed" in result && result.mailed === false ? "/home?notice=mail" : "/home");
}

export async function declineByToken(_state: DeclineState, formData: FormData): Promise<DeclineState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "This link is not valid." };

  const meeting = await prisma.meeting.findUnique({
    where: { declineTokenHash: hashToken(token) },
  });
  if (!meeting) return { error: "This link is not valid." };

  try {
    const result = await declineMeeting(meeting.id);
    if ("already" in result && result.already) {
      return { message: "You already marked this time as not possible." };
    }
    if ("mailed" in result && result.mailed === false) {
      return {
        error: "This time is open again, but the email to the participant could not be sent.",
      };
    }
    if (!("meeting" in result) || !result.meeting) {
      return { error: "This link is not valid." };
    }
    return {
      message: `${result.meeting.participant.name} has been emailed that you are not available at this time. The hour is open again.`,
    };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "We couldn't update this meeting. Try again." };
  }
}

export async function createMeetingLink(_state: LinkState, formData: FormData): Promise<LinkState> {
  const user = await getCurrentUser();
  if (user.accountType !== "HOST") return { error: "Only a host can create a meeting link." };

  const title = String(formData.get("title") ?? "").trim();
  const participantName = String(formData.get("participantName") ?? "").trim();
  const capacity = Number(formData.get("capacity"));
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const typed = { startTime, endTime, participantName, title };
  if (participantName.length < 2 || participantName.length > 80) {
    return { error: "Write the participant's name.", ...typed };
  }
  if (title.length < 2 || title.length > 80) return { error: "Give the meeting a short name.", ...typed };
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
    return { error: "Choose between 1 and 50 participants.", ...typed };
  }

  const date = parseDateKey(String(formData.get("date") ?? ""));
  const startClock = parseClock(startTime);
  const endClock = parseClock(endTime);
  if (!date || date < todayKey()) return { error: "Choose a day that has not passed.", ...typed };
  if (!startClock || !endClock) {
    return { error: "Write the times like 10:10 PM and 11:10 PM.", ...typed };
  }

  const [year, month, day] = date.split("-").map(Number);
  const start = zonedDate(year, month, day, startClock.hour, startClock.minute);
  const end = zonedDate(year, month, day, endClock.hour, endClock.minute);
  if (end.getTime() <= start.getTime()) {
    return { error: "The end time has to be later than the start, on the same day.", ...typed };
  }
  if (end.getTime() - start.getTime() > 8 * 60 * 60 * 1000) {
    return { error: "A meeting link can cover up to 8 hours.", ...typed };
  }
  if (end.getTime() <= Date.now()) return { error: "That time has already passed.", ...typed };

  const code = randomToken();
  try {
    await prisma.$transaction(async (tx) => {
      const clash = await tx.meeting.findFirst({
        where: { hostId: user.id, status: "SCHEDULED", startAt: { lt: end }, endAt: { gt: start } },
      });
      const linkClash = await tx.meetingLink.findFirst({
        where: { hostId: user.id, status: "SCHEDULED", startAt: { lt: end }, endAt: { gt: start } },
      });
      if (clash || linkClash) throw new BookingError("taken");

      await tx.meetingLink.create({
        data: {
          hostId: user.id,
          code,
          title,
          participantName,
          startAt: start,
          endAt: end,
          capacity,
          status: "SCHEDULED",
        },
      });
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof BookingError) return { error: "That time is already booked.", ...typed };
    return { error: "The link could not be created. Try again.", ...typed };
  }

  revalidatePath("/home");
  revalidatePath("/book");
  revalidatePath("/links/new");
  redirect(`/home?link=${encodeURIComponent(code)}`);
}

export async function cancelMeetingLink(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("linkId") ?? "");
  const link = await prisma.meetingLink.findFirst({
    where: { id, hostId: user.id },
    include: { host: true, guests: { include: { participant: true } } },
  });
  if (!link || link.status === "CANCELLED") redirect("/home");

  await prisma.meetingLink.update({
    where: { id: link.id },
    data: { status: "CANCELLED" },
  });

  let failed = false;
  for (const guest of link.guests) {
    try {
      await sendMeetingLinkCancelledEmail({
        host: { id: link.host.id, name: link.host.name, email: link.host.email },
        participant: {
          id: guest.participant.id,
          name: guest.participant.name,
          email: guest.participant.email,
        },
        title: link.title,
        when: formatMeetingWhen(link.startAt, link.endAt),
      });
    } catch (error) {
      unstable_rethrow(error);
      failed = true;
    }
  }

  revalidatePath("/home");
  revalidatePath("/book");
  revalidatePath(`/m/${link.code}`);
  redirect(failed ? "/home?notice=cancel-mail" : "/home");
}

export async function joinMeetingLink(formData: FormData) {
  const user = await getCurrentUser();
  const code = String(formData.get("code") ?? "");
  const back = `/m/${encodeURIComponent(code)}`;
  if (user.accountType !== "PARTICIPANT") redirect(`${back}?error=account`);

  try {
    const link = await prisma.meetingLink.findUnique({
      where: { code },
      include: { host: true, guests: true },
    });
    if (!link) redirect(`${back}?error=missing`);
    if (link.status === "CANCELLED") redirect(`${back}?error=cancelled`);
    if (link.endAt.getTime() <= Date.now()) redirect(`${back}?error=past`);
    if (link.guests.some((guest) => guest.participantId === user.id)) redirect(`${back}?joined=1`);

    const meetingClash = await prisma.meeting.findFirst({
      where: {
        participantId: user.id,
        status: "SCHEDULED",
        startAt: { lt: link.endAt },
        endAt: { gt: link.startAt },
      },
    });
    const guestClash = await prisma.meetingLinkGuest.findFirst({
      where: {
        participantId: user.id,
        meetingLink: {
          status: "SCHEDULED",
          id: { not: link.id },
          startAt: { lt: link.endAt },
          endAt: { gt: link.startAt },
        },
      },
    });
    if (meetingClash || guestClash) throw new BookingError("overlap");

    const joined = await prisma.$transaction(async (tx) => {
      const current = await tx.meetingLink.findUnique({
        where: { id: link.id },
        include: { _count: { select: { guests: true } } },
      });
      if (!current || current.status !== "SCHEDULED") throw new BookingError("cancelled");
      if (current._count.guests >= current.capacity) throw new BookingError("full");
      await tx.meetingLinkGuest.create({
        data: { meetingLinkId: link.id, participantId: user.id },
      });
      return current._count.guests + 1;
    });

    try {
      await sendMeetingLinkJoinedEmail({
        host: { id: link.host.id, name: link.host.name, email: link.host.email },
        participant: { id: user.id, name: user.name, email: user.email },
        title: link.title,
        when: formatMeetingWhen(link.startAt, link.endAt),
        spots: `${joined} of ${link.capacity}`,
      });
    } catch (error) {
      unstable_rethrow(error);
      revalidatePath("/home");
      revalidatePath(`/m/${code}`);
      redirect(`${back}?joined=1&notice=mail`);
    }
  } catch (error) {
    unstable_rethrow(error);
    const reason = error instanceof BookingError ? error.code : "error";
    redirect(`${back}?error=${reason}`);
  }

  revalidatePath("/home");
  revalidatePath("/book");
  revalidatePath(`/m/${code}`);
  redirect(`${back}?joined=1`);
}
