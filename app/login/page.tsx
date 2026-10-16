import { Suspense } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Log in",
};

export default function LoginPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AuthFrame
      title="Welcome back"
      subtitle="Log in with the email you confirmed. Unconfirmed accounts stay closed."
      alternate={{ href: "/signup", label: "Create account" }}
    >
      <Suspense fallback={<div className="h-64 rounded-3xl bg-line/50" />}>
        <LoginLoader searchParams={props.searchParams} />
      </Suspense>
    </AuthFrame>
  );
}

async function LoginLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("://")
      ? next
      : undefined;

  return <LoginForm nextPath={nextPath} />;
}
