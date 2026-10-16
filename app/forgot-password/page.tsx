import { Suspense } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AuthFrame
      title="Set a new password"
      subtitle="Enter the email on your account. Niko will send a link that lets you choose a new password."
      alternate={{ href: "/login", label: "Log in" }}
    >
      <Suspense fallback={<div className="h-48 rounded-3xl bg-line/50" />}>
        <ForgotPassword searchParams={props.searchParams} />
      </Suspense>
    </AuthFrame>
  );
}

async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  const sent = (Array.isArray(params.sent) ? params.sent[0] : params.sent) === "1";

  return <ForgotPasswordForm email={email?.trim().toLowerCase()} sent={sent} />;
}
