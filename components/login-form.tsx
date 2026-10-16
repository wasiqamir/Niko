"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import { firstError, type AuthState } from "@/lib/validators";
import { Notice } from "@/components/notice";
import { ResendForm } from "@/components/resend-form";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";

const initialState: AuthState = {};

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, action] = useActionState(login, initialState);

  return (
    <div className="flex flex-col gap-5">
      <form action={action} className="flex flex-col gap-5">
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          error={firstError(state.fieldErrors?.email)}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={firstError(state.fieldErrors?.password)}
        />
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <SubmitButton pendingLabel="Logging in…">Log in</SubmitButton>
      </form>
      {state.unverified && state.email ? (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Send the confirmation link again.</p>
          <div className="mt-3">
            <ResendForm email={state.email} />
          </div>
        </div>
      ) : null}
      <p className="text-center text-sm text-muted">
        New to Niko?{" "}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}
