export function Notice({
  tone,
  children,
}: {
  tone: "error" | "info";
  children: React.ReactNode;
}) {
  const className =
    tone === "error"
      ? "rounded-xl border border-warn/20 bg-warn/5 px-3 py-2 text-sm text-warn"
      : "rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-sm text-foreground";

  return <p className={className}>{children}</p>;
}
