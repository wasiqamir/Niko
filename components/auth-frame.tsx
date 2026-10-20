import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModeSwitch } from "@/components/mode-switch";

const ASIDE: Record<"home" | "individual" | "teams", { kicker: string; line: string }> = {
  home: { kicker: "Niko", line: "A calmer hour, kept for the people in it." },
  individual: { kicker: "Individual", line: "Your own account, for hosting or joining." },
  teams: { kicker: "Teams", line: "One hour that fits the whole group." },
};

export function AuthFrame({
  title,
  subtitle,
  alternate,
  mode = "home",
  children,
}: {
  title: string;
  subtitle: string;
  alternate: { href: string; label: string };
  mode?: "home" | "individual" | "teams";
  children: ReactNode;
}) {
  const aside = ASIDE[mode];

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="site-header site-header--with-mode">
        <div className="mode-header-bar">
          <Logo />
          <ModeSwitch mode={mode} />
          <Link href={alternate.href} className="shrink-0 text-sm font-medium transition hover:text-accent">
            {alternate.label}
          </Link>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 content-start items-start gap-8 px-4 py-8 sm:px-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:py-14 xl:max-w-7xl">
        <aside className="rise relative hidden overflow-hidden rounded-[2rem] bg-forest p-10 text-background lg:block">
          <div className="orb absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/25" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.22em] text-gold">{aside.kicker}</p>
            <p className="mt-6 font-serif text-4xl leading-tight tracking-tight">{aside.line}</p>
          </div>
        </aside>
        <section className="rise rise-2 glass w-full rounded-[2rem] p-6 sm:p-10">
          <h1 className="font-serif text-4xl tracking-tight text-balance sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-lg text-base leading-7 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </section>
      </main>
    </div>
  );
}
