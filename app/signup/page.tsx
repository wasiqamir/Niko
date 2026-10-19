import { Suspense } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { SignupForm } from "@/components/signup-form";
import { isAccountChoice } from "@/lib/accounts";

export const metadata = {
  title: "Create account",
};

export default function SignupPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AuthFrame
      mode="individual"
      title="Create your account"
      subtitle="Tell Niko which account you need. We'll email you a link to confirm it. Both kinds are free."
      alternate={{ href: "/login", label: "Log in" }}
    >
      <Suspense fallback={<div className="h-80 rounded-3xl bg-line/50" />}>
        <SignupLoader searchParams={props.searchParams} />
      </Suspense>
    </AuthFrame>
  );
}

async function SignupLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const type = Array.isArray(params.type) ? params.type[0] : params.type;
  return <SignupForm defaultType={isAccountChoice(type) ? type : undefined} />;
}
