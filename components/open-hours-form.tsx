"use client";

import { useState } from "react";
import { useActionState } from "react";
import { saveOpenHours, type HoursState } from "@/app/actions/meetings";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { WEEKDAYS, formatClock, formatHourSpan } from "@/lib/time";

const initialState: HoursState = {};
const START_HOURS = Array.from({ length: 15 }, (_, index) => index + 7);
const END_HOURS = Array.from({ length: 16 }, (_, index) => index + 8);

type Range = {
  key: string;
  weekday: number;
  startHour: number;
  endHour: number;
};

export function OpenHoursEditor({
  windows,
}: {
  windows: { weekday: number; startHour: number; endHour: number }[];
}) {
  const [state, action] = useActionState(saveOpenHours, initialState);
  const [ranges, setRanges] = useState<Range[]>(() =>
    windows.map((window, index) => ({ key: `saved-${index}`, ...window })),
  );

  function addRange(weekday: number) {
    const existing = ranges.filter((range) => range.weekday === weekday);
    for (let startHour = 9; startHour < 21; startHour += 1) {
      const endHour = Math.min(startHour + 2, 22);
      const overlaps = existing.some((range) => startHour < range.endHour && endHour > range.startHour);
      if (!overlaps) {
        setRanges((current) => [
          ...current,
          { key: crypto.randomUUID(), weekday, startHour, endHour },
        ]);
        return;
      }
    }
  }

  function updateRange(key: string, patch: Partial<Pick<Range, "startHour" | "endHour">>) {
    setRanges((current) =>
      current.map((range) => {
        if (range.key !== key) return range;
        const next = { ...range, ...patch };
        if (next.endHour <= next.startHour) next.endHour = Math.min(next.startHour + 1, 22);
        return next;
      }),
    );
  }

  const payload = JSON.stringify(
    ranges.map(({ weekday, startHour, endHour }) => ({ weekday, startHour, endHour })),
  );

  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="ranges" value={payload} />
      <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line">
        {WEEKDAYS.map((day) => {
          const dayRanges = ranges
            .filter((range) => range.weekday === day.value)
            .sort((a, b) => a.startHour - b.startHour);
          return (
            <div
              key={day.value}
              className={`grid gap-4 px-4 py-4 sm:grid-cols-[8.5rem_1fr] sm:px-5 ${dayRanges.length ? "bg-foam/50" : "bg-background"}`}
            >
              <div>
                <p className="font-serif text-2xl tracking-tight">{day.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">
                  {dayRanges.length
                    ? dayRanges.map((range) => formatHourSpan(range.startHour, range.endHour)).join(" · ")
                    : "Closed"}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {dayRanges.map((range) => (
                  <div key={range.key} className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface px-3 py-2">
                    <select
                      value={range.startHour}
                      aria-label={`${day.name} starts`}
                      onChange={(event) => updateRange(range.key, { startHour: Number(event.target.value) })}
                      className="h-10 rounded-xl border border-line bg-background px-2 text-sm"
                    >
                      {START_HOURS.map((hour) => (
                        <option key={hour} value={hour}>
                          {formatClock(hour)}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm text-muted">to</span>
                    <select
                      value={range.endHour}
                      aria-label={`${day.name} ends`}
                      onChange={(event) => updateRange(range.key, { endHour: Number(event.target.value) })}
                      className="h-10 rounded-xl border border-line bg-background px-2 text-sm"
                    >
                      {END_HOURS.filter((hour) => hour > range.startHour).map((hour) => (
                        <option key={hour} value={hour}>
                          {formatClock(hour)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="text-sm font-medium text-clay"
                      onClick={() => setRanges((current) => current.filter((item) => item.key !== range.key))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addRange(day.value)}
                  className="self-start text-sm font-medium text-accent"
                >
                  Add hours
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {state.error ? <Notice tone="error">{state.error}</Notice> : null}
          {state.saved ? <Notice tone="info">Open hours saved. Each day keeps its own blocks.</Notice> : null}
        </div>
        <div className="sm:w-52">
          <SubmitButton pendingLabel="Saving…">Save open hours</SubmitButton>
        </div>
      </div>
    </form>
  );
}
