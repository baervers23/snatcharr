import fs from "fs";
import path from "path";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Fixed app data path — Docker: /app/data (volume ./snatcharr-data). Dev: ./data */
export const APP_DATA_DIR = isProduction()
  ? "/app/data"
  : path.join(process.cwd(), "data");

/** Fixed download path — Docker: /downloads (host path from compose). Dev: ./downloads */
export const DOWNLOAD_BASE_DIR = isProduction()
  ? "/downloads"
  : path.join(process.cwd(), "downloads");

export function getAppDataDir(): string {
  return APP_DATA_DIR;
}

let cachedDownloadDir: string | null = null;

export function getDownloadDir(): string {
  return cachedDownloadDir ?? DOWNLOAD_BASE_DIR;
}

export function setDownloadDirCache(dir: string): void {
  const trimmed = dir.replace(/[\\/]+$/, "");
  cachedDownloadDir = trimmed || null;
}

export function getConfigPath(): string {
  return path.join(getAppDataDir(), "config.json");
}

export function ensureAppDataDir(): string {
  const dir = getAppDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
