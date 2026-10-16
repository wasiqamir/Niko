"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
import { type AuthState } from "@/lib/validators";

const initialState: AuthState = {};

export function ForgotPasswordForm({ email, sent }: { email?: string; sent?: boolean }) {
  const [state, action] = useActionState(requestPasswordReset, initialState);

  return (
    <div className="flex flex-col gap-5">
      {sent ? (
        <Notice tone="info">
          If an account uses that email, a link to set a new password is on its way. It expires in 1 hour.
        </Notice>
      ) : null}
      <form action={action} className="flex flex-col gap-5">
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email ?? email}
        />
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <SubmitButton pendingLabel="Sending…">Send reset email</SubmitButton>
      </form>
      <p className="text-center text-sm text-muted">
        Remember it?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
