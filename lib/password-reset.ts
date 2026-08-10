import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import { getSetting } from "./db/settings";
import { isMailConfigured, sendMail } from "./mail";
import { logAction, logActionFail } from "./audit";

const TOKEN_TTL_MS = 60 * 60 * 1000;

function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function sendPasswordResetEmail(
  userId: string,
  email: string,
  username: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isMailConfigured())) {
    return { ok: false, error: "SMTP is not configured" };
  }

  const token = newToken();
  const expires = new Date(Date.now() + TOKEN_TTL_MS);
  await db
    .update(users)
    .set({
      passwordResetToken: token,
      passwordResetExpiresAt: expires,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  const hostUrl = (await getSetting("hostUrl")).replace(/\/$/, "");
  const instanceName = await getSetting("instanceName");
  const link = `${hostUrl}/reset-password?token=${token}`;

  const result = await sendMail({
    to: email,
    subject: `[${instanceName}] Reset your password`,
    text: `Hi ${username},\n\nReset your ${instanceName} password:\n${link}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`,
    html: `<p>Hi <strong>${username}</strong>,</p><p>Reset your <strong>${instanceName}</strong> password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`,
  });

  if (!result.ok) {
    logActionFail("MAIL", "password-reset", "failed", {
      username,
      details: result.error,
    });
    return result;
  }

  logAction({
    domain: "MAIL",
    action: "password-reset-sent",
    outcome: "ok",
    username,
    details: email,
  });
  return { ok: true };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await db.query.users.findFirst({
    where: eq(users.passwordResetToken, token),
  });
  if (!user) return { ok: false, error: "Invalid or expired reset link" };

  if (user.passwordResetExpiresAt && user.passwordResetExpiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Reset link has expired" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(users)
    .set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  logAction({
    domain: "AUTH",
    action: "password-reset",
    outcome: "ok",
    username: user.username,
  });

  return { ok: true };
}
