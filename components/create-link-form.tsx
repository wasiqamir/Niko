"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createMeetingLink, type LinkState } from "@/app/actions/meetings";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";

const initialState: LinkState = {};

type Day = { key: string; label: string; href: string; selected: boolean };

export function CreateLinkForm({
  days,
  date,
  dateLabel,
  held,
}: {
  days: Day[];
  date: string;
  dateLabel: string;
  held: string[];
}) {
  const [state, action] = useActionState(createMeetingLink, initialState);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => (
          <Link
            key={day.key}
            href={day.href}
            className={`min-w-24 rounded-2xl border px-3 py-3 text-center text-sm ${
              day.selected ? "border-forest bg-forest text-background" : "border-line bg-background"
            }`}
          >
            {day.label}
          </Link>
        ))}
      </div>

      <form action={action} className="mt-6 flex flex-col gap-5">
        <input type="hidden" name="date" value={date} />
        <fieldset>
          <legend className="font-serif text-2xl tracking-tight">{dateLabel}</legend>
          <p className="mt-1 text-sm text-muted">
            Write the start and end in Pakistan time, such as 10:10 PM to 11:10 PM. A time that overlaps
            another meeting stays closed.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label="Start time"
              name="startTime"
              required
              maxLength={20}
              placeholder="10:10 PM"
              defaultValue={state.startTime}
              autoComplete="off"
            />
            <TextField
              label="End time"
              name="endTime"
              required
              maxLength={20}
              placeholder="11:10 PM"
              defaultValue={state.endTime}
              autoComplete="off"
            />
          </div>
        </fieldset>

        {held.length > 0 ? (
          <div>
            <p className="text-sm font-medium">Already held this day</p>
            <ul className="mt-2 flex flex-col gap-1">
              {held.map((label, index) => (
                <li key={`${label}-${index}`} className="text-sm text-muted">
                  {label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <TextField label="Meeting name" name="title" required maxLength={80} placeholder="Client workshop" />
        <TextField
          label="Participants allowed"
          name="capacity"
          type="number"
          required
          min={1}
          max={50}
          defaultValue="5"
        />
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <SubmitButton pendingLabel="Creating…">Create link</SubmitButton>
      </form>
    </div>
  );
}
