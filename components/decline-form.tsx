"use client";

import { useActionState } from "react";
import { declineByToken, type DeclineState } from "@/app/actions/meetings";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";

const initialState: DeclineState = {};

export function DeclineForm({
  token,
  alreadyDeclined = false,
}: {
  token: string;
  alreadyDeclined?: boolean;
}) {
  const [state, action] = useActionState(declineByToken, initialState);

  if (state.message) return <Notice tone="info">{state.message}</Notice>;
  if (alreadyDeclined) {
    return <Notice tone="info">You already marked this time as not possible.</Notice>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <SubmitButton pendingLabel="Sending…">Not possible</SubmitButton>
    </form>
  );
}
