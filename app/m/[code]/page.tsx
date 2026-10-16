import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { cancelMeetingLink } from "@/app/actions/meetings";
import { CopyLink } from "@/components/copy-link";
import { Logo } from "@/components/logo";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { getOptionalUser } from "@/lib/auth";
import { appUrl } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { formatMeetingWhen } from "@/lib/time";

export const metadata = {
  title: "Meeting",
};

const ERRORS: Record<string, string> = {
  full: "This meeting is full.",
  overlap: "You already have a meeting at this time.",
  past: "This time has passed.",
  cancelled: "The host cancelled this meeting.",
  account: "Participants join this link. Hosts share it.",
  missing: "This link is not valid.",
  error: "We couldn't add you. Try again.",
};

export default function MeetingLinkPage(props: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <Link href="/home" className="text-sm font-medium">
          Your account
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center py-8 sm:items-center">
        <Suspense fallback={<div className="h-64 w-full rounded-3xl bg-line/60" />}>
          <JoinCard params={props.params} searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function JoinCard({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { code } = await params;
  const query = await searchParams;
  const user = await getOptionalUser();
  const link = await prisma.meetingLink.findUnique({
    where: { code },
    include: {
      host: { select: { id: true, name: true, email: true } },
      guests: { include: { participant: { select: { id: true, name: true, email: true } } } },
    },
  });

  if (!link) return <p className="text-sm text-muted">This link is not valid.</p>;

  const joined = user ? link.guests.some((guest) => guest.participantId === user.id) : false;
  const spotsLeft = Math.max(link.capacity - link.guests.length, 0);
  const error = one(query.error);
  const justJoined = one(query.joined) === "1";
  const mailFailed = one(query.notice) === "mail";
  const isHost = user?.id === link.host.id;
  const past = link.endAt.getTime() <= Date.now();

  return (
    <section className="w-full overflow-hidden rounded-[2rem] border border-line bg-surface">
      <div className="bg-forest px-6 py-8 text-background sm:px-8">
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Niko meeting</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">{link.title}</h1>
        <p className="mt-3 text-background/80">{formatMeetingWhen(link.startAt)}</p>
      </div>
      <div className="flex flex-col gap-4 px-6 py-6 sm:px-8">
        <p className="text-sm leading-6">
          {link.host.name}
          <span className="text-muted"> · {link.host.email}</span>
        </p>
        <p className="text-sm text-muted">
          {link.guests.length} of {link.capacity} joined
          {link.status === "SCHEDULED" && !past ? ` · ${spotsLeft} still open` : ""}
        </p>

        {link.status === "CANCELLED" ? (
          <Notice tone="info">The host cancelled this meeting. The hour is open again.</Notice>
        ) : null}
        {justJoined ? <Notice tone="info">You're in. This meeting is on your schedule.</Notice> : null}
        {mailFailed ? (
          <Notice tone="error">You're in, but the email to the host could not be sent.</Notice>
        ) : null}
        {error && ERRORS[error] ? <Notice tone="error">{ERRORS[error]}</Notice> : null}

        {link.status === "SCHEDULED" && isHost ? (
          <Link
            href={`/m/${link.code}/call`}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-medium text-background"
          >
            Join meeting
          </Link>
        ) : null}

        {link.status === "SCHEDULED" && !isHost && user?.accountType === "PARTICIPANT" ? (
          <Link
            href={`/m/${link.code}/call`}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-medium text-background"
          >
            Join meeting
          </Link>
        ) : null}

        {link.status === "SCHEDULED" && !user ? (
          <Link
            href={`/login?next=${encodeURIComponent(`/m/${link.code}/call`)}`}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-medium text-background"
          >
            Log in to join the meeting
          </Link>
        ) : null}

        {isHost && link.status === "SCHEDULED" ? (
          <div>
            <p className="text-sm text-muted">Send this link to the people you want in the room.</p>
            <CopyLink url={`${appUrl()}/m/${link.code}`} />
            {link.guests.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-1">
                {link.guests.map((guest) => (
                  <li key={guest.id} className="text-sm">
                    {guest.participant.name} · {guest.participant.email}
                  </li>
                ))}
              </ul>
            ) : null}
            <form action={cancelMeetingLink} className="mt-4">
              <input type="hidden" name="linkId" value={link.id} />
              <SubmitButton variant="ghost" pendingLabel="Cancelling…">
                Cancel meeting
              </SubmitButton>
            </form>
          </div>
        ) : null}

        {!isHost && link.status === "SCHEDULED" && !past && !joined && user?.accountType === "PARTICIPANT" && spotsLeft === 0 ? (
          <Notice tone="error">This meeting is full.</Notice>
        ) : null}

        {joined && link.status === "SCHEDULED" ? (
          <Link href="/home" className="text-sm font-medium underline underline-offset-4">
            See it on your meetings
          </Link>
        ) : null}
      </div>
    </section>
  );
}
