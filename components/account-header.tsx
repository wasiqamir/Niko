import { Suspense } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export function AccountHeader() {
  return (
    <header className="site-header">
      <Logo href="/home" />
      <Suspense fallback={<div className="h-5 w-40 rounded bg-line" />}>
        <AccountMenu />
      </Suspense>
    </header>
  );
}

async function AccountMenu() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 sm:gap-x-4">
      {user.accountType === "PARTICIPANT" ? (
        <Link href="/book" className="text-sm font-medium transition hover:text-accent">
          Find a host
        </Link>
      ) : (
        <Link href="/links/new" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-background transition hover:bg-accent">
          Create link
        </Link>
      )}
      <span className="hidden text-sm text-muted sm:inline">{user.email}</span>
      <form action={logout}>
        <button type="submit" className="text-sm font-medium transition hover:text-accent">
          Log out
        </button>
      </form>
    </div>
  );
}
