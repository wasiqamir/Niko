"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { ACCOUNT_OPTIONS, type AccountChoice } from "@/lib/accounts";
import { firstError, type AuthState } from "@/lib/validators";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";

const initialState: AuthState = {};

export function SignupForm({ defaultType }: { defaultType?: AccountChoice }) {
  const [state, action] = useActionState(signup, initialState);

  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset>
        <legend className="text-sm font-medium">How will you use Niko?</legend>
        <p className="mt-1 text-sm text-muted">Both accounts are free.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {ACCOUNT_OPTIONS.map((option) => (
            <label key={option.id} className="block">
              <input
                type="radio"
                name="accountType"
                value={option.id}
                defaultChecked={defaultType === option.id}
                required
                className="peer sr-only"
              />
              <span className="block h-full cursor-pointer rounded-2xl border border-line bg-surface p-4 transition peer-checked:border-foreground peer-checked:bg-accent/10 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground">
                <span className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-medium tracking-wide text-muted uppercase">
                    <span
                      className={`h-2 w-2 rounded-full ${option.id === "host" ? "bg-accent" : "bg-clay"}`}
                    />
                    {option.audience}
                  </span>
                  <span className="text-xs text-muted">Free</span>
                </span>
                <span className="mt-3 block text-base font-medium">{option.title}</span>
                <span className="mt-1 block text-sm leading-6 text-muted">{option.summary}</span>
              </span>
            </label>
          ))}
        </div>
        {firstError(state.fieldErrors?.accountType) ? (
          <p className="mt-2 text-sm text-warn">{firstError(state.fieldErrors?.accountType)}</p>
        ) : null}
      </fieldset>

      <TextField
        label="Name"
        name="name"
        autoComplete="name"
        required
        error={firstError(state.fieldErrors?.name)}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={firstError(state.fieldErrors?.email)}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={firstError(state.fieldErrors?.password)}
      />
      <TextField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={firstError(state.fieldErrors?.confirmPassword)}
      />

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <SubmitButton pendingLabel="Creating account…">Create free account</SubmitButton>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </form>
  );
}
