import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { restoreSettingsBackup } from "@/lib/settings-backup";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await req.json();
    await restoreSettingsBackup(payload);

    await logAudit("settings.backup.restore", {
      userId: session.user.id,
      username: session.user.username,
      req,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Restore failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
