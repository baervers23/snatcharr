import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { getDownloadCountToday, getGrabCountToday } from "@/lib/daily-usage";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAllSettings, getSetting } from "@/lib/db/settings";
import { effectiveDownloadLimitPerDay, effectiveGrabLimitPerDay } from "@/lib/grants";
import { SETUP_ADMIN_ID } from "@/lib/setup-prefill";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

/** Writable user columns for admin PATCH (explicit — avoids stale drizzle inference in IDE). */
type UserUpdate = {
  updatedAt: Date;
  passwordHash?: string;
  isActive?: boolean | null;
  role?: "admin" | "user";
  maxGrabsPerDay?: number | null;
  maxDownloadsPerDay?: number | null;
  canGrab?: boolean | null;
  canDownload?: boolean | null;
  canUploadNzb?: boolean | null;
  canPickDownloader?: boolean | null;
  maxManualNzbPerDay?: number | null;
  email?: string | null;
  emailVerified?: boolean | null;
  ignoreSyncedLimits?: boolean | null;
  imported?: boolean | null;
  emailVerificationToken?: string | null;
  emailVerificationExpiresAt?: Date | null;
};

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(["admin", "user"]).optional(),
  maxGrabsPerDay: z.number().int().min(0).optional(),
  maxDownloadsPerDay: z.number().int().min(0).nullable().optional(),
  canGrab: z.boolean().optional(),
  canDownload: z.boolean().optional(),
  canUploadNzb: z.boolean().optional(),
  canPickDownloader: z.boolean().optional(),
  maxManualNzbPerDay: z.number().int().min(0).nullable().optional(),
  email: z.string().email().nullable().optional(),
  emailVerified: z.boolean().optional(),
  imported: z.boolean().optional(),
  password: z.string().min(8).optional(),
  ignoreSyncedLimits: z.boolean().optional(),
});

const DEFAULT_MANUAL_NZB_PER_DAY = 5;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [grabsToday, downloadsToday, grabMax, downloadMax] = await Promise.all([
    getGrabCountToday(id),
    getDownloadCountToday(id),
    effectiveGrabLimitPerDay(id),
    effectiveDownloadLimitPerDay(id),
  ]);

  const { passwordHash: _, ...safe } = user;
  return NextResponse.json({
    user: safe,
    usage: {
      grabsToday,
      downloadsToday,
      grabMax,
      downloadMax,
      grabsLeft: grabMax > 0 ? Math.max(0, grabMax - grabsToday) : null,
      downloadsLeft: downloadMax > 0 ? Math.max(0, downloadMax - downloadsToday) : null,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (parsed.data.role !== undefined) {
    if (id === SETUP_ADMIN_ID && parsed.data.role !== "admin") {
      return NextResponse.json({ error: "Cannot demote primary admin" }, { status: 400 });
    }
  }

  const { password, ...rest } = parsed.data;
  const updateData: UserUpdate = { ...rest, updatedAt: new Date() };
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 12);
  }

  if (parsed.data.ignoreSyncedLimits === false && parsed.data.maxGrabsPerDay === undefined) {
    updateData.maxGrabsPerDay = await getSetting("maxGrabsPerUserPerDay");
  }

  if (parsed.data.email !== undefined && parsed.data.email?.trim() && parsed.data.emailVerified === undefined) {
    updateData.emailVerified = true;
  }
  if (parsed.data.emailVerified === true) {
    updateData.emailVerificationToken = null;
    updateData.emailVerificationExpiresAt = null;
  }

  if (parsed.data.canUploadNzb === true && parsed.data.maxManualNzbPerDay === undefined) {
    const row = user as { maxManualNzbPerDay?: number | null };
    const current = row.maxManualNzbPerDay;
    if (current == null || current === 0) {
      const settings = await getAllSettings();
      const fromSettings = (settings as Record<string, unknown>).maxManualNzbPerUserPerDay;
      updateData.maxManualNzbPerDay =
        typeof fromSettings === "number" ? fromSettings : DEFAULT_MANUAL_NZB_PER_DAY;
    }
  }

  try {
    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({ id: users.id });

    if (!updated) {
      return NextResponse.json({ error: "User update failed" }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/unique|UNIQUE constraint/i.test(message)) {
      return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "User update failed" }, { status: 500 });
  }

  await logAudit("user.update", {
    userId: session.user.id,
    username: session.user.username,
    details: `${user.username}: ${Object.keys(parsed.data).join(", ")}`,
    req,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  await db.delete(users).where(eq(users.id, id));
  return NextResponse.json({ success: true });
}
