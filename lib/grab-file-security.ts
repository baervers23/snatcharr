import fs from "fs";
import path from "path";

const EXECUTABLE_EXTENSIONS = new Set([
  ".exe",
  ".msi",
  ".bat",
  ".cmd",
  ".com",
  ".scr",
  ".pif",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ps1",
  ".psm1",
  ".vbs",
  ".vbe",
  ".js",
  ".jse",
  ".wsf",
  ".wsh",
  ".hta",
  ".cpl",
  ".msc",
  ".inf",
  ".app",
  ".dmg",
  ".pkg",
  ".deb",
  ".rpm",
  ".run",
  ".apk",
  ".jar",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
]);

export function isZoneIdentifierFile(name: string): boolean {
  return /:Zone\.Identifier$/i.test(name) || name.includes("Zone.Identifier");
}

export function isExecutableFilename(name: string): boolean {
  const lower = name.toLowerCase();
  const ext = path.extname(lower);
  return EXECUTABLE_EXTENSIONS.has(ext);
}

/** PAR2/PAR recovery files — exclude from browse/zip downloads. */
export function shouldExcludeGrabFile(name: string): boolean {
  const base = path.basename(name.trim().replace(/\0/g, "")).toLowerCase();
  if (!base) return false;
  if (base === "par2" || base === "par") return true;
  if (base.endsWith(".par2")) return true;
  if (/\.vol\d+\+\d+\.par2$/i.test(base)) return true;
  // PAR1 recovery blocks often ship alongside PAR2
  if (/\.p\d{2,3}$/.test(base)) return true;
  if (path.extname(base) === ".par") return true;
  return false;
}

/** @deprecated use shouldExcludeGrabFile */
export function isPar2Filename(name: string): boolean {
  return shouldExcludeGrabFile(name);
}

export function sanitizeDownloadFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-()+ ]+/g, "_").slice(0, 200);
  return base || "download";
}

export function secureDownloadHeaders(filename: string): Record<string, string> {
  const safe = sanitizeDownloadFilename(filename);
  return {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${safe}"`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
    "Cache-Control": "no-store",
  };
}

function realPathOrNull(p: string): string | null {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

/** True when `candidate` resolves inside `baseDir` (symlink-safe). */
export function isPathInsideDir(baseDir: string, candidate: string): boolean {
  const base = realPathOrNull(baseDir);
  if (!base) return false;

  const resolved = realPathOrNull(candidate);
  if (!resolved) return false;

  return resolved === base || resolved.startsWith(base + path.sep);
}

export function stripExecuteBits(filePath: string): void {
  try {
    const st = fs.lstatSync(filePath);
    if (!st.isFile()) return;
    const mode = st.mode & 0o777;
    if (mode & 0o111 || mode & 0o4000 || mode & 0o2000) {
      fs.chmodSync(filePath, 0o644);
    }
  } catch {
    // read-only volume or permission denied
  }
}

/** Remove execute bits from files inside a grab folder; skip symlinks. */
export function hardenGrabDirectory(dir: string): void {
  const base = realPathOrNull(dir);
  if (!base) return;

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        try {
          const st = fs.statSync(full);
          const mode = st.mode & 0o777;
          if (mode & 0o4000 || mode & 0o2000) {
            fs.chmodSync(full, 0o755);
          }
        } catch {
          // ignore
        }
        walk(full);
      } else if (entry.isFile()) {
        stripExecuteBits(full);
      }
    }
  }

  walk(base);
}
