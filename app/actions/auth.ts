"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { hashToken } from "@/lib/tokens";
import { sendAccountVerification, sendPasswordReset } from "@/lib/email";
import { activateTeamAfterVerify } from "@/lib/teams";
import { loginSchema, resetPasswordSchema, signupSchema, type AuthState } from "@/lib/validators";

function fieldErrors(error: {
  flatten: () => { fieldErrors: AuthState["fieldErrors"] };
}): AuthState {
  return { fieldErrors: error.flatten().fieldErrors };
}

function safeNext(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.includes("://")) return null;
  return value;
}

export async function signup(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    accountType: formData.get("accountType"),
  });

  if (!parsed.success) return fieldErrors(parsed.error);

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { fieldErrors: { confirmPassword: ["Passwords do not match."] } };
  }

  const { name, email, password, accountType } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { error: "An account with this email already exists. Log in instead." };
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        accountType: accountType === "host" ? "HOST" : "PARTICIPANT",
      },
    });

    try {
      await sendAccountVerification(user);
    } catch (error) {
      unstable_rethrow(error);
      console.error(error);
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { error: "We couldn't create your account. Try again." };
  }

  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function login(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return fieldErrors(parsed.error);

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;

    if (!user || !valid) {
      return { error: "Email or password is incorrect." };
    }

    if (!user.emailVerifiedAt) {
      return {
        error: "Confirm your email before you log in.",
        email: user.email,
        unverified: true,
      };
    }

    await createSession(user.id);
    redirect(safeNext(formData.get("next")) ?? "/home");
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { error: "We couldn't log you in. Try again." };
  }
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function resendVerification(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.pick({ email: true }).safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email." };
  }

  const email = parsed.data.email;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      const latest = await prisma.verificationToken.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      if (latest && Date.now() - latest.createdAt.getTime() < 60_000) {
        return { error: "Wait a minute before asking for another email." };
      }

      await sendAccountVerification(user);
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { error: "We couldn't send the email. Try again." };
  }

  redirect(`/check-email?email=${encodeURIComponent(email)}&sent=1`);
}

export async function requestPasswordReset(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.pick({ email: true }).safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email." };
  }

  const email = parsed.data.email;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const latest = await prisma.passwordResetToken.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
      if (!latest || Date.now() - latest.createdAt.getTime() >= 60_000) {
        await sendPasswordReset(user);
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { error: "We couldn't send the email. Try again.", email };
  }

  redirect(`/forgot-password?sent=1&email=${encodeURIComponent(email)}`);
}

export async function resetPassword(_state: AuthState, formData: FormData): Promise<AuthState> {
  const token = String(formData.get("token") ?? "");
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!token) {
    return { error: "This reset link is missing its code." };
  }
  if (!parsed.success) return fieldErrors(parsed.error);
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { fieldErrors: { confirmPassword: ["Passwords do not match."] } };
  }

  try {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!record) {
      return { error: "This link is invalid or has already been used." };
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      return { error: "This link has expired. Request a new one." };
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);
    await createSession(record.userId);
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { error: "We couldn't save that password. Try again." };
  }

  redirect("/home");
}

export async function verifyEmail(_state: AuthState, formData: FormData): Promise<AuthState> {
  const token = String(formData.get("token") ?? "");
  if (!token) {
    return { error: "This confirmation link is missing its code." };
  }

  try {
    const record = await prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!record) {
      return { error: "This link is invalid or has already been used." };
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      return { error: "This link has expired. Request a new one from the login page." };
    }

    await prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() },
    });
    await prisma.verificationToken.deleteMany({ where: { userId: record.userId } });
    try {
      await activateTeamAfterVerify(record.userId);
    } catch (error) {
      unstable_rethrow(error);
      console.error(error);
    }
    await createSession(record.userId);
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { error: "We couldn't confirm that email. Try again." };
  }

  redirect("/home");
}
