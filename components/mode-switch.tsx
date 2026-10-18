import Link from "next/link";

export function ModeSwitch({ mode }: { mode: "individual" | "teams" }) {
  return (
    <nav aria-label="Account kind" className="inline-flex rounded-full border border-line bg-surface p-1">
      <Link
        href="/"
        aria-current={mode === "individual" ? "page" : undefined}
        className={`rounded-full px-4 py-2 text-sm font-medium ${
          mode === "individual" ? "bg-forest text-background" : "text-muted"
        }`}
      >
        Individual
      </Link>
      <Link
        href="/teams"
        aria-current={mode === "teams" ? "page" : undefined}
        className={`rounded-full px-4 py-2 text-sm font-medium ${
          mode === "teams" ? "bg-forest text-background" : "text-muted"
        }`}
      >
        Teams
      </Link>
    </nav>
  );
}
