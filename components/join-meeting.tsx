"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function JoinMeeting({
  href,
  endsAt,
  label = "Join meeting",
  large = false,
}: {
  href: string;
  endsAt: string;
  label?: string;
  large?: boolean;
}) {
  const end = new Date(endsAt).getTime();
  const [ended, setEnded] = useState(() => Date.now() >= end);

  useEffect(() => {
    const tick = () => setEnded(Date.now() >= end);
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [end]);

  const size = large ? "h-12 w-full justify-center" : "mt-3 h-10";

  if (ended) {
    return (
      <p
        className={`inline-flex items-center rounded-xl bg-line px-4 text-sm font-medium text-muted ${size}`}
      >
        Meeting is ended
      </p>
    );
  }

  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full bg-forest px-4 text-sm font-medium text-background transition hover:-translate-y-0.5 hover:bg-accent ${large ? "h-12 w-full justify-center px-5" : "mt-3 h-10"}`}
    >
      {label}
    </Link>
  );
}
