import { Suspense } from "react";
import Link from "next/link";
import { ACCOUNT_OPTIONS } from "@/lib/accounts";
import { getOptionalUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5">
      <header className="flex items-center justify-between gap-4 py-5">
        <Logo />
        <Suspense fallback={<div className="h-10 w-40 rounded-xl bg-line/70" />}>
          <HeaderActions />
        </Suspense>
      </header>

      <main className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        <section>
          <p className="text-sm font-medium tracking-wide text-accent uppercase">Two free accounts</p>
          <h1 className="mt-4 max-w-xl font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Host the meeting, or just join it.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-muted">
            Niko asks which account you need. One is for your work, when clients book time with
            you. The other is for people who only take part in meetings. Both are free, and both
            open after you confirm your email.
          </p>
        </section>

        <section className="grid gap-3">
          {ACCOUNT_OPTIONS.map((option) => (
            <Link
              key={option.id}
              href={`/signup?type=${option.id}`}
              className="rounded-3xl border border-line bg-surface p-5 transition hover:border-foreground"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-xs font-medium tracking-wide text-muted uppercase">
                  <span
                    className={`h-2 w-2 rounded-full ${option.id === "host" ? "bg-accent" : "bg-clay"}`}
                  />
                  {option.audience}
                </span>
                <span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted">Free</span>
              </span>
              <span className="mt-4 block font-serif text-3xl tracking-tight">{option.title}</span>
              <span className="mt-2 block text-sm leading-6 text-muted">{option.summary}</span>
              <span className="mt-4 block text-sm font-medium">Create this account</span>
            </Link>
          ))}
        </section>
      </main>

      <section className="border-t border-line py-10">
        <h2 className="font-serif text-2xl tracking-tight">How an account opens</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {[
            ["Choose an account", "Host for client meetings, or participant if you only join."],
            ["Confirm your email", "We send one link. Your account stays closed until you open it."],
            ["You're in", "A host account and a participant account land in different homes."],
          ].map(([title, body], index) => (
            <li key={title}>
              <p className="text-sm text-muted">0{index + 1}</p>
              <h3 className="mt-1 font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

async function HeaderActions() {
  const user = await getOptionalUser();

  if (user) {
    return (
      <Link
        href="/home"
        className="inline-flex h-10 items-center rounded-xl bg-foreground px-4 text-sm font-medium text-background"
      >
        Open your account
      </Link>
    );
  }

  return (
    <nav className="flex items-center gap-2 sm:gap-3">
      <Link href="/login" className="inline-flex h-10 items-center px-3 text-sm font-medium">
        Log in
      </Link>
      <Link
        href="/signup"
        className="inline-flex h-10 items-center rounded-xl bg-foreground px-4 text-sm font-medium text-background"
      >
        Create account
      </Link>
    </nav>
  );
}
