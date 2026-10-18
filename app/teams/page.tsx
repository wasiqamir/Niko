import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModeSwitch } from "@/components/mode-switch";
import { TeamSignupForm } from "@/components/team-signup-form";

export const metadata = {
  title: "Create a team",
};

export default function TeamsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <Logo />
        <ModeSwitch mode="teams" />
        <Link href="/login" className="text-sm font-medium">
          Log in
        </Link>
      </header>
      <main className="flex flex-1 justify-center py-8 sm:py-12">
        <div className="w-full max-w-xl">
          <p className="text-xs uppercase tracking-[0.22em] text-accent">Teams</p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Create a team account.</h1>
          <p className="mt-3 text-base leading-7 text-muted">
            Add the people by name and email. The team opens after you confirm your own email. Niko then
            emails everyone else to join and set the hours they can meet.
          </p>
          <div className="mt-8">
            <TeamSignupForm />
          </div>
        </div>
      </main>
    </div>
  );
}
