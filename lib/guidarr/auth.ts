import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { ADMIN_SESSION_COOKIE } from "./types";

const sessions = new Map<string, { createdAt: number }>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Hash a plaintext admin password for storage. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/** Verify a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Create a server-side admin session and return the token. */
export function createAdminSession(): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { createdAt: Date.now() });
  pruneExpiredSessions();
  return token;
}

function pruneExpiredSessions(): void {
  const now = Date.now();
  for (const [token, meta] of sessions.entries()) {
    if (now - meta.createdAt > SESSION_TTL_MS) {
      sessions.delete(token);
    }
  }
}

/** Check whether a session token is still valid. */
export function isValidSession(token: string | undefined | null): boolean {
  if (!token) return false;
  const meta = sessions.get(token);
  if (!meta) return false;
  if (Date.now() - meta.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

/** Read admin session from request cookies (server components / route handlers). */
export async function getAdminSessionFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? null;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const token = await getAdminSessionFromCookies();
  return isValidSession(token);
}
