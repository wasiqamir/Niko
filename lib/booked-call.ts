import "server-only";

import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function loadBookedCall(meetingId: string) {
  const user = await getOptionalUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/meetings/${meetingId}/call`)}`);
  if (!user.emailVerifiedAt) {
    redirect(`/check-email?email=${encodeURIComponent(user.email)}`);
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      host: { select: { id: true, name: true } },
      participant: { select: { id: true, name: true } },
    },
  });
  if (!meeting) return { ok: false as const, message: "This meeting was not found." };
  if (meeting.status !== "SCHEDULED") {
    return { ok: false as const, message: "This meeting is closed." };
  }
  const onIt = user.id === meeting.hostId || user.id === meeting.participantId;
  if (!onIt) {
    return { ok: false as const, message: "This call is for the people on this meeting." };
  }

  const other = user.id === meeting.hostId ? meeting.participant : meeting.host;
  return {
    ok: true as const,
    title: `Meeting with ${other.name}`,
    name: user.name,
    role: user.id === meeting.hostId ? ("host" as const) : ("participant" as const),
    startsAt: meeting.startAt.toISOString(),
  };
}
