import crypto from "crypto";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import { getSetting } from "./db/settings";
import { isMailConfigured, sendMail } from "./mail";
import { logAction, logActionFail } from "./audit";
import { resolvePublicBaseUrl } from "./public-url";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** Trusted email from external auth / sync — skip SMTP verification. */
export function importedEmailPatch(email: string | null | undefined): {
  emailVerified: true;
  emailVerificationToken: null;
  emailVerificationExpiresAt: null;
} | Record<string, never> {
  if (!email?.trim()) return {};
  return {
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpiresAt: null,
  };
}

/** Mark email verified when it came from Jellyfin/Seerr login or API sync. */
export function trustedExternalEmailPatch(
  email: string | null | undefined,
  trusted: boolean,
): ReturnType<typeof importedEmailPatch> {
  if (!trusted) return {};
  return importedEmailPatch(email);
}

function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function sendEmailVerification(
  userId: string,
  email: string,
  username: string,
  req?: Request,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isMailConfigured())) {
    return { ok: false, error: "SMTP is not configured — ask an admin to approve your email" };
  }

  const token = newToken();
  const expires = new Date(Date.now() + TOKEN_TTL_MS);
  await db
    .update(users)
    .set({
      emailVerificationToken: token,
      emailVerificationExpiresAt: expires,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  const hostUrlSetting = await getSetting("hostUrl");
  const hostUrl = resolvePublicBaseUrl(hostUrlSetting, req, { preferRequestHost: true });
  const instanceName = await getSetting("instanceName");
  const link = `${hostUrl}/api/auth/verify-email?token=${token}`;

  const result = await sendMail({
    to: email,
    subject: `[${instanceName}] Verify your email`,
    text: `Hi ${username},\n\nPlease verify your email for ${instanceName}:\n${link}\n\nThis link expires in 24 hours.`,
    html: `<p>Hi <strong>${username}</strong>,</p><p>Please verify your email for <strong>${instanceName}</strong>:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
  });

  if (!result.ok) {
    logActionFail("MAIL", "verify", "failed", {
      username,
      details: result.error,
    });
    return result;
  }

  logAction({
    domain: "MAIL",
    action: "verify-sent",
    outcome: "ok",
    username,
    details: email,
  });
  return { ok: true };
}

export async function verifyEmailToken(
  token: string,
): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const user = await db.query.users.findFirst({
    where: eq(users.emailVerificationToken, token),
  });
  if (!user) return { ok: false, error: "Invalid or expired verification link" };

  if (
    user.emailVerificationExpiresAt &&
    user.emailVerificationExpiresAt.getTime() < Date.now()
  ) {
    return { ok: false, error: "Verification link has expired" };
  }

  await db
    .update(users)
    .set({
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  logAction({
    domain: "AUTH",
    action: "email-verified",
    outcome: "ok",
    username: user.username,
    details: user.email ?? undefined,
  });

  return { ok: true, username: user.username };
}

export async function markEmailVerifiedFromSync(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
