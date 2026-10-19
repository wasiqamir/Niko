import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AccountHeader } from "@/components/account-header";
import { MeetingCalendar, type CalendarEvent } from "@/components/meeting-calendar";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  dateKeyFromParts,
  formatSpan,
  shiftMonth,
  slotStart,
  todayKey,
  zonedParts,
} from "@/lib/time";

export const metadata = {
  title: "Create a meeting link",
};

export default function NewLinkPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5">
      <AccountHeader />
      <main className="flex-1 py-6">
        <Suspense fallback={<div className="h-80 rounded-3xl bg-line/60" />}>
          <Planner />
        </Suspense>
      </main>
    </div>
  );
}

async function Planner() {
  await connection();
  const user = await getCurrentUser();
  if (user.accountType !== "HOST") {
    return (
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Links are for hosts</h1>
        <Link href="/home" className="mt-6 inline-block text-sm font-medium underline underline-offset-4">
          Back home
        </Link>
      </div>
    );
  }

  const today = todayKey();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const start = slotStart(dateKeyFromParts(year, month, 1), 0);
  const last = shiftMonth(year, month, 12);
  const end = slotStart(dateKeyFromParts(last.year, last.month, 1), 0);
  const [meetings, links, teamMeetings] = await Promise.all([
    prisma.meeting.findMany({
      where: { hostId: user.id, status: "SCHEDULED", startAt: { gte: start, lt: end } },
      include: { participant: { select: { name: true } } },
      orderBy: { startAt: "asc" },
    }),
    prisma.meetingLink.findMany({
      where: { hostId: user.id, status: "SCHEDULED", startAt: { gte: start, lt: end } },
      orderBy: { startAt: "asc" },
    }),
    prisma.teamMeeting.findMany({
      where: {
        status: "SCHEDULED",
        startAt: { gte: start, lt: end },
        team: {
          OR: [{ ownerId: user.id }, { members: { some: { userId: user.id, status: "ACTIVE" } } }],
        },
      },
      include: { team: { select: { name: true } } },
      orderBy: { startAt: "asc" },
    }),
  ]);

  const events: CalendarEvent[] = [
    ...meetings.map((meeting) => ({
      id: meeting.id,
      date: dateKey(meeting.startAt),
      time: formatSpan(meeting.startAt, meeting.endAt),
      title: meeting.participant.name,
    })),
    ...links.map((link) => ({
      id: link.id,
      date: dateKey(link.startAt),
      time: formatSpan(link.startAt, link.endAt),
      title: link.participantName ? `${link.participantName} · ${link.title}` : link.title,
    })),
    ...teamMeetings.map((meeting) => ({
      id: meeting.id,
      date: dateKey(meeting.startAt),
      time: formatSpan(meeting.startAt, meeting.endAt),
      title: meeting.team.name,
    })),
  ];

  return (
    <div>
      <p className="rise text-xs uppercase tracking-[0.22em] text-accent">New meeting</p>
      <h1 className="rise rise-2 mt-3 font-serif text-4xl tracking-tight sm:text-6xl">Choose a date.</h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-muted">
        The calendar shows the meetings already held. Click a date, then fill in the time, the
        participant, and the meeting.
      </p>
      <div className="mt-8">
        <MeetingCalendar today={today} events={events} />
      </div>
    </div>
  );
}

function dateKey(date: Date) {
  const parts = zonedParts(date);
  return dateKeyFromParts(parts.year, parts.month, parts.day);
}
