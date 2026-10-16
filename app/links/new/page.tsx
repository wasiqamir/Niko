import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AccountHeader } from "@/components/account-header";
import { CreateLinkForm } from "@/components/create-link-form";
import { getCurrentUser } from "@/lib/auth";
import { hoursForHost } from "@/lib/schedule";
import { addDays, formatDayLabel, formatRange, parseDateKey, todayKey } from "@/lib/time";

export const metadata = {
  title: "Create a meeting link",
};

export default function NewLinkPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5">
      <AccountHeader />
      <main className="flex-1 py-6">
        <Suspense fallback={<div className="h-80 rounded-3xl bg-line/60" />}>
          <Planner searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Planner({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (user.accountType !== "HOST") {
    return (
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Links are for hosts</h1>
        <Link href="/home" className="mt-6 inline-block text-sm font-medium underline underline-offset-4">
          Back home
        </Link>
      </div>
    );
  }

  const params = await searchParams;
  const requested = parseDateKey(Array.isArray(params.date) ? params.date[0] : params.date);
  const now = new Date();
  const today = todayKey(now);
  const date = requested && requested >= today ? requested : today;
  const days = Array.from({ length: 14 }, (_, index) => addDays(today, index));
  const slots = await hoursForHost(user.id, date, now);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-accent">New meeting</p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Hold a time, then share the link.</h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-muted">
        Pick the day, the hour, and how many people can join. Niko keeps that hour for this meeting.
        A participant who searches your email will see it as booked.
      </p>
      <section className="mt-8 rounded-[2rem] border border-line bg-surface p-6 sm:p-8">
        <CreateLinkForm
          dateLabel={formatDayLabel(date)}
          days={days.map((day) => ({
            key: day,
            label: formatDayLabel(day),
            href: `/links/new?date=${day}`,
            selected: day === date,
          }))}
          slots={slots.map((slot) => ({
            start: slot.start.toISOString(),
            label: formatRange(slot.start),
            state: slot.past ? "past" : slot.booked ? "booked" : "open",
          }))}
        />
      </section>
    </div>
  );
}
