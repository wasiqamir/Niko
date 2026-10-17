import { Suspense } from "react";
import { AccountHeader } from "@/components/account-header";
import { HostDashboard } from "@/components/host-dashboard";
import { HostSearchForm } from "@/components/host-search-form";
import { MeetingList, type MeetingCard } from "@/components/meeting-list";
import { accountOption } from "@/lib/accounts";
import { getCurrentUser } from "@/lib/auth";
import { appUrl } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { getOpenHours } from "@/lib/schedule";

export const metadata = {
  title: "Your account",
};

export default function AccountHomePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5">
      <AccountHeader />
      <main className="flex-1 py-6">
        <Suspense fallback={<div className="h-64 rounded-3xl bg-line/60" />}>
          <AccountHome searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function AccountHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const notice = one(params.notice);
  const linkCode = one(params.link);
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const now = new Date();

  if (user.accountType === "HOST") {
    const [windows, meetings, links, fresh] = await Promise.all([
      getOpenHours(user.id),
      prisma.meeting.findMany({
        where: { hostId: user.id },
        include: { participant: { select: { name: true, email: true } } },
        orderBy: { startAt: "desc" },
        take: 20,
      }),
      prisma.meetingLink.findMany({
        where: { hostId: user.id },
        include: { guests: { include: { participant: { select: { name: true, email: true } } } } },
        orderBy: { startAt: "desc" },
        take: 20,
      }),
      linkCode
        ? prisma.meetingLink.findFirst({ where: { code: linkCode, hostId: user.id } })
        : Promise.resolve(null),
    ]);

    const bookingRows: MeetingCard[] = meetings.map((meeting) => ({
      id: meeting.id,
      startAt: meeting.startAt,
      endAt: meeting.endAt,
      tone: meeting.status === "SCHEDULED" ? "scheduled" : "closed",
      kicker: meeting.status === "SCHEDULED" ? "Booked with you" : "Closed",
      title: meeting.participant.name,
      detail: meeting.participant.email,
      note: meeting.status === "DECLINED" ? "You marked this time as not possible." : undefined,
      callUrl: meeting.status === "SCHEDULED" ? `/meetings/${meeting.id}/call` : undefined,
      action: meeting.status === "SCHEDULED" ? "decline" : undefined,
    }));
    const linkRows: MeetingCard[] = links.map((link) => ({
      id: link.id,
      startAt: link.startAt,
      endAt: link.endAt,
      tone: link.status === "SCHEDULED" ? "scheduled" : "closed",
      kicker:
        link.status === "SCHEDULED"
          ? `Your link · ${link.guests.length} of ${link.capacity}`
          : "Cancelled link",
      title: link.title,
      detail:
        link.status === "SCHEDULED"
          ? [link.participantName, "Held by you. Other people cannot book this time."]
              .filter(Boolean)
              .join(" · ")
          : undefined,
      note: link.status === "CANCELLED" ? "Cancelled. This hour is open again." : undefined,
      url: link.status === "SCHEDULED" ? `${appUrl()}/m/${link.code}` : undefined,
      callUrl: link.status === "SCHEDULED" ? `/m/${link.code}/call` : undefined,
      guests: link.guests.map((guest) => ({
        name: guest.participant.name,
        email: guest.participant.email,
      })),
      action: link.status === "SCHEDULED" ? "cancel" : undefined,
    }));
    const rows = [...bookingRows, ...linkRows].sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
    const upcoming = rows.filter((row) => row.tone === "scheduled" && row.startAt.getTime() > now.getTime()).length;

    return (
      <HostDashboard
        firstName={firstName}
        email={user.email}
        windows={windows}
        rows={rows}
        openDays={new Set(windows.map((window) => window.weekday)).size}
        upcoming={upcoming}
        held={links.filter((link) => link.status === "SCHEDULED").length}
        freshUrl={fresh ? `${appUrl()}/m/${fresh.code}` : undefined}
        notice={notice}
      />
    );
  }

  const [meetings, guestLinks] = await Promise.all([
    prisma.meeting.findMany({
      where: { participantId: user.id },
      include: { host: { select: { name: true, email: true } } },
      orderBy: { startAt: "desc" },
      take: 20,
    }),
    prisma.meetingLinkGuest.findMany({
      where: { participantId: user.id },
      include: { meetingLink: { include: { host: { select: { name: true, email: true } } } } },
      take: 20,
    }),
  ]);
  const account = accountOption(user.accountType);
  const rows: MeetingCard[] = [
    ...meetings.map((meeting) => ({
      id: meeting.id,
      startAt: meeting.startAt,
      endAt: meeting.endAt,
      tone: meeting.status === "SCHEDULED" ? ("scheduled" as const) : ("closed" as const),
      kicker: meeting.status === "SCHEDULED" ? "Scheduled" : "Closed",
      title: meeting.host.name,
      detail: meeting.host.email,
      note:
        meeting.status === "DECLINED" ? `${meeting.host.name} is not available at this time.` : undefined,
      callUrl: meeting.status === "SCHEDULED" ? `/meetings/${meeting.id}/call` : undefined,
    })),
    ...guestLinks.map((guest) => ({
      id: guest.id,
      startAt: guest.meetingLink.startAt,
      endAt: guest.meetingLink.endAt,
      tone: guest.meetingLink.status === "SCHEDULED" ? ("scheduled" as const) : ("closed" as const),
      kicker: guest.meetingLink.status === "SCHEDULED" ? "You're in" : "Cancelled",
      title: guest.meetingLink.title,
      detail: `${guest.meetingLink.host.name} · ${guest.meetingLink.host.email}`,
      callUrl:
        guest.meetingLink.status === "SCHEDULED" ? `/m/${guest.meetingLink.code}/call` : undefined,
      note:
        guest.meetingLink.status === "CANCELLED"
          ? `${guest.meetingLink.host.name} cancelled this meeting.`
          : undefined,
    })),
  ].sort((a, b) => b.startAt.getTime() - a.startAt.getTime());

  return (
    <div>
      <p className="inline-flex items-center gap-2 text-sm text-muted">
        <span className="h-2 w-2 rounded-full bg-clay" />
        {account?.audience ?? "Account"} · Free · Email confirmed
      </p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Hello, {firstName}.</h1>
      <section className="mt-10 rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="font-serif text-2xl tracking-tight">Find a host</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Search the Gmail the host shared with you. You will see which hours are open and which are
          already booked.
        </p>
        <div className="mt-5">
          <HostSearchForm />
        </div>
      </section>
      <section className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="font-serif text-2xl tracking-tight">Meetings</h2>
        <div className="mt-6">
          <MeetingList meetings={rows} empty="No meetings yet." />
        </div>
      </section>
    </div>
  );
}
