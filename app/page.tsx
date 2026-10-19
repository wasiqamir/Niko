import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { ModeSwitch } from "@/components/mode-switch";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="mx-auto h-80 w-full max-w-6xl px-5 py-16" />}>
      <PublicHome />
    </Suspense>
  );
}

async function PublicHome() {
  await connection();
  const user = await getOptionalUser();
  if (user) redirect("/home");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5">
      <header className="site-header">
        <Logo />
        <ModeSwitch />
        <Link
          href="/login"
          className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition hover:bg-foreground hover:text-background"
        >
          Log in
        </Link>
      </header>

      <main className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
        <section className="rise">
          <p className="text-xs font-medium tracking-[0.28em] text-accent uppercase">Niko</p>
          <h1 className="mt-5 max-w-xl font-serif text-4xl leading-[0.98] tracking-tight sm:text-6xl sm:leading-[0.95] lg:text-7xl">
            Your meetings live here.
          </h1>
          <div className="gold-rule mt-6" />
          <p className="rise rise-2 mt-6 max-w-md text-lg leading-8 text-muted">
            Choose Individual to open your own account, or Teams to open an account for a group. Both
            are free, and both start after you confirm your email.
          </p>
        </section>

        <aside className="rise rise-3 relative overflow-hidden rounded-[2rem] bg-forest p-8 text-background shadow-2xl sm:p-10">
          <div className="orb absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/40" />
          <div className="orb absolute -bottom-16 left-8 h-40 w-40 rounded-full bg-gold/20 [animation-delay:-8s]" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.22em] text-gold">The hour</p>
            <p className="mt-4 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">Held quietly, then shared.</p>
            <ol className="mt-8 flex flex-col gap-5">
              {[
                ["01", "Choose Individual or Teams"],
                ["02", "Confirm the email Niko sends"],
                ["03", "The time stays closed for everyone else"],
              ].map(([index, line]) => (
                <li key={index} className="flex items-baseline gap-4">
                  <span className="font-serif text-gold">{index}</span>
                  <span className="text-sm leading-6 text-background/85">{line}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </main>
    </div>
  );
}
