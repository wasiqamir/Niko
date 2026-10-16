"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createMeetingLink, type LinkState } from "@/app/actions/meetings";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";

const initialState: LinkState = {};

type Day = { key: string; label: string; href: string; selected: boolean };
type Slot = { start: string; label: string; state: "open" | "booked" | "past" };

export function CreateLinkForm({ days, slots, dateLabel }: { days: Day[]; slots: Slot[]; dateLabel: string }) {
  const [state, action] = useActionState(createMeetingLink, initialState);
  const openSlots = slots.some((slot) => slot.state === "open");

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
        <fieldset>
          <legend className="font-serif text-2xl tracking-tight">{dateLabel}</legend>
          <p className="mt-1 text-sm text-muted">One hour, Pakistan time. A booked hour stays closed.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {slots.map((slot) =>
              slot.state === "open" ? (
                <label
                  key={slot.start}
                  className="flex cursor-pointer items-center justify-between rounded-2xl border border-line bg-background px-4 py-3 text-sm has-[:checked]:border-forest has-[:checked]:bg-foam"
                >
                  <span>{slot.label}</span>
                  <input type="radio" name="start" value={slot.start} required className="accent-forest" />
                </label>
              ) : (
                <div
                  key={slot.start}
                  className="flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm text-muted"
                >
                  <span>{slot.label}</span>
                  <span className={slot.state === "booked" ? "text-clay" : ""}>
                    {slot.state === "booked" ? "Booked" : "Passed"}
                  </span>
                </div>
              ),
            )}
          </div>
        </fieldset>

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
        {openSlots ? (
          <SubmitButton pendingLabel="Creating…">Create link</SubmitButton>
        ) : (
          <p className="text-sm text-muted">Every hour on this day is already held.</p>
        )}
      </form>
    </div>
  );
}
