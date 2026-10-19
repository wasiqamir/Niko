export function Notice({
  tone,
  children,
}: {
  tone: "error" | "info";
  children: React.ReactNode;
}) {
  const className =
    tone === "error"
      ? "rounded-2xl border border-warn/20 bg-warn/5 px-4 py-3 text-sm text-warn"
      : "rounded-2xl border border-accent/20 bg-foam px-4 py-3 text-sm text-foreground";

  return <p className={className}>{children}</p>;
}
