import "server-only";

import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { sendMeetingLinkJoinedEmail } from "@/lib/email";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatMeetingWhen } from "@/lib/time";

export const CALL_LIMIT = 8;
const STALE_MS = 12_000;

export async function loadCallRoom(code: string) {
  const user = await getOptionalUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/m/${code}/call`)}`);
  if (!user.emailVerifiedAt) {
    redirect(`/check-email?email=${encodeURIComponent(user.email)}`);
  }

  const link = await prisma.meetingLink.findUnique({
    where: { code },
    include: { host: true, guests: true },
  });
  if (!link) return { ok: false as const, message: "This link is not valid." };
  if (link.status !== "SCHEDULED") {
    return { ok: false as const, message: "This meeting was cancelled." };
  }
  if (user.id === link.hostId) {
    return {
      ok: true as const,
      title: link.title,
      name: user.name,
      role: "host" as const,
      startsAt: link.startAt.toISOString(),
    };
  }
  if (user.accountType !== "PARTICIPANT") {
    return {
      ok: false as const,
      message: "Participants join this call. Hosts share the link.",
    };
  }

  const already = link.guests.some((guest) => guest.participantId === user.id);
  if (!already) {
    const added = await addGuest(user, link);
    if (!added.ok) return added;
  }

  return {
    ok: true as const,
    title: link.title,
    name: user.name,
    role: "participant" as const,
    startsAt: link.startAt.toISOString(),
  };
}

async function addGuest(
  user: { id: string; name: string; email: string },
  link: {
    id: string;
    code: string;
    title: string;
    startAt: Date;
    endAt: Date;
    capacity: number;
    host: { id: string; name: string; email: string };
  },
) {
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
  if (meetingClash || guestClash) {
    return { ok: false as const, message: "You already have a meeting at this time." };
  }

  try {
    const joined = await prisma.$transaction(async (tx) => {
      const current = await tx.meetingLink.findUnique({
        where: { id: link.id },
        include: { _count: { select: { guests: true } } },
      });
      if (!current || current.status !== "SCHEDULED") {
        throw new Error("cancelled");
      }
      if (current._count.guests >= current.capacity) throw new Error("full");
      await tx.meetingLinkGuest.create({
        data: { meetingLinkId: link.id, participantId: user.id },
      });
      return current._count.guests + 1;
    });

    try {
      await sendMeetingLinkJoinedEmail({
        host: link.host,
        participant: user,
        title: link.title,
        when: formatMeetingWhen(link.startAt, link.endAt),
        spots: `${joined} of ${link.capacity}`,
      });
    } catch {
      // The seat is saved even when the notice email fails.
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: true as const };
    }
    if (error instanceof Error && error.message === "full") {
      return { ok: false as const, message: "This meeting is full." };
    }
    if (error instanceof Error && error.message === "cancelled") {
      return { ok: false as const, message: "This meeting was cancelled." };
    }
    throw error;
  }

  return { ok: true as const };
}

export async function callMember(code: string) {
  const user = await getOptionalUser();
  if (!user?.emailVerifiedAt) return null;

  const link = await prisma.meetingLink.findUnique({
    where: { code },
    include: { guests: { select: { participantId: true } } },
  });
  if (link) {
    if (link.status !== "SCHEDULED") return null;
    const allowed =
      link.hostId === user.id || link.guests.some((guest) => guest.participantId === user.id);
    if (!allowed) return null;
    return { user, hostId: link.hostId };
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: code } });
  if (!meeting || meeting.status !== "SCHEDULED") return null;
  if (meeting.hostId !== user.id && meeting.participantId !== user.id) return null;
  return { user, hostId: meeting.hostId };
}

export async function freshPeers(roomCode: string) {
  const cutoff = new Date(Date.now() - STALE_MS);
  await prisma.callPresence.deleteMany({
    where: { roomCode, lastSeen: { lt: cutoff } },
  });
  return prisma.callPresence.findMany({
    where: { roomCode },
    select: { peerId: true, name: true, userId: true },
    orderBy: { lastSeen: "asc" },
  });
}
