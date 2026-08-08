import { NextResponse } from "next/server";
import { serveGrabDownload } from "@/lib/grab-download";

/** GET /api/download?id=<grabId>&file=<index> — safe grab downloads (no path traversal). */
export async function GET(req: Request) {
  const grabId = new URL(req.url).searchParams.get("id")?.trim();
  if (!grabId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }
  return serveGrabDownload(req, grabId);
}
