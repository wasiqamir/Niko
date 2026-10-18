"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, getOptionalUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { arrangeToday, resendMemberInvite } from "@/lib/teams";
import { hashToken } from "@/lib/tokens";

export type TeamSignupState = { error?: string };
export type TeamArrangeState = { error?: string };
export type TeamJoinState = { error?: string };

const person = z.object({
  name: z.string().trim().min(2, "Write each person's name.").max(80),
  email: z.email("Write a valid email for each person.").trim().toLowerCase(),
});

const creator = z.object({
  name: z.string().trim().min(2, "Write your name.").max(80),
  email: z.email("Enter a valid email.").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
  confirmPassword: z.string(),
  teamName: z.string().trim().min(2, "Give the team a name.").max(80),
});

export async function createTeamAccount(
  _state: TeamSignupState,
  formData: FormData,
): Promise<TeamSignupState> {
  const parsed = creator.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    teamName: formData.get("teamName"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const names = formData.getAll("memberName").map((value) => String(value));
  const emails = formData.getAll("memberEmail").map((value) => String(value));
  const members = names
    .map((name, index) => ({ name, email: emails[index] ?? "" }))
    .filter((member) => member.name.trim() || member.email.trim());

  if (members.length < 1) return { error: "Add at least one person to the team." };
  if (members.length > 12) return { error: "A team can include up to 12 other people." };

  const checked = [];
  for (const member of members) {
    const result = person.safeParse(member);
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Check each person and try again." };
    checked.push(result.data);
  }

  const lowered = checked.map((member) => member.email);
  if (new Set(lowered).size !== lowered.length) return { error: "Each person needs a different email." };
  if (lowered.includes(parsed.data.email)) return { error: "Your email is the team creator. Add the other people." };

  const { name, email, password, teamName } = parsed.data;

  try {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) return { error: "An account with this email already exists. Log in instead." };

    const alreadyOnTeam = await prisma.teamMember.findFirst({
      where: { email: { in: lowered } },
      select: { email: true },
    });
    if (alreadyOnTeam) return { error: `${alreadyOnTeam.email} is already on a team.` };

    const alreadyOwns = await prisma.team.findFirst({
      where: { owner: { email: { in: lowered } } },
      include: { owner: { select: { email: true } } },
    });
    if (alreadyOwns) return { error: `${alreadyOwns.owner.email} is already on a team.` };

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        accountType: "HOST",
        ownedTeam: {
          create: {
            name: teamName,
            status: "PENDING",
            members: {
              create: checked.map((member) => ({
                name: member.name,
                email: member.email,
                status: "PENDING",
              })),
            },
          },
        },
      },
    });

    const { sendAccountVerification } = await import("@/lib/email");
    try {
      await sendAccountVerification(user);
    } catch (error) {
      unstable_rethrow(error);
      console.error(error);
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { error: "We couldn't create the team. Try again." };
  }

  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function arrangeTeamMeeting(
  _state: TeamArrangeState,
  _formData: FormData,
): Promise<TeamArrangeState> {
  const user = await getCurrentUser();
  try {
    const result = await arrangeToday(user.id);
    if (result.error) return { error: result.error };
    redirect(result.mailed ? "/home?notice=team" : "/home?notice=team-mail");
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { error: "We couldn't arrange today's meeting. Try again." };
  }
}

export async function resendTeamInvite(formData: FormData) {
  const user = await getCurrentUser();
  const memberId = String(formData.get("memberId") ?? "");
  try {
    const result = await resendMemberInvite(user.id, memberId);
    if (result.error) redirect(`/home?notice=invite-wait`);
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    redirect("/home?notice=invite-mail");
  }
  redirect("/home?notice=invite");
}

export async function joinTeam(_state: TeamJoinState, formData: FormData): Promise<TeamJoinState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "This invite is missing its code." };

  try {
    const member = await prisma.teamMember.findUnique({
      where: { inviteTokenHash: hashToken(token) },
      include: { team: true },
    });
    if (!member || member.status !== "PENDING" || member.team.status !== "ACTIVE") {
      return { error: "This invite is invalid or has already been used." };
    }
    if (!member.inviteExpiresAt || member.inviteExpiresAt.getTime() <= Date.now()) {
      return { error: "This invite has expired. Ask the team creator to send it again." };
    }

    const session = await getOptionalUser();
    if (session) {
      if (session.email.toLowerCase() !== member.email) {
        return { error: `Log in as ${member.email} to join this team.` };
      }
      await acceptInvite(member.id, session.id);
      redirect("/home");
    }

    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    if (password.length < 8 || password.length > 128) return { error: "Use at least 8 characters." };
    if (password !== confirmPassword) return { error: "Passwords do not match." };

    const existing = await prisma.user.findUnique({ where: { email: member.email } });
    if (existing) {
      return { error: "This email already has an account. Log in, then open the invite again." };
    }

    const user = await prisma.user.create({
      data: {
        name: member.name,
        email: member.email,
        passwordHash: await hashPassword(password),
        accountType: "HOST",
        emailVerifiedAt: new Date(),
      },
    });
    await acceptInvite(member.id, user.id);
    await createSession(user.id);
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { error: "We couldn't add you to the team. Try again." };
  }

  redirect("/home");
}

async function acceptInvite(memberId: string, userId: string) {
  await prisma.$transaction([
    prisma.teamMember.update({
      where: { id: memberId },
      data: {
        userId,
        status: "ACTIVE",
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { accountType: "HOST" },
    }),
  ]);
}
