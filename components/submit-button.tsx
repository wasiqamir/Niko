"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  fullWidth = true,
}: {
  children: string;
  pendingLabel: string;
  variant?: "primary" | "ghost";
  fullWidth?: boolean;
}) {
  const { pending } = useFormStatus();
  const className =
    variant === "primary"
      ? `inline-flex h-12 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-medium text-background transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 ${fullWidth ? "w-full" : ""}`
      : "text-sm font-medium underline decoration-line underline-offset-4 hover:decoration-foreground disabled:opacity-60";

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
