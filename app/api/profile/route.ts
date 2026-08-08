import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logAction, logActionFail } from "@/lib/audit";
import { getSetting } from "@/lib/db/settings";
import { sendEmailVerification } from "@/lib/email-verification";

const profileSchema = z.object({
  showGrabsPublic: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  email: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" ? null : value)),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: {
      email: true,
      showGrabsPublic: true,
      hideMyGrabs: true,
      emailNotifications: true,
      avatarUrl: true,
      emailVerified: true,
    },
  });

  return NextResponse.json({ profile: user });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    logActionFail("PROFILE", "update", "aborted", {
      username: session.user.username,
      details: "invalid data",
      req,
    });
    return NextResponse.json({ error: "Invalid data" }, { status: 422 });
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { email: true, emailVerified: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let sendVerifyTo: string | null = null;
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (parsed.data.showGrabsPublic !== undefined) {
    patch.showGrabsPublic = parsed.data.showGrabsPublic;
    patch.hideMyGrabs = !parsed.data.showGrabsPublic;
  }
  if (parsed.data.emailNotifications !== undefined) {
    patch.emailNotifications = parsed.data.emailNotifications;
  }

  if (parsed.data.email !== undefined) {
    const current = existing.email?.trim();
    const next = parsed.data.email?.trim() ?? "";
    if (current) {
      if (next && next.toLowerCase() !== current.toLowerCase()) {
        logActionFail("PROFILE", "update", "denied", {
          username: session.user.username,
          details: "email locked",
          req,
        });
        return NextResponse.json(
          { error: "Email cannot be changed once it is set" },
          { status: 403 },
        );
      }
    } else if (next) {
      patch.email = next;
      sendVerifyTo = next;
      patch.emailVerified = false;
    }
  }

  try {
    const [updated] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, session.user.id))
      .returning({ id: users.id });

    if (!updated) {
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/unique|UNIQUE constraint/i.test(message)) {
      return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    }
    logActionFail("PROFILE", "update", "failed", {
      username: session.user.username,
      details: message,
      req,
    });
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  if (sendVerifyTo && (await getSetting("requireEmail"))) {
    void sendEmailVerification(session.user.id, sendVerifyTo, session.user.username, req);
  }

  logAction({
    domain: "PROFILE",
    action: "update",
    outcome: "ok",
    username: session.user.username,
    details: Object.keys(parsed.data).join(", "),
    req,
    level: "debug",
  });

  return NextResponse.json({ success: true });
}
