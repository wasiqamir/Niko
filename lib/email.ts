import "server-only";

import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { hashToken, randomToken } from "@/lib/tokens";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function usesDevMailbox() {
  return process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST;
}

export function localInboxUrl() {
  const url = process.env.SMTP_WEB_URL?.trim();
  if (!url || process.env.NODE_ENV === "production") return null;
  return url;
}

export function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

type Recipient = {
  id: string;
  email: string;
  name: string;
};

type OutgoingMail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  userId?: string;
  link?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function deliver(mail: OutgoingMail) {
  if (process.env.SMTP_HOST) {
    if (!process.env.SMTP_FROM) {
      throw new Error("SMTP_FROM is required when SMTP_HOST is set.");
    }

    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      ignoreTLS: process.env.SMTP_IGNORE_TLS === "true",
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });

    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return;
  }

  if (process.env.NODE_ENV === "production" || !mail.userId || !mail.link) {
    throw new Error("Email is not configured.");
  }

  await prisma.devMail.create({
    data: {
      userId: mail.userId,
      subject: mail.subject,
      body: mail.text,
      link: mail.link,
    },
  });
}

export async function sendAccountVerification(user: Recipient) {
  await prisma.verificationToken.deleteMany({ where: { userId: user.id } });

  const token = randomToken();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + DAY_MS),
    },
  });

  const link = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "Confirm your Niko email";
  const body = [
    `Hi ${user.name},`,
    "",
    "Confirm your email to open your Niko account:",
    link,
    "",
    "This link expires in 24 hours. If you did not sign up, you can ignore this email.",
  ].join("\n");

  await deliver({
    to: user.email,
    subject,
    text: body,
    userId: user.id,
    link,
  });
}

export async function sendPasswordReset(user: Recipient) {
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = randomToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + HOUR_MS),
    },
  });

  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Set a new Niko password";
  const text = [
    `Hi ${user.name},`,
    "",
    "Set a new password for your Niko account:",
    link,
    "",
    "This link expires in 1 hour. It changes your password only after you press the button on that page.",
    "If you did not ask for this, you can ignore this email.",
  ].join("\n");
  const html = `
    <p>Hi ${escapeHtml(user.name)},</p>
    <p>Set a new password for your Niko account.</p>
    <p><a href="${escapeHtml(link)}">Set a new password</a></p>
    <p>This link expires in 1 hour. It changes your password only after you press the button on that page.</p>
    <p>If you did not ask for this, you can ignore this email.</p>
  `;

  await deliver({
    to: user.email,
    subject,
    text,
    html,
    userId: user.id,
    link,
  });
}

export async function sendMeetingBookedEmail(input: {
  host: Recipient;
  participant: Recipient;
  when: string;
  declineUrl: string;
  callUrl: string;
}) {
  const subject = `${input.participant.name} booked a meeting with you`;
  const text = [
    `Hi ${input.host.name},`,
    "",
    `${input.participant.name} booked a meeting with you.`,
    "",
    `Name: ${input.participant.name}`,
    `Email: ${input.participant.email}`,
    `Time: ${input.when}`,
    "",
    "Join the meeting:",
    input.callUrl,
    "",
    "The meeting is on your schedule. If this time is not possible, open the link and press Not possible:",
    input.declineUrl,
    "",
    "If you do nothing, the meeting stays scheduled.",
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(input.host.name)},</p>
    <p><strong>${escapeHtml(input.participant.name)}</strong> booked a meeting with you.</p>
    <p>
      Name: ${escapeHtml(input.participant.name)}<br />
      Email: ${escapeHtml(input.participant.email)}<br />
      Time: ${escapeHtml(input.when)}
    </p>
    <p>The meeting is on your schedule. Enter the live room when you are ready.</p>
    <p><a href="${escapeHtml(input.callUrl)}">Join meeting</a></p>
    <p>If this time is not possible, press the button. If you do nothing, the meeting stays scheduled.</p>
    <p><a href="${escapeHtml(input.declineUrl)}">Not possible</a></p>
  `;

  await deliver({
    to: input.host.email,
    subject,
    text,
    html,
    userId: input.host.id,
    link: input.declineUrl,
  });
}

export async function sendMeetingDeclinedEmail(input: {
  host: Recipient;
  participant: Recipient;
  when: string;
  rebookUrl: string;
}) {
  const subject = `${input.host.name} is not available at that time`;
  const text = [
    `Hi ${input.participant.name},`,
    "",
    `${input.host.name} is not available at this time:`,
    input.when,
    "",
    "Choose another time:",
    input.rebookUrl,
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(input.participant.name)},</p>
    <p><strong>${escapeHtml(input.host.name)}</strong> is not available at this time:</p>
    <p>${escapeHtml(input.when)}</p>
    <p><a href="${escapeHtml(input.rebookUrl)}">Choose another time</a></p>
  `;

  await deliver({
    to: input.participant.email,
    subject,
    text,
    html,
    userId: input.participant.id,
    link: input.rebookUrl,
  });
}

export async function sendMeetingLinkJoinedEmail(input: {
  host: Recipient;
  participant: Recipient;
  title: string;
  when: string;
  spots: string;
}) {
  const subject = `${input.participant.name} joined ${input.title}`;
  const text = [
    `Hi ${input.host.name},`,
    "",
    `${input.participant.name} joined your meeting.`,
    "",
    `Meeting: ${input.title}`,
    `Name: ${input.participant.name}`,
    `Email: ${input.participant.email}`,
    `Time: ${input.when}`,
    `Places: ${input.spots}`,
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(input.host.name)},</p>
    <p><strong>${escapeHtml(input.participant.name)}</strong> joined your meeting.</p>
    <p>
      Meeting: ${escapeHtml(input.title)}<br />
      Name: ${escapeHtml(input.participant.name)}<br />
      Email: ${escapeHtml(input.participant.email)}<br />
      Time: ${escapeHtml(input.when)}<br />
      Places: ${escapeHtml(input.spots)}
    </p>
  `;

  await deliver({
    to: input.host.email,
    subject,
    text,
    html,
    userId: input.host.id,
  });
}

export async function sendMeetingReminderEmail(input: {
  to: Recipient;
  withName: string;
  when: string;
  callUrl: string;
}) {
  const subject = `Your meeting with ${input.withName} starts in 2 minutes`;
  const text = [
    `Hi ${input.to.name},`,
    "",
    `Your meeting with ${input.withName} starts in 2 minutes.`,
    `Time: ${input.when}`,
    "",
    "Join the meeting:",
    input.callUrl,
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(input.to.name)},</p>
    <p>Your meeting with <strong>${escapeHtml(input.withName)}</strong> starts in 2 minutes.</p>
    <p>Time: ${escapeHtml(input.when)}</p>
    <p><a href="${escapeHtml(input.callUrl)}">Join meeting</a></p>
  `;

  await deliver({
    to: input.to.email,
    subject,
    text,
    html,
    userId: input.to.id,
    link: input.callUrl,
  });
}

export async function sendMeetingLinkCancelledEmail(input: {
  host: Recipient;
  participant: Recipient;
  title: string;
  when: string;
}) {
  const subject = `${input.host.name} cancelled ${input.title}`;
  const text = [
    `Hi ${input.participant.name},`,
    "",
    `${input.host.name} cancelled this meeting:`,
    input.title,
    input.when,
    "",
    "That time is open again.",
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(input.participant.name)},</p>
    <p><strong>${escapeHtml(input.host.name)}</strong> cancelled this meeting:</p>
    <p>${escapeHtml(input.title)}<br />${escapeHtml(input.when)}</p>
    <p>That time is open again.</p>
  `;

  await deliver({
    to: input.participant.email,
    subject,
    text,
    html,
    userId: input.participant.id,
  });
}
