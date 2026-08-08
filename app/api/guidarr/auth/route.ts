import { NextResponse } from "next/server";
import {
  createAdminSession,
  destroySession,
  getAdminSessionFromCookies,
  verifyPassword,
} from "@/lib/guidarr/auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/guidarr/types";
import { getConfig } from "@/lib/guidarr/storage";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24,
};

/** POST — verify admin password and create session. */
export async function POST(request: Request) {
  const config = await getConfig();
  if (!config.setupComplete || !config.adminPasswordHash) {
    return NextResponse.json({ error: "Setup not completed" }, { status: 400 });
  }

  const body = (await request.json()) as { password?: string };
  const password = body.password ?? "";

  const valid = await verifyPassword(password, config.adminPasswordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = createAdminSession();
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, COOKIE_OPTIONS);
  return response;
}

/** DELETE — logout admin session. */
export async function DELETE() {
  const token = await getAdminSessionFromCookies();
  if (token) destroySession(token);

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  return response;
}

/** GET — check if admin session is active. */
export async function GET() {
  const token = await getAdminSessionFromCookies();
  const { isValidSession } = await import("@/lib/guidarr/auth");
  return NextResponse.json({ authenticated: isValidSession(token) });
}
