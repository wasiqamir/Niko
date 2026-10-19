import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { ModeSwitch } from "@/components/mode-switch";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="mx-auto h-80 w-full max-w-5xl px-5 py-16" />}>
      <PublicHome />
    </Suspense>
  );
}

async function PublicHome() {
  await connection();
  const user = await getOptionalUser();
  if (user) redirect("/home");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <Logo />
        <ModeSwitch />
        <Link href="/login" className="inline-flex h-10 items-center px-3 text-sm font-medium">
          Log in
        </Link>
      </header>

      <main className="flex flex-1 flex-col justify-center py-16">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">Niko</p>
        <h1 className="mt-4 max-w-xl font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          Your meetings live here.
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-8 text-muted">
          Choose Individual to open your own account, or Teams to open an account for a group. Both
          are free, and both start after you confirm your email.
        </p>
      </main>
    </div>
  );
}
