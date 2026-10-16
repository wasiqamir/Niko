import { Suspense } from "react";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { Notice } from "@/components/notice";
import { ResendForm } from "@/components/resend-form";
import { prisma } from "@/lib/prisma";
import { localInboxUrl, usesDevMailbox } from "@/lib/email";

export const metadata = {
  title: "Check your email",
};

export default function CheckEmailPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AuthFrame
      title="Check your email"
      subtitle="Confirmation links expire in 24 hours. Your account opens after you confirm."
      alternate={{ href: "/login", label: "Log in" }}
    >
      <Suspense fallback={<div className="h-48 rounded-3xl bg-line/50" />}>
        <CheckEmail searchParams={props.searchParams} />
      </Suspense>
    </AuthFrame>
  );
}

async function CheckEmail({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  const sent = Array.isArray(params.sent) ? params.sent[0] : params.sent;
  const normalized = email?.trim().toLowerCase() ?? "";

  const inboxUrl = localInboxUrl();
  const mail =
    normalized && usesDevMailbox()
      ? await prisma.devMail.findFirst({
          where: { user: { email: normalized } },
          orderBy: { createdAt: "desc" },
        })
      : null;

  return (
    <div className="flex flex-col gap-5">
      {sent ? (
        <Notice tone="info">If that account still needs confirmation, a new link is waiting.</Notice>
      ) : null}

      {normalized ? (
        <p className="text-sm leading-6 text-muted">
          We sent the link to <span className="font-medium text-foreground">{normalized}</span>.
        </p>
      ) : (
        <p className="text-sm leading-6 text-muted">
          Enter your email and Niko will send another link if the account is still unconfirmed.
        </p>
      )}

      {inboxUrl ? (
        <div className="rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-4">
          <p className="text-xs font-medium tracking-wide text-accent uppercase">Local inbox</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Niko sent this through the local SMTP server. Open the inbox and use the confirmation
            link in the message.
          </p>
          <a
            href={inboxUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-foreground px-5 text-sm font-medium text-background"
          >
            Open inbox
          </a>
        </div>
      ) : null}

      {mail ? (
        <div className="rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-4">
          <p className="text-xs font-medium tracking-wide text-accent uppercase">Local inbox</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Email sending is not configured, so the confirmation link is here while you build Niko.
          </p>
          <Link
            href={mail.link}
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-foreground px-5 text-sm font-medium text-background"
          >
            Open confirmation link
          </Link>
        </div>
      ) : null}

      <ResendForm email={normalized || undefined} />

      <p className="text-sm text-muted">
        Already confirmed?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
