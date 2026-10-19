"use client";

import { useActionState, useEffect, useState } from "react";
import { createMeetingLink, type LinkState } from "@/app/actions/meetings";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
import { dateKeyFromParts, daysInMonth, shiftMonth, weekdayOfKey } from "@/lib/time";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const initialState: LinkState = {};

export type CalendarEvent = {
  id: string;
  date: string;
  time: string;
  title: string;
};

export function MeetingCalendar({ today, events }: { today: string; events: CalendarEvent[] }) {
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)));
  const [picked, setPicked] = useState<string | null>(null);
  const todayMonth = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  const ahead = shiftMonth(todayMonth.year, todayMonth.month, 11);
  const atStart = year === todayMonth.year && month === todayMonth.month;
  const atEnd = year === ahead.year && month === ahead.month;
  const cells = monthCells(year, month);
  const byDate = groupEvents(events);

  function move(delta: number) {
    const shifted = shiftMonth(year, month, delta);
    setYear(shifted.year);
    setMonth(shifted.month);
  }

  function choose(key: string) {
    if (key < today) return;
    setPicked(key);
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rise glass overflow-hidden rounded-[28px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Pakistan time</p>
            <h2 className="mt-1 font-serif text-3xl tracking-tight">{monthTitle(year, month)}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setYear(todayMonth.year);
                setMonth(todayMonth.month);
              }}
              className="h-10 rounded-full border border-line px-4 text-sm font-medium"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={atStart}
              aria-label="Previous month"
              className="h-10 w-10 rounded-full border border-line text-lg disabled:opacity-40"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={atEnd}
              aria-label="Next month"
              className="h-10 w-10 rounded-full border border-line text-lg disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-line bg-foam/70">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-1 py-2 text-center text-[11px] font-semibold tracking-wide text-muted sm:text-xs">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 grid-rows-6">
          {cells.map((cell) => {
            const past = cell.key < today;
            const selected = cell.key === picked;
            const dayEvents = byDate.get(cell.key) ?? [];
            return (
              <button
                key={cell.key}
                type="button"
                disabled={past}
                onClick={() => choose(cell.key)}
                className={`flex min-h-20 flex-col border-r border-b border-line p-1.5 text-left transition sm:min-h-28 sm:p-2 ${
                  past ? "cursor-default bg-background/50 text-muted/45" : "hover:bg-foam/70"
                } ${selected ? "bg-foam ring-2 ring-inset ring-forest" : ""} ${
                  cell.inMonth ? "" : "bg-background/30"
                }`}
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                    cell.key === today ? "bg-forest font-medium text-background" : ""
                  } ${cell.inMonth ? "" : "text-muted"}`}
                >
                  {cell.day}
                </span>
                <span className="mt-1 flex flex-col gap-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <span
                      key={event.id}
                      className="truncate rounded bg-forest/10 px-1 py-0.5 text-[10px] leading-4 text-forest sm:text-[11px]"
                    >
                      {event.time} {event.title}
                    </span>
                  ))}
                  {dayEvents.length > 2 ? (
                    <span className="text-[10px] text-muted">+{dayEvents.length - 2} more</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="rise rise-2 glass rounded-[28px] p-5 sm:p-6 xl:sticky xl:top-24">
        {picked ? (
          <DayForm
            key={picked}
            date={picked}
            events={byDate.get(picked) ?? []}
            onClose={() => setPicked(null)}
          />
        ) : (
          <div className="flex min-h-64 flex-col justify-center">
            <p className="text-xs uppercase tracking-[0.16em] text-accent">New meeting</p>
            <h2 className="mt-2 font-serif text-3xl tracking-tight">Click a date</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              The form opens here with the time, the participant, and the meeting details.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function DayForm({
  date,
  events,
  onClose,
}: {
  date: string;
  events: CalendarEvent[];
  onClose: () => void;
}) {
  const [state, action] = useActionState(createMeetingLink, initialState);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-accent">New meeting</p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight">{longDate(date)}</h2>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-medium text-muted">
          Close
        </button>
      </div>

      {events.length > 0 ? (
        <div className="mt-4 rounded-2xl bg-foam/70 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-forest">Already held</p>
          <ul className="mt-2 flex flex-col gap-1">
            {events.map((event) => (
              <li key={event.id} className="text-sm text-foreground">
                {event.time} · {event.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={action} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="date" value={date} />
        <fieldset>
          <legend className="text-sm font-medium">Timing</legend>
          <p className="mt-1 text-sm text-muted">Pakistan time. Example: 10:10 PM to 11:10 PM.</p>
          <div className="mt-3 grid gap-3">
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
        <TextField
          label="Participant Name"
          name="participantName"
          required
          maxLength={80}
          placeholder="Amina Guest"
          defaultValue={state.participantName}
          autoComplete="name"
        />
        <TextField
          label="Meeting Name"
          name="title"
          required
          maxLength={80}
          placeholder="Client workshop"
          defaultValue={state.title}
        />
        <TextField
          label="Participants Allowed"
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

function monthCells(year: number, month: number) {
  const first = dateKeyFromParts(year, month, 1);
  const leading = weekdayOfKey(first);
  const count = daysInMonth(year, month);
  const cells: { key: string; day: number; inMonth: boolean }[] = [];
  const previous = shiftMonth(year, month, -1);
  const previousCount = daysInMonth(previous.year, previous.month);

  for (let index = leading - 1; index >= 0; index -= 1) {
    const day = previousCount - index;
    cells.push({
      key: dateKeyFromParts(previous.year, previous.month, day),
      day,
      inMonth: false,
    });
  }
  for (let day = 1; day <= count; day += 1) {
    cells.push({ key: dateKeyFromParts(year, month, day), day, inMonth: true });
  }
  const next = shiftMonth(year, month, 1);
  let trailing = 1;
  while (cells.length < 42) {
    cells.push({
      key: dateKeyFromParts(next.year, next.month, trailing),
      day: trailing,
      inMonth: false,
    });
    trailing += 1;
  }
  return cells;
}

function groupEvents(events: CalendarEvent[]) {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }
  return byDate;
}

function monthTitle(year: number, month: number) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function longDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
