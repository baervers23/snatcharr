import fs from "fs";

import { getAppDataDir, getDownloadDir } from "./paths";

export interface DiskUsage {
  path: string;
  label: string;
  free: number;
  total: number;
}

function statPath(dir: string): DiskUsage | null {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stats = fs.statfsSync(dir);
    return {
      path: dir,
      label: dir,
      free: stats.bfree * stats.bsize,
      total: stats.blocks * stats.bsize,
    };
  } catch {
    return null;
  }
}

export function getAppDiskUsage(): DiskUsage | null {
  return statPath(getAppDataDir());
}

export function getDownloadDiskUsage(): DiskUsage | null {
  return statPath(getDownloadDir());
}

export function disksAreSame(a: DiskUsage | null, b: DiskUsage | null): boolean {
  if (!a || !b) return true;
  return a.total === b.total && a.free === b.free;
}
