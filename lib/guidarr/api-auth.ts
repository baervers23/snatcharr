import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "./auth";

/** Guard admin-only API routes — returns 401 response when not authenticated. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const ok = await isAdminAuthenticated();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
