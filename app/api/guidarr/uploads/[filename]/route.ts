import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { GUIDARR_UPLOADS_DIR } from "@/lib/guidarr/paths";

type RouteContext = { params: Promise<{ filename: string }> };

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/** GET — serve uploaded Guidarr images. */
export async function GET(_request: Request, context: RouteContext) {
  const { filename } = await context.params;

  if (filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(GUIDARR_UPLOADS_DIR, filename);
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    return new NextResponse(data, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
