import "server-only";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export async function getOptionalUser() {
  const user = await getSessionUser();
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    accountType: user.accountType,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

export async function getCurrentUser() {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  if (!user.emailVerifiedAt) {
    redirect(`/check-email?email=${encodeURIComponent(user.email)}`);
  }
  return user;
}
