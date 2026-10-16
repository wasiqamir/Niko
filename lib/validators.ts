import { z } from "zod";

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name must be 80 characters or fewer."),
  email: z
    .email("Enter a valid email.")
    .trim()
    .toLowerCase()
    .max(254, "That email is too long."),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "Use 128 characters or fewer."),
  confirmPassword: z.string(),
  accountType: z.enum(["host", "participant"], {
    error: "Choose how you will use Niko.",
  }),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

export type AuthState = {
  error?: string;
  email?: string;
  unverified?: boolean;
  fieldErrors?: Partial<
    Record<"name" | "email" | "password" | "confirmPassword" | "accountType", string[]>
  >;
};

export function firstError(errors?: string[]) {
  return errors?.[0];
}
