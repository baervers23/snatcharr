import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runBackgroundTaskById } from "@/lib/tasks";
import { logAudit } from "@/lib/audit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const lastRunAt = await runBackgroundTaskById(id);
    await logAudit("task.run", {
      userId: session.user.id,
      username: session.user.username,
      details: id,
    });
    return NextResponse.json({ success: true, lastRunAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Task failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
