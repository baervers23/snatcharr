import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { grabs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit, logEvent, logActionFail } from "@/lib/audit";
import { deleteGrabFiles } from "@/lib/grab-files";
import { getSetting } from "@/lib/db/settings";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { isPublic?: boolean };

  const grab = await db.query.grabs.findFirst({ where: eq(grabs.id, id) });
  if (!grab) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the owner or admin can update
  if (grab.userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Partial<typeof grab> = {};
  if (typeof body.isPublic === "boolean") updates.isPublic = body.isPublic;

  await db.update(grabs).set(updates).where(eq(grabs.id, id));

  if (typeof body.isPublic === "boolean") {
    logEvent("grab.visibility", {
      userId: session.user.id,
      username: session.user.username,
      details: `${grab.title} → ${body.isPublic ? "public" : "hidden"}`,
      req,
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const grab = await db.query.grabs.findFirst({ where: eq(grabs.id, id) });

  if (!grab) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (grab.userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const downloadBase = await getSetting("downloadDir");
  const fileResult = deleteGrabFiles(grab, downloadBase);
  if (fileResult.path && !fileResult.deleted) {
    logActionFail("GRAB", "delete", "failed", {
      username: session.user.username,
      details: `"${grab.title}" at ${fileResult.path}`,
      error: fileResult.error,
      req,
    });
    return NextResponse.json(
      { error: "Could not delete files from disk — grab record kept" },
      { status: 500 },
    );
  }

  await db.delete(grabs).where(eq(grabs.id, id));
  if (session.user.role === "admin") {
    await logAudit("grab.delete", {
      userId: session.user.id,
      username: session.user.username,
      details: grab.title,
      req,
    });
  } else {
    logEvent("grab.delete", {
      userId: session.user.id,
      username: session.user.username,
      details: grab.title,
      req,
    });
  }
  return NextResponse.json({ success: true });
}
