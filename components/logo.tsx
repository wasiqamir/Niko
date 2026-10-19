import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 text-foreground transition hover:opacity-80">
      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-forest text-background shadow-md">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M3 4.5h6.2a2.8 2.8 0 0 1 0 5.6H6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="11.6" cy="11.6" r="1.35" fill="currentColor" />
        </svg>
      </span>
      <span className="font-serif text-xl tracking-tight">Niko</span>
    </Link>
  );
}
