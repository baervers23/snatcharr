import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { serveGrabDownload } from "@/lib/grab-download";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const fileLegacy = url.searchParams.get("file");
  const zipLegacy = url.searchParams.get("zip");

  const target = new URL("/api/download", url.origin);
  target.searchParams.set("id", id);

  if (zipLegacy !== "1" && fileLegacy !== null && fileLegacy !== "") {
    const fileIndex = Number.parseInt(fileLegacy, 10);
    if (Number.isInteger(fileIndex) && fileIndex >= 0) {
      target.searchParams.set("file", String(fileIndex));
    } else {
      return NextResponse.json(
        { error: "Use /api/download?id=<grabId>&file=<index> — file paths are no longer accepted" },
        { status: 400 },
      );
    }
  }

  return serveGrabDownload(new Request(target.toString(), req), id);
}
