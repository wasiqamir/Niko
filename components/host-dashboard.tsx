import Link from "next/link";
import { CopyLink } from "@/components/copy-link";
import { MeetingList, type MeetingCard } from "@/components/meeting-list";
import { Notice } from "@/components/notice";
import { OpenHoursEditor } from "@/components/open-hours-form";

export function HostDashboard({
  firstName,
  email,
  windows,
  rows,
  openDays,
  upcoming,
  held,
  freshUrl,
  notice,
}: {
  firstName: string;
  email: string;
  windows: { weekday: number; startHour: number; endHour: number }[];
  rows: MeetingCard[];
  openDays: number;
  upcoming: number;
  held: number;
  freshUrl?: string;
  notice?: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      <section className="rise relative overflow-hidden rounded-[2rem] bg-forest text-background shadow-2xl">
        <div className="orb absolute -right-16 -top-24 h-64 w-64 rounded-full bg-accent/50" />
        <div className="orb absolute -bottom-20 left-1/2 h-48 w-48 rounded-full bg-clay/40 [animation-delay:-9s]" />
        <div className="relative grid gap-8 p-7 sm:p-10 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-gold">Host desk</p>
            <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl lg:text-6xl">Hello, {firstName}.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-background/80">
              People find you by searching your email. You can also hold an hour yourself and send them a
              Niko link. That hour stays closed for everyone else.
            </p>
            <p className="mt-5 inline-flex max-w-full break-all rounded-full bg-background/10 px-4 py-2 text-sm">{email}</p>
            <div className="mt-6">
              <Link
                href="/links/new"
                className="inline-flex h-12 items-center rounded-full bg-gold px-5 text-sm font-medium text-forest transition hover:-translate-y-0.5"
              >
                Create a meeting link
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              ["Open days", openDays],
              ["Coming up", upcoming],
              ["Your links", held],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-background/10 px-3 py-4 backdrop-blur-sm">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-background/70 sm:text-xs sm:tracking-[0.14em]">{label}</dt>
                <dd className="mt-2 font-serif text-2xl sm:text-3xl">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {freshUrl ? (
        <section className="rise rise-2 rounded-[2rem] border border-accent/30 bg-foam p-6 sm:p-8">
          <h2 className="font-serif text-3xl tracking-tight">Your link is ready.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Share it. When a participant opens it and joins, the meeting is on both schedules. This hour
            cannot be booked another way.
          </p>
          <CopyLink url={freshUrl} />
        </section>
      ) : null}

      {notice === "mail" ? (
        <Notice tone="error">This time is open again, but the email to the participant could not be sent.</Notice>
      ) : null}
      {notice === "cancel-mail" ? (
        <Notice tone="error">The meeting is cancelled and the hour is open, but an email could not be sent.</Notice>
      ) : null}

      <section className="rise rise-2 glass rounded-[2rem] p-6 sm:p-8">
        <h2 className="font-serif text-3xl tracking-tight">Open hours</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Each day has its own hours. Monday can be 9:00–11:00 and also 2:00–3:00. A day with no blocks is
          closed.
        </p>
        <OpenHoursEditor windows={windows} />
      </section>

      <section className="rise rise-3 glass rounded-[2rem] p-6 sm:p-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-serif text-3xl tracking-tight">Meetings</h2>
          <Link href="/links/new" className="text-sm font-medium text-accent">
            New link
          </Link>
        </div>
        <div className="mt-6">
          <MeetingList meetings={rows} empty="No meetings yet. Create a link or wait for a booking." />
        </div>
      </section>
    </div>
  );
}
