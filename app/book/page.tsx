import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { bookMeeting } from "@/app/actions/meetings";
import { AccountHeader } from "@/components/account-header";
import { HostSearchForm } from "@/components/host-search-form";
import { Notice } from "@/components/notice";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slotsForDay } from "@/lib/schedule";
import {
  addDays,
  formatDayLabel,
  formatRange,
  parseDateKey,
  TIME_ZONE_LABEL,
  todayKey,
} from "@/lib/time";

export const metadata = {
  title: "Find a host",
};

const ERRORS: Record<string, string> = {
  taken: "This time is booked. The host is not available then. Choose another time.",
  closed: "That hour is outside the host's open hours.",
  past: "That time has already passed.",
  overlap: "You already have a meeting at this time.",
  host: "No host account uses that email.",
  mail: "The time was not booked because the email could not be sent.",
};

export default function BookPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5">
      <AccountHeader />
      <main className="flex-1 py-6">
        <Suspense fallback={<div className="h-80 rounded-3xl bg-line/60" />}>
          <Schedule searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function Schedule({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  const params = await searchParams;
  const email = one(params.email)?.trim().toLowerCase() ?? "";
  const now = new Date();
  const today = todayKey(now);
  const requested = parseDateKey(one(params.date));
  const date = requested && requested >= today ? requested : today;
  const error = one(params.error);
  const booked = one(params.booked) === "1";

  if (user.accountType !== "PARTICIPANT") {
    return (
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Booking is for participants</h1>
        <p className="mt-3 max-w-xl text-muted">
          Your host account is what people search. Share {user.email}, and they book an open hour.
        </p>
        <Link href="/home" className="mt-6 inline-block text-sm font-medium underline underline-offset-4">
          Back to your schedule
        </Link>
      </div>
    );
  }

  const host = email
    ? await prisma.user.findUnique({
        where: { email },
      })
    : null;
  const visibleHost = host?.accountType === "HOST" && host.emailVerifiedAt ? host : null;
  const slots = visibleHost ? await slotsForDay(visibleHost.id, date, now) : [];
  const week = Array.from({ length: 7 }, (_, index) => addDays(today, index));

  return (
    <div>
      <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Find a host</h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-muted">
        Search the Gmail the host shared with you. Open hours can be booked. A booked hour stays
        closed.
      </p>
      <div className="mt-8">
        <HostSearchForm defaultEmail={email} />
      </div>

      {email && !visibleHost ? (
        <div className="mt-6">
          <Notice tone="error">No host account uses that email.</Notice>
        </div>
      ) : null}

      {visibleHost ? (
        <section className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <p className="text-sm text-muted">{TIME_ZONE_LABEL}</p>
          <h2 className="mt-1 font-serif text-3xl tracking-tight">{visibleHost.name}</h2>
          <p className="mt-2 text-sm text-muted">{visibleHost.email}</p>

          {booked ? (
            <div className="mt-4">
              <Notice tone="info">
                Booked with {visibleHost.name}. The live room is on your meetings. The meeting stays
                scheduled unless they press Not possible.
              </Notice>
            </div>
          ) : null}
          {error && ERRORS[error] ? (
            <div className="mt-4">
              <Notice tone="error">{ERRORS[error]}</Notice>
            </div>
          ) : null}

          <div className="mt-6 flex gap-2 overflow-x-auto">
            {week.map((day) => {
              const selected = day === date;
              const href = `/book?email=${encodeURIComponent(visibleHost.email)}&date=${day}`;
              return (
                <Link
                  key={day}
                  href={href}
                  className={`min-w-20 rounded-2xl border px-3 py-2 text-center text-sm ${
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-line bg-background"
                  }`}
                >
                  {formatDayLabel(day)}
                </Link>
              );
            })}
          </div>

          {slots.length === 0 ? (
            <p className="mt-6 text-sm leading-6 text-muted">No open hours on this day.</p>
          ) : (
            <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {slots.map((slot) => (
                <li key={slot.start.toISOString()} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-medium">{formatRange(slot.start)}</span>
                  {slot.booked ? (
                    <span className="text-sm text-clay">
                      Booked. The host is not available at this time.
                    </span>
                  ) : (
                    <form action={bookMeeting}>
                      <input type="hidden" name="hostEmail" value={visibleHost.email} />
                      <input type="hidden" name="start" value={slot.start.toISOString()} />
                      <button
                        type="submit"
                        className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
                      >
                        Choose this time
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
