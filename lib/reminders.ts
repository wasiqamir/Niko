import "server-only";

import { appUrl, sendMeetingReminderEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { formatMeetingWhen } from "@/lib/time";

const LEAD_MS = 2 * 60 * 1000;
const LATE_MS = 60 * 1000;

function nameList(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function startReminderLoop() {
  const state = globalThis as { nikoReminderLoop?: boolean };
  if (state.nikoReminderLoop) return;
  state.nikoReminderLoop = true;

  const tick = () => {
    void sendDueReminders().catch((error) => {
      console.error("Meeting reminder check failed", error);
    });
  };
  tick();
  setInterval(tick, 15_000);
}

export async function sendDueReminders(now = new Date()) {
  const earliest = new Date(now.getTime() - LATE_MS);
  const latest = new Date(now.getTime() + LEAD_MS);

  const meetings = await prisma.meeting.findMany({
    where: {
      status: "SCHEDULED",
      reminderSentAt: null,
      startAt: { gt: earliest, lte: latest },
    },
    include: { host: true, participant: true },
  });

  for (const meeting of meetings) {
    const claimed = await prisma.meeting.updateMany({
      where: { id: meeting.id, reminderSentAt: null, status: "SCHEDULED" },
      data: { reminderSentAt: new Date() },
    });
    if (claimed.count !== 1) continue;

    const when = formatMeetingWhen(meeting.startAt);
    const callUrl = `${appUrl()}/meetings/${meeting.id}/call`;
    const sent = await deliverPair([
      {
        to: meeting.host,
        withName: meeting.participant.name,
        when,
        callUrl,
      },
      {
        to: meeting.participant,
        withName: meeting.host.name,
        when,
        callUrl,
      },
    ]);
    if (sent === 0) {
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { reminderSentAt: null },
      });
    }
  }

  const links = await prisma.meetingLink.findMany({
    where: {
      status: "SCHEDULED",
      reminderSentAt: null,
      startAt: { gt: earliest, lte: latest },
    },
    include: {
      host: true,
      guests: { include: { participant: true } },
    },
  });

  for (const link of links) {
    const claimed = await prisma.meetingLink.updateMany({
      where: { id: link.id, reminderSentAt: null, status: "SCHEDULED" },
      data: { reminderSentAt: new Date() },
    });
    if (claimed.count !== 1) continue;

    const when = formatMeetingWhen(link.startAt, link.endAt);
    const callUrl = `${appUrl()}/m/${link.code}/call`;
    const guestNames = link.guests.map((guest) => guest.participant.name);
    const sent = await deliverPair([
      {
        to: link.host,
        withName: guestNames.length > 0 ? nameList(guestNames) : link.title,
        when,
        callUrl,
      },
      ...link.guests.map((guest) => ({
        to: guest.participant,
        withName: link.host.name,
        when,
        callUrl,
      })),
    ]);
    if (sent === 0) {
      await prisma.meetingLink.update({
        where: { id: link.id },
        data: { reminderSentAt: null },
      });
    }
  }
}

async function deliverPair(
  messages: { to: { id: string; name: string; email: string }; withName: string; when: string; callUrl: string }[],
) {
  let sent = 0;
  for (const message of messages) {
    try {
      await sendMeetingReminderEmail(message);
      sent += 1;
    } catch (error) {
      console.error("Meeting reminder email failed", error);
    }
  }
  return sent;
}
