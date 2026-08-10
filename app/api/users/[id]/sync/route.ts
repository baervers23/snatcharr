import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getHealthySyncApps, syncUserFromExternalApps } from "@/lib/user-sync";
import { logAudit, logActionFail } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { z } from "zod";
const syncSchema = z.object({
  source: z.enum(["jellyfin", "seerr"]),
});
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    logActionFail("SYNC", "user", "denied", { username: session?.user?.username, req });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    logActionFail("SYNC", "user", "aborted", {
      username: session.user.username,
      details: "invalid request",
      req,
    });
    return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) {
    logActionFail("SYNC", "user", "failed", {
      username: session.user.username,
      details: "user not found",
      req,
    });
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const { source } = parsed.data;
  const { jellyfin, seerr } = await getHealthySyncApps([source]);
  const app = source === "jellyfin" ? jellyfin : seerr;
  if (!app) {
    logActionFail("SYNC", "user", "failed", {
      username: session.user.username,
      details: `no enabled ${source} app — ${user.username}`,
      req,
    });
    return NextResponse.json(
      { error: `No enabled ${source} app with API key configured.` },
      { status: 503 },
    );
  }
  const syncResult = await syncUserFromExternalApps(user, source);
  if (!syncResult.ok) {
    logActionFail("SYNC", "user", "failed", {
      username: session.user.username,
      details: `${user.username} from ${source}`,
      error: syncResult.error,
      req,
    });
    return NextResponse.json({ error: syncResult.error ?? "Sync failed" }, { status: 400 });
  }
  await db
    .update(users)
    .set({ canGrab: true, canDownload: true, imported: true, updatedAt: new Date() })
    .where(eq(users.id, id));
  const updated = await db.query.users.findFirst({ where: eq(users.id, id) });
  await logAudit("user.sync", {
    userId: session.user.id,
    username: session.user.username,
    details: `${user.username} from ${source}`,
    req,
  });
  return NextResponse.json({
    success: true,
    email: updated?.email ?? syncResult.email,
    avatarUrl: updated?.avatarUrl ?? syncResult.avatarUrl,
    jellyfinUserId: updated?.jellyfinUserId ?? user.jellyfinUserId,
  });
}
