import { Suspense } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export function AccountHeader() {
  return (
    <header className="flex items-center justify-between gap-4 py-5">
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
    <div className="flex items-center gap-4">
      {user.accountType === "PARTICIPANT" ? (
        <Link href="/book" className="text-sm font-medium">
          Find a host
        </Link>
      ) : (
        <Link href="/links/new" className="text-sm font-medium">
          Create link
        </Link>
      )}
      <span className="hidden text-sm text-muted sm:inline">{user.email}</span>
      <form action={logout}>
        <button type="submit" className="text-sm font-medium">
          Log out
        </button>
      </form>
    </div>
  );
}
