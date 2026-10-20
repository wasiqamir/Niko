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
    <div className="flex w-full flex-1 flex-col">
      <header className="site-header site-header--with-mode">
        <div className="mode-header-bar">
          <Logo />
          <ModeSwitch />
          <Link
            href="/login"
            className="inline-flex h-10 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition hover:bg-foreground hover:text-background sm:px-4"
          >
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 content-start items-start gap-8 px-4 py-8 sm:gap-10 sm:px-5 sm:py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-14 lg:py-16 xl:max-w-7xl xl:gap-16 xl:py-20">
        <section className="rise min-w-0">
          <p className="text-[0.7rem] font-medium tracking-[0.22em] text-accent uppercase sm:text-xs sm:tracking-[0.28em]">
            Niko
          </p>
          <h1 className="mt-4 max-w-xl text-balance font-serif text-[2.35rem] leading-[1.02] tracking-tight min-[380px]:text-4xl sm:mt-5 sm:text-5xl sm:leading-[0.98] lg:text-6xl xl:text-7xl xl:leading-[0.95]">
            Your meetings live here.
          </h1>
          <div className="gold-rule mt-5 sm:mt-6" />
          <p className="rise rise-2 mt-5 max-w-md text-base leading-7 text-muted sm:mt-6 sm:text-lg sm:leading-8">
            Choose Individual to open your own account, or Teams to open an account for a group. Both
            are free, and both start after you confirm your email.
          </p>
        </section>

        <aside className="rise rise-3 relative min-w-0 overflow-hidden rounded-[1.5rem] bg-forest p-6 text-background shadow-2xl sm:rounded-[2rem] sm:p-8 lg:p-10">
          <div className="orb absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/40" />
          <div className="orb absolute -bottom-16 left-8 h-40 w-40 rounded-full bg-gold/20 [animation-delay:-8s]" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.22em] text-gold">The hour</p>
            <p className="mt-4 text-balance font-serif text-[1.7rem] leading-tight tracking-tight sm:text-3xl lg:text-4xl">
              Held quietly, then shared.
            </p>
            <ol className="mt-6 flex flex-col gap-4 sm:mt-8 sm:gap-5">
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
