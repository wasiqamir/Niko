import Link from "next/link";

const options = [
  { href: "/signup", mode: "individual", label: "Individual" },
  { href: "/teams", mode: "teams", label: "Teams" },
] as const;

export function ModeSwitch({ mode = "home" }: { mode?: "home" | "individual" | "teams" }) {
  return (
    <nav aria-label="Account kind" className="mode-switch">
      {options.map((option) => (
        <Link
          key={option.mode}
          href={option.href}
          aria-current={mode === option.mode ? "page" : undefined}
          className={mode === option.mode ? "is-current" : undefined}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
