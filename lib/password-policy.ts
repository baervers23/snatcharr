import { z } from "zod";

export const SIGNUP_PASSWORD_MIN_LENGTH = 10;

/** At least 10 chars, one digit, one special character. */
export const signupPasswordSchema = z
  .string()
  .min(SIGNUP_PASSWORD_MIN_LENGTH, `Password must be at least ${SIGNUP_PASSWORD_MIN_LENGTH} characters`)
  .regex(/\d/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character");

export function validateSignupPassword(password: string): string | null {
  const result = signupPasswordSchema.safeParse(password);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? "Invalid password";
}

export function meetsSignupPassword(password: string): boolean {
  return validateSignupPassword(password) === null;
}

export function isValidSignupEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  return z.string().email().safeParse(trimmed).success;
}

export const SIGNUP_PASSWORD_HINT =
  "At least 10 characters, including one number and one special character.";
