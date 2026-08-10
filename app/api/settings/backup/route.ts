import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildSettingsBackup } from "@/lib/settings-backup";
import { SETUP_ADMIN_ID } from "@/lib/setup-prefill";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.user.id !== SETUP_ADMIN_ID) {
    return NextResponse.json(
      { error: "Only the primary administrator can download backups" },
      { status: 403 },
    );
  }

  const backup = await buildSettingsBackup();
  const filename = `snatcharr-settings-${new Date().toISOString().slice(0, 10)}.json`;

  await logAudit("settings.backup.export", {
    userId: session.user.id,
    username: session.user.username,
    req,
  });

  return new NextResponse(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
