import { NextResponse } from "next/server";
import path from "path";
import { writeFile } from "fs/promises";
import { requireAdmin } from "@/lib/guidarr/api-auth";
import { ensureGuidarrDataDir } from "@/lib/guidarr/storage";
import { GUIDARR_UPLOADS_DIR } from "@/lib/guidarr/paths";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

/** POST — upload image for background or group icon (admin). */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const ext = path.extname(file.name) || ".png";
  const filename = `${randomUUID()}${ext}`;
  await ensureGuidarrDataDir();
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(GUIDARR_UPLOADS_DIR, filename), buffer);

  const url = `/api/guidarr/uploads/${filename}`;
  return NextResponse.json({ url, filename });
}
