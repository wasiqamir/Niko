import { Suspense } from "react";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { DeclineForm } from "@/components/decline-form";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import { formatMeetingWhen } from "@/lib/time";

export const metadata = {
  title: "Not possible",
};

export default function DeclinePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AuthFrame
      title="Not possible?"
      subtitle="Press the button if you cannot take this meeting. The participant gets an email, and the hour opens again."
      alternate={{ href: "/login", label: "Log in" }}
    >
      <Suspense fallback={<div className="h-24 rounded-3xl bg-line/50" />}>
        <DeclineDetails searchParams={props.searchParams} />
      </Suspense>
    </AuthFrame>
  );
}

async function DeclineDetails({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  if (!token) return <p className="text-sm text-muted">This link is not valid.</p>;

  const meeting = await prisma.meeting.findUnique({
    where: { declineTokenHash: hashToken(token) },
    include: { participant: true },
  });

  if (!meeting) return <p className="text-sm text-muted">This link is not valid.</p>;

  const alreadyDeclined = meeting.status === "DECLINED";

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-line bg-surface p-4 text-sm leading-6">
        <p>
          <span className="text-muted">Name</span>
          <br />
          {meeting.participant.name}
        </p>
        <p className="mt-3">
          <span className="text-muted">Email</span>
          <br />
          {meeting.participant.email}
        </p>
        <p className="mt-3">
          <span className="text-muted">Time</span>
          <br />
          {formatMeetingWhen(meeting.startAt)}
        </p>
      </div>
      <DeclineForm token={token} alreadyDeclined={alreadyDeclined} />
      {alreadyDeclined ? null : (
        <Link href="/home" className="text-sm text-muted underline underline-offset-4">
          Keep this meeting
        </Link>
      )}
    </div>
  );
}
