import { Suspense } from "react";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { VerifyForm } from "@/components/verify-form";

export const metadata = {
  title: "Confirm email",
};

export default function VerifyEmailPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AuthFrame
      title="Confirm your email"
      subtitle="Niko waits for this button, so a preview of the link cannot open the account by itself."
      alternate={{ href: "/login", label: "Log in" }}
    >
      <Suspense fallback={<div className="h-24 rounded-3xl bg-line/50" />}>
        <VerifyEmail searchParams={props.searchParams} />
      </Suspense>
    </AuthFrame>
  );
}

async function VerifyEmail({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  if (!token) {
    return (
      <div className="flex flex-col gap-4 text-sm leading-6 text-muted">
        <p>This link is missing its confirmation code.</p>
        <Link href="/check-email" className="font-medium text-foreground underline underline-offset-4">
          Request a new email
        </Link>
      </div>
    );
  }

  return <VerifyForm token={token} />;
}
