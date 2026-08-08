import path from "path";

/** Root directory for all Guidarr persisted data. */
export const GUIDARR_DATA_DIR = path.join(process.cwd(), "data", "guidarr");

export const GUIDARR_CONFIG_PATH = path.join(GUIDARR_DATA_DIR, "config.json");
export const GUIDARR_GROUPS_PATH = path.join(GUIDARR_DATA_DIR, "groups.json");
export const GUIDARR_UPLOADS_DIR = path.join(GUIDARR_DATA_DIR, "uploads");

export function groupDir(groupId: string): string {
  return path.join(GUIDARR_DATA_DIR, "groups", groupId);
}

export function groupSlidesManifestPath(groupId: string): string {
  return path.join(groupDir(groupId), "slides.json");
}

export function groupSlideFilePath(groupId: string, slideId: string): string {
  return path.join(groupDir(groupId), "slides", `${slideId}.md`);
}
