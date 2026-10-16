"use client";

import { useActionState } from "react";
import { verifyEmail } from "@/app/actions/auth";
import { type AuthState } from "@/lib/validators";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";

const initialState: AuthState = {};

export function VerifyForm({ token }: { token: string }) {
  const [state, action] = useActionState(verifyEmail, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <SubmitButton pendingLabel="Confirming…">Confirm email and open my account</SubmitButton>
    </form>
  );
}
