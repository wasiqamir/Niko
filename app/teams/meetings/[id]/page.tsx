import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AccountHeader } from "@/components/account-header";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMeetingWhen } from "@/lib/time";

export const metadata = {
  title: "Team meeting",
};

export default function TeamMeetingPage(props: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5">
      <AccountHeader />
      <Suspense fallback={<div className="h-80 rounded-3xl bg-line/60" />}>
        <ComingSoon params={props.params} />
      </Suspense>
    </div>
  );
}

async function ComingSoon({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  const { id } = await params;
  const meeting = await prisma.teamMeeting.findUnique({
    where: { id },
    include: {
      team: { include: { members: { where: { status: "ACTIVE" } } } },
    },
  });

  const allowed =
    meeting &&
    (meeting.team.ownerId === user.id ||
      meeting.team.members.some((member) => member.userId === user.id));

  if (!meeting || !allowed) {
    return (
      <main className="flex flex-1 items-center justify-center py-16">
        <p className="text-sm text-muted">This meeting is not on your account.</p>
      </main>
    );
  }

  if (meeting.endAt.getTime() <= Date.now()) {
    return (
      <main className="flex flex-1 items-center justify-center py-16">
        <div className="max-w-lg text-center">
          <h1 className="font-serif text-4xl tracking-tight">Meeting is ended</h1>
          <p className="mt-3 text-sm text-muted">{formatMeetingWhen(meeting.startAt, meeting.endAt)}</p>
          <Link href="/home" className="mt-6 inline-block text-sm font-medium underline underline-offset-4">
            Back home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden py-16">
      <div className="orb absolute -left-24 top-8 h-72 w-72 rounded-full bg-foam" />
      <div className="orb absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-gold/40 [animation-delay:-8s]" />
      <div className="rise glass relative w-full max-w-xl rounded-[2rem] px-8 py-16 text-center sm:px-14">
        <p className="text-xs uppercase tracking-[0.28em] text-accent">{meeting.team.name}</p>
        <h1 className="mt-5 font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          This Feature Is Coming Soon
        </h1>
        <p className="mt-5 text-base leading-7 text-muted">
          The team is gathered for this time. The live room is not open yet.
        </p>
        <p className="mt-4 text-sm font-medium">{formatMeetingWhen(meeting.startAt, meeting.endAt)}</p>
        <Link href="/home" className="mt-8 inline-flex h-12 items-center rounded-full bg-forest px-5 text-sm font-medium text-background">
          Back to your account
        </Link>
      </div>
    </main>
  );
}
