"use client";

import { useActionState } from "react";
import Link from "next/link";
import { joinTeam, type TeamJoinState } from "@/app/actions/teams";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";

const initialState: TeamJoinState = {};

export function TeamJoinForm({
  token,
  teamName,
  memberName,
  memberEmail,
  signedIn,
  loginHref,
}: {
  token: string;
  teamName: string;
  memberName: string;
  memberEmail: string;
  signedIn: boolean;
  loginHref: string;
}) {
  const [state, action] = useActionState(joinTeam, initialState);

  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />
      <div className="rounded-2xl bg-foam px-4 py-4">
        <p className="text-sm text-muted">Team</p>
        <p className="mt-1 font-medium">{teamName}</p>
        <p className="mt-3 text-sm text-muted">Your name</p>
        <p className="mt-1 font-medium">{memberName}</p>
        <p className="mt-3 text-sm text-muted">Email</p>
        <p className="mt-1 font-medium">{memberEmail}</p>
      </div>
      {signedIn ? null : (
        <>
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <TextField
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </>
      )}
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <SubmitButton pendingLabel="Joining…">{signedIn ? "Join the team" : "Create account and join"}</SubmitButton>
      {signedIn ? null : (
        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href={loginHref} className="font-medium text-foreground underline underline-offset-4">
            Log in
          </Link>
        </p>
      )}
    </form>
  );
}
