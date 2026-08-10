import fs from "fs";
import path from "path";
import { ensureAppDataDir } from "./paths";

export function getAvatarsDir(): string {
  const dir = path.join(ensureAppDataDir(), "avatars");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function extFromContentType(ct: string | null): string {
  if (!ct) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

/** Download avatar bytes and store under data/avatars — returns a same-origin API path. */
export async function cacheUserAvatar(
  userId: string,
  sourceUrl: string,
  init?: RequestInit,
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      ...init,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 64) return null;

    const ext = extFromContentType(res.headers.get("content-type"));
    const filename = `${userId}.${ext}`;
    const filePath = path.join(getAvatarsDir(), filename);
    fs.writeFileSync(filePath, buf);

    // Remove other extensions for this user id.
    for (const other of ["jpg", "jpeg", "png", "webp", "gif"]) {
      if (other === ext) continue;
      const stale = path.join(getAvatarsDir(), `${userId}.${other}`);
      if (fs.existsSync(stale)) fs.unlinkSync(stale);
    }

    return `/api/avatars/${filename}`;
  } catch {
    return null;
  }
}
