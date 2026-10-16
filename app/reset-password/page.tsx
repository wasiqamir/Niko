import { Suspense } from "react";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata = {
  title: "New password",
};

export default function ResetPasswordPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AuthFrame
      title="Choose a new password"
      subtitle="The email link only opens this page. Your password changes after you press the button."
      alternate={{ href: "/login", label: "Log in" }}
    >
      <Suspense fallback={<div className="h-48 rounded-3xl bg-line/50" />}>
        <ResetPassword searchParams={props.searchParams} />
      </Suspense>
    </AuthFrame>
  );
}

async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  if (!token) {
    return (
      <div className="flex flex-col gap-4 text-sm leading-6 text-muted">
        <p>This link is missing its reset code.</p>
        <Link href="/forgot-password" className="font-medium text-foreground underline underline-offset-4">
          Request a new email
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
