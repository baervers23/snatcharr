import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { grabs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  canAccessGrab,
  getGrabDir,
  listGrabFiles,
  prepareGrabDirectory,
} from "@/lib/grab-files";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const grab = await db.query.grabs.findFirst({ where: eq(grabs.id, id) });
  if (!grab) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canAccessGrab(grab, { id: session.user.id, role: session.user.role })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (grab.status !== "completed") {
    return NextResponse.json({
      files: [],
      ready: false,
      error:
        grab.status === "processing"
          ? "Files are still being unpacked and moved — try again in a moment."
          : undefined,
    });
  }

  const dir = getGrabDir(grab);
  if (!dir) {
    return NextResponse.json({
      files: [],
      ready: false,
      error: "Download folder is not accessible from Snatcharr (check the shared volume).",
    });
  }

  prepareGrabDirectory(dir, grab.nzbPassword);
  const files = listGrabFiles(dir);
  return NextResponse.json(
    { files, ready: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
