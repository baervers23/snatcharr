import fs from "fs";
import path from "path";
import type { Grab } from "./db/schema";
import {
  hardenGrabDirectory,
  isExecutableFilename,
  shouldExcludeGrabFile,
  isPathInsideDir,
  isZoneIdentifierFile,
} from "./grab-file-security";
import { getDownloadDir } from "./paths";

export const GRAB_PASSWORD_FILENAME = "password.txt";

export function canAccessGrab(
  grab: Pick<Grab, "userId" | "isPublic">,
  user: { id: string; role: string },
): boolean {
  return grab.userId === user.id || user.role === "admin" || !!grab.isPublic;
}

function statDir(candidate: string): string | null {
  try {
    const st = fs.statSync(candidate);
    return st.isDirectory() ? candidate : null;
  } catch {
    return null;
  }
}

function lastSegment(p: string): string {
  const norm = p.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = norm.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function dirInsideDownloadBase(dir: string, downloadBase: string): string | null {
  if (!isPathInsideDir(downloadBase, dir)) return null;
  return dir;
}

export function getGrabDir(
  grab: Pick<Grab, "storagePath" | "archivePath" | "title">,
): string | null {
  const downloadBase = getDownloadDir().replace(/[\\/]+$/, "");
  const candidate = grab.storagePath || grab.archivePath;

  if (candidate) {
    const direct = statDir(candidate);
    if (direct) return dirInsideDownloadBase(direct, downloadBase);

    const remapped = statDir(path.join(downloadBase, lastSegment(candidate)));
    if (remapped) return dirInsideDownloadBase(remapped, downloadBase);
  }

  if (grab.title) {
    const guess = statDir(path.join(downloadBase, grab.title));
    if (guess) return dirInsideDownloadBase(guess, downloadBase);
  }

  return null;
}

/** Resolve grab folder for cleanup — tries paths outside the download mount too. */
export function resolveGrabDirForCleanup(
  grab: Pick<Grab, "storagePath" | "archivePath" | "title">,
  downloadBase?: string,
): string | null {
  const safe = getGrabDir(grab);
  if (safe) return safe;

  const base = (downloadBase ?? getDownloadDir()).replace(/[\\/]+$/, "");
  const candidate = grab.storagePath || grab.archivePath;

  if (candidate) {
    const direct = statDir(candidate);
    if (direct) return direct;

    try {
      const st = fs.statSync(candidate);
      if (st.isFile()) {
        const parent = path.dirname(candidate);
        if (statDir(parent)) return parent;
      }
    } catch {
      // path does not exist
    }

    const remapped = statDir(path.join(base, lastSegment(candidate)));
    if (remapped) return remapped;
  }

  if (grab.title) {
    const guess = statDir(path.join(base, grab.title));
    if (guess) return guess;
  }

  return null;
}

export function deleteGrabFiles(
  grab: Pick<Grab, "storagePath" | "archivePath" | "title">,
  downloadBase?: string,
): { deleted: boolean; path: string | null; error?: string } {
  const dir = resolveGrabDirForCleanup(grab, downloadBase);
  if (!dir) return { deleted: false, path: null };
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return { deleted: true, path: dir };
  } catch (err) {
    return {
      deleted: false,
      path: dir,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface GrabFileEntry {
  index: number;
  relativePath: string;
  name: string;
  sizeBytes: number;
}

function isSafeRelativePath(relativePath: string): boolean {
  if (!relativePath || relativePath.includes("\0")) return false;
  const norm = relativePath.replace(/\\/g, "/");
  if (norm.startsWith("/") || norm.includes("..")) return false;
  return true;
}

export function listGrabFiles(dir: string, subdir = ""): GrabFileEntry[] {
  if (subdir && !isSafeRelativePath(subdir)) return [];

  const current = subdir ? path.join(dir, subdir) : dir;
  if (!isPathInsideDir(dir, current)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(current, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: Omit<GrabFileEntry, "index">[] = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    if (isZoneIdentifierFile(entry.name)) continue;

    const rel = subdir ? path.posix.join(subdir.replace(/\\/g, "/"), entry.name) : entry.name;
    if (!isSafeRelativePath(rel)) continue;

    const full = path.join(dir, rel);
    if (!isPathInsideDir(dir, full)) continue;

    if (entry.isDirectory()) {
      if (shouldExcludeGrabFile(entry.name) || shouldExcludeGrabFile(rel)) continue;
      files.push(
        ...listGrabFiles(dir, rel).map(({ relativePath, name, sizeBytes }) => ({
          relativePath,
          name,
          sizeBytes,
        })),
      );
    } else {
      let isFile = entry.isFile();
      if (!isFile && !entry.isSymbolicLink()) {
        try {
          isFile = fs.statSync(full).isFile();
        } catch {
          continue;
        }
      }
      if (!isFile) continue;
      if (shouldExcludeGrabFile(entry.name) || shouldExcludeGrabFile(rel)) continue;
      const isPasswordFile = entry.name === GRAB_PASSWORD_FILENAME;
      if (!isPasswordFile && isExecutableFilename(entry.name)) continue;
      try {
        files.push({
          relativePath: rel,
          name: entry.name,
          sizeBytes: fs.statSync(full).size,
        });
      } catch {
        // ignore unreadable entries
      }
    }
  }

  return files
    .filter((f) => !shouldExcludeGrabFile(f.name) && !shouldExcludeGrabFile(f.relativePath))
    .map((f, index) => ({ ...f, index }));
}

export function resolveGrabFileByIndex(dir: string, fileIndex: number): string | null {
  if (!Number.isInteger(fileIndex) || fileIndex < 0) return null;
  const entry = listGrabFiles(dir)[fileIndex];
  if (!entry) return null;
  return resolveGrabFile(dir, entry.relativePath);
}

export function resolveGrabFile(dir: string, relativePath: string): string | null {
  if (!isSafeRelativePath(relativePath)) return null;
  if (isZoneIdentifierFile(path.basename(relativePath))) return null;
  const base = path.basename(relativePath);
  if (shouldExcludeGrabFile(base) || shouldExcludeGrabFile(relativePath)) return null;
  if (base !== GRAB_PASSWORD_FILENAME && isExecutableFilename(base)) return null;

  const resolved = path.resolve(dir, relativePath);
  const normalizedDir = path.resolve(dir);
  if (!resolved.startsWith(normalizedDir + path.sep) && resolved !== normalizedDir) {
    return null;
  }
  if (!isPathInsideDir(dir, resolved)) return null;

  try {
    const st = fs.lstatSync(resolved);
    if (!st.isFile() || st.isSymbolicLink()) return null;
    return resolved;
  } catch {
    return null;
  }
}

export function writeGrabPasswordFile(dir: string, password: string | null | undefined): void {
  if (!password?.trim()) return;
  const file = path.join(dir, GRAB_PASSWORD_FILENAME);
  if (!isPathInsideDir(dir, file)) return;
  try {
    fs.writeFileSync(file, `${password.trim()}\n`, { mode: 0o644 });
  } catch {
    // read-only volume
  }
}

/** Strip execute bits, write password.txt, validate grab folder before listing or download. */
export function prepareGrabDirectory(dir: string, password?: string | null): void {
  hardenGrabDirectory(dir);
  writeGrabPasswordFile(dir, password);
}
