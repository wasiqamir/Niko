"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createTeamAccount, type TeamSignupState } from "@/app/actions/teams";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";

const initialState: TeamSignupState = {};

export function TeamSignupForm() {
  const [state, action] = useActionState(createTeamAccount, initialState);
  const [count, setCount] = useState(1);

  return (
    <form action={action} className="flex flex-col gap-5">
      <TextField label="Your name" name="name" autoComplete="name" required />
      <TextField label="Your email" name="email" type="email" autoComplete="email" required />
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
      <TextField label="Team name" name="teamName" required maxLength={80} placeholder="Studio North" />

      <fieldset>
        <legend className="text-sm font-medium">People on the team</legend>
        <p className="mt-1 text-sm text-muted">
          Add their names and emails. After you confirm your email, Niko asks each of them to join and set
          their schedule.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          {Array.from({ length: count }, (_, index) => (
            <div key={index} className="grid gap-3 rounded-2xl border border-line bg-background p-4 sm:grid-cols-2">
              <TextField label="Name" name="memberName" required maxLength={80} autoComplete="off" />
              <TextField label="Email" name="memberEmail" type="email" required autoComplete="off" />
            </div>
          ))}
        </div>
        {count < 12 ? (
          <button
            type="button"
            onClick={() => setCount((value) => value + 1)}
            className="mt-3 text-sm font-medium underline underline-offset-4"
          >
            Add another person
          </button>
        ) : null}
      </fieldset>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <SubmitButton pendingLabel="Creating team…">Create team account</SubmitButton>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </form>
  );
}
