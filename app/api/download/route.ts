import { NextResponse } from "next/server";
import { serveGrabDownload } from "@/lib/grab-download";

export async function GET(req: Request) {
  const grabId = new URL(req.url).searchParams.get("id")?.trim();
  if (!grabId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }
  return serveGrabDownload(req, grabId);
}
