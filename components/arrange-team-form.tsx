"use client";

import { useActionState } from "react";
import { arrangeTeamMeeting, type TeamArrangeState } from "@/app/actions/teams";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";

const initialState: TeamArrangeState = {};

export function ArrangeTeamForm() {
  const [state, action] = useActionState(arrangeTeamMeeting, initialState);

  return (
    <form action={action} className="mt-6">
      {state.error ? (
        <div className="mb-4">
          <Notice tone="error">{state.error}</Notice>
        </div>
      ) : null}
      <SubmitButton pendingLabel="Checking schedules…" fullWidth={false}>
        Arrange today&apos;s meeting
      </SubmitButton>
    </form>
  );
}
