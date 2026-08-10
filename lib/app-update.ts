import { APP_VERSION } from "@/lib/app-version";

export const GITHUB_REPO = "baervers23/snatcharr";
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

export type AppUpdateStatus = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string;
  checkedAt: string;
  error?: string;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let cached: { at: number; status: AppUpdateStatus } | null = null;

export function normalizeVersionTag(tag: string): string {
  return tag.replace(/^v/i, "").trim();
}

/** True when `latest` is a newer release than `current`. */
export function isVersionNewer(latest: string, current: string): boolean {
  const l = normalizeVersionTag(latest);
  const c = normalizeVersionTag(current);
  if (l === c) return false;

  const parse = (v: string) => {
    const [core, prerelease] = v.split("-");
    const parts = core.split(".").map((n) => parseInt(n, 10) || 0);
    return { parts, prerelease: prerelease ?? "" };
  };

  const lv = parse(l);
  const cv = parse(c);
  const len = Math.max(lv.parts.length, cv.parts.length);

  for (let i = 0; i < len; i++) {
    const a = lv.parts[i] ?? 0;
    const b = cv.parts[i] ?? 0;
    if (a !== b) return a > b;
  }

  // Same numeric core: stable beats prerelease (e.g. 0.9.0 > 0.9.0-beta).
  if (!lv.prerelease && cv.prerelease) return true;
  if (lv.prerelease && !cv.prerelease) return false;
  return lv.prerelease > cv.prerelease;
}

async function fetchLatestGitHubTag(): Promise<{ tag: string; url: string } | null> {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Snatcharr-Update-Check",
  };

  try {
    const releaseRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers, signal: AbortSignal.timeout(12_000) },
    );

    if (releaseRes.ok) {
      const data = (await releaseRes.json()) as { tag_name?: string; html_url?: string };
      if (data.tag_name) {
        return {
          tag: data.tag_name,
          url: data.html_url ?? GITHUB_RELEASES_URL,
        };
      }
    }

    const tagsRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=1`,
      { headers, signal: AbortSignal.timeout(12_000) },
    );

    if (!tagsRes.ok) return null;

    const tags = (await tagsRes.json()) as Array<{ name?: string }>;
    const tag = tags[0]?.name;
    if (!tag) return null;

    return {
      tag,
      url: `${GITHUB_RELEASES_URL}/tag/${encodeURIComponent(tag)}`,
    };
  } catch {
    return null;
  }
}

export async function getAppUpdateStatus(force = false): Promise<AppUpdateStatus> {
  const now = Date.now();
  if (!force && cached && now - cached.at < CACHE_TTL_MS) {
    return cached.status;
  }

  const checkedAt = new Date().toISOString();
  const currentVersion = APP_VERSION;

  const latest = await fetchLatestGitHubTag();

  if (!latest) {
    const status: AppUpdateStatus = {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      releaseUrl: GITHUB_RELEASES_URL,
      checkedAt,
      error: "Could not reach GitHub",
    };
    cached = { at: now, status };
    return status;
  }

  const latestVersion = normalizeVersionTag(latest.tag);
  const status: AppUpdateStatus = {
    currentVersion,
    latestVersion,
    updateAvailable: isVersionNewer(latestVersion, currentVersion),
    releaseUrl: latest.url,
    checkedAt,
  };

  cached = { at: now, status };
  return status;
}
