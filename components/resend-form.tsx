"use client";

import { useActionState } from "react";
import { resendVerification } from "@/app/actions/auth";
import { type AuthState } from "@/lib/validators";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";

const initialState: AuthState = {};

export function ResendForm({ email }: { email?: string }) {
  const [state, action] = useActionState(resendVerification, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
      )}
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <SubmitButton variant={email ? "ghost" : "primary"} pendingLabel="Sending…">
        {email ? "Resend email" : "Send confirmation email"}
      </SubmitButton>
    </form>
  );
}
