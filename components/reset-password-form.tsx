"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
import { firstError, type AuthState } from "@/lib/validators";

const initialState: AuthState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, initialState);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />
      <TextField
        label="New password"
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
        minLength={8}
        error={firstError(state.fieldErrors?.confirmPassword)}
      />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <SubmitButton pendingLabel="Saving…">Save new password</SubmitButton>
      <p className="text-center text-sm text-muted">
        Need another link?{" "}
        <Link href="/forgot-password" className="font-medium text-foreground underline underline-offset-4">
          Send it again
        </Link>
      </p>
    </form>
  );
}
