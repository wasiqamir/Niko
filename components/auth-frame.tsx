import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModeSwitch } from "@/components/mode-switch";

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
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <Logo />
        <ModeSwitch mode={mode} />
        <Link href={alternate.href} className="text-sm font-medium">
          {alternate.label}
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center py-8 sm:items-center sm:py-12">
        <div className="w-full max-w-xl">
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-lg text-base leading-7 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
