import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAllSettings } from "@/lib/db/settings";
import { sendTestEmail } from "@/lib/mail";
import { logAction, logActionFail } from "@/lib/audit";

const testSchema = z.object({
  to: z.string().email().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpFrom: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    logActionFail("MAIL", "test", "denied", { username: session?.user?.username, req });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = testSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    logActionFail("MAIL", "test", "aborted", {
      username: session.user.username,
      details: "invalid data",
      req,
    });
    return NextResponse.json({ error: "Invalid data" }, { status: 422 });
  }

  let to = body.data.to?.trim();
  if (!to) {
    const admin = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { email: true },
    });
    to = admin?.email?.trim();
  }
  if (!to) {
    logActionFail("MAIL", "test", "aborted", {
      username: session.user.username,
      details: "no recipient email",
      req,
    });
    return NextResponse.json(
      { error: "Provide a test recipient email (or set your admin email)" },
      { status: 422 },
    );
  }

  const stored = await getAllSettings();
  const password =
    body.data.smtpPassword && body.data.smtpPassword !== "***"
      ? body.data.smtpPassword
      : stored.smtpPassword;

  const result = await sendTestEmail(to, {
    host: body.data.smtpHost,
    port: body.data.smtpPort,
    user: body.data.smtpUser,
    password,
    from: body.data.smtpFrom,
  });

  if (!result.ok) {
    logActionFail("MAIL", "test", "failed", {
      username: session.user.username,
      details: `to ${to}`,
      error: result.error,
      req,
    });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  logAction({
    domain: "MAIL",
    action: "test",
    outcome: "ok",
    username: session.user.username,
    details: `sent to ${to}`,
    req,
  });

  return NextResponse.json({ success: true, to });
}
