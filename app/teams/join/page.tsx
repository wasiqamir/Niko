import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AuthFrame } from "@/components/auth-frame";
import { TeamJoinForm } from "@/components/team-join-form";
import { getOptionalUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";

export const metadata = {
  title: "Join a team",
};

export default function JoinTeamPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AuthFrame
      mode="teams"
      title="Join the team"
      subtitle="Press the button to join and set your schedule. Opening this email does not add you yet."
      alternate={{ href: "/login", label: "Log in" }}
    >
      <Suspense fallback={<div className="h-64 rounded-3xl bg-line/50" />}>
        <JoinLoader searchParams={props.searchParams} />
      </Suspense>
    </AuthFrame>
  );
}

async function JoinLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  if (!token) {
    return <p className="text-sm text-muted">This invite is missing its code.</p>;
  }

  const member = await prisma.teamMember.findUnique({
    where: { inviteTokenHash: hashToken(token) },
    include: { team: true },
  });
  if (!member || member.team.status !== "ACTIVE" || member.status !== "PENDING") {
    return <p className="text-sm text-muted">This invite is invalid or has already been used.</p>;
  }
  if (!member.inviteExpiresAt || member.inviteExpiresAt.getTime() <= Date.now()) {
    return (
      <p className="text-sm text-muted">This invite has expired. Ask the team creator to send it again.</p>
    );
  }

  const user = await getOptionalUser();
  const next = `/teams/join?token=${encodeURIComponent(token)}`;

  return (
    <div>
      {user && user.email.toLowerCase() !== member.email ? (
        <p className="mb-4 text-sm text-warn">
          You are logged in as {user.email}.{" "}
          <Link href="/login" className="font-medium underline underline-offset-4">
            Log in as {member.email}
          </Link>{" "}
          to join.
        </p>
      ) : null}
      <TeamJoinForm
        token={token}
        teamName={member.team.name}
        memberName={member.name}
        memberEmail={member.email}
        signedIn={Boolean(user && user.email.toLowerCase() === member.email)}
        loginHref={`/login?next=${encodeURIComponent(next)}`}
      />
    </div>
  );
}
