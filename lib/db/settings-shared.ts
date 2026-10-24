import { CATEGORY_GROUPS } from "../utils";

/** Client-safe settings types & defaults (no SQLite / Node imports). */

export type BackgroundTask = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  intervalMs: number;
  lastRunAt?: string | null;
};

export const DEFAULT_BACKGROUND_TASKS: BackgroundTask[] = [
  {
    id: "health-check",
    name: "Check health",
    description: "Run connectivity checks for indexers, download clients, and apps",
    enabled: true,
    intervalMs: 6 * 60 * 60 * 1000,
  },
  {
    id: "remove-old-downloads",
    name: "Remove old downloads",
    description: "Delete completed grabs and files after the keep period ends",
    enabled: true,
    intervalMs: 60 * 60 * 1000,
  },
  {
    id: "cleanup-logs",
    name: "Cleanup old log files",
    description: "Rotate and trim log files on disk",
    enabled: true,
    intervalMs: 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "cleanup-missing-folders",
    name: "Remove grabs with missing folders",
    description: "Drop completed grab records whose files no longer exist",
    enabled: true,
    intervalMs: 30 * 60 * 1000,
  },
];

export type TaskIntervalUnit = "minutes" | "hours" | "days";

export function msToIntervalParts(ms: number): { amount: number; unit: TaskIntervalUnit } {
  if (ms >= 24 * 60 * 60 * 1000 && ms % (24 * 60 * 60 * 1000) === 0) {
    return { amount: ms / (24 * 60 * 60 * 1000), unit: "days" };
  }
  if (ms >= 60 * 60 * 1000 && ms % (60 * 60 * 1000) === 0) {
    return { amount: ms / (60 * 60 * 1000), unit: "hours" };
  }
  return { amount: Math.max(1, Math.round(ms / 60_000)), unit: "minutes" };
}

export function intervalPartsToMs(amount: number, unit: TaskIntervalUnit): number {
  const safe = Math.max(1, Math.floor(amount) || 1);
  const mult =
    unit === "days" ? 24 * 60 * 60 * 1000 : unit === "hours" ? 60 * 60 * 1000 : 60_000;
  return Math.min(safe * mult, 2_147_483_647);
}

export function formatTaskInterval(ms: number): string {
  const { amount, unit } = msToIntervalParts(ms);
  const label = unit === "days" ? "day" : unit === "hours" ? "hour" : "minute";
  return `${amount} ${label}${amount === 1 ? "" : "s"}`;
}

/** Per file extension (e.g. .mp4) — matched in release title when grabbing. */
export type ExtensionSizeLimit = { ext: string; minBytes: number; maxBytes: number };

export type UploadNzbSite = { label: string; url: string };
export type UploadNzbTip = { title: string; body: string };

export const DEFAULT_UPLOAD_NZB_SITES: UploadNzbSite[] = [
  { label: "NZBKing", url: "https://www.nzbking.com/" },
  { label: "NZBStars", url: "https://nzbstars.com/" },
  { label: "NZBIndex", url: "https://nzbindex.com/search" },
  { label: "Binsearch", url: "https://www.binsearch.info/" },
];

export const DEFAULT_UPLOAD_NZB_TIPS: UploadNzbTip[] = [
  {
    title: "Search for content in a specific language",
    body: "Append a language keyword to your query on NZB indexers, e.g. add “german” for German releases.\nExample: “MovieName german”",
  },
  {
    title: "Find the newest releases",
    body: "Sites like Xrel.to list recent scene releases. Copy a release name and paste it into an NZB search engine.",
  },
  {
    title: "Avoid spam & malware",
    body: "Always set a minimum size filter on the indexer (e.g. 100–500 MB for video, ~3 MB for music tracks). That removes most spam posts.",
  },
  {
    title: "Incomplete or password-protected releases",
    body: "Prefer results that are complete (e.g. NZBIndex “parts available: 20 / 20”). On Binsearch, check the completion bar percentage.",
  },
];

export const DEFAULT_GRAB_EXTENSION_LIMITS: ExtensionSizeLimit[] = [
  { ext: ".mp3", minBytes: 3 * 1024 * 1024, maxBytes: 80 * 1024 * 1024 },
  { ext: ".flac", minBytes: 10 * 1024 * 1024, maxBytes: 500 * 1024 * 1024 },
  { ext: ".mp4", minBytes: 200 * 1024 * 1024, maxBytes: 4000 * 1024 * 1024 },
  { ext: ".mkv", minBytes: 200 * 1024 * 1024, maxBytes: 8000 * 1024 * 1024 },
  { ext: ".avi", minBytes: 100 * 1024 * 1024, maxBytes: 4000 * 1024 * 1024 },
  { ext: ".epub", minBytes: 512 * 1024, maxBytes: 100 * 1024 * 1024 },
  { ext: ".pdf", minBytes: 512 * 1024, maxBytes: 200 * 1024 * 1024 },
];

export type AppSettings = {
  instanceName: string;
  hostUrl: string;
  logLevel: "debug" | "info" | "warn" | "error";
  maxConcurrentGrabsPerUser: number;
  completedGrabKeepDays: number;
  infoPopupEnabled: boolean;
  infoPopupMode: "once" | "always" | "disabled";
  infoPopupTitle: string;
  infoPopupText: string;
  /** UI language code — see locales/*.json */
  uiLanguage: string;
  /**
   * Cap non-admin throughput when downloading finished files from Snatcharr (Mbit/s).
   * Does not limit grab/queue to the download client. 0 = unlimited. Admins never throttled.
   */
  userDownloadSpeedLimitMbit: number;
  /**
   * When debug mode is on, skip real Prowlarr/SABnzbd calls and use fixtures.
   * Ignored unless isDebugEnabled().
   */
  debugMockExternal: boolean;
  setupCompleted: boolean;
  backgroundTasks: BackgroundTask[];
  maxResults: number;
  maxGrabsPerUserPerDay: number;
  maxSearchRequestsPerUserPerDay: number;
  maxManualNzbPerUserPerDay: number;
  maxDownloadsPerUserPerDay: number;
  searchRateLimitPerMinute: number;
  grabFilterExtensionLimits: ExtensionSizeLimit[];
  grabFilterExtensionLimitsEnabled: boolean;
  grabFilterTitleBlacklist: string[];
  grabFilterDomainBlacklist: string[];
  enabledCategories: string[];
  authMethod:
    | "local"
    | "jellyfin"
    | "organizr"
    | "organizr-sso"
    | "jfago"
    | "seerr"
    | "seerr-local"
    | "seerr-jellyfin"
    | "seerr-jellyfin-fallback";
  /** Used when the primary auth provider fails — set Local as fallback for external + local login. */
  authFallbackMethod: AppSettings["authMethod"] | "none";
  /** Redirect URL for password recovery on externally imported users. */
  forgotPasswordUrl: string;
  requireEmail: boolean;
  signupEnabled: boolean;
  requireAppGrant: boolean;
  requireUploadGrant: boolean;
  /** When enabled, users with the per-user grant may pick a download client when grabbing. */
  allowPickDownloader: boolean;
  sessionTimeoutHours: number;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  grabEmailSubject: string;
  grabEmailBody: string;
  downloadAvailabilityHours?: number;
  autoDeleteAfterDays?: number;
  /** Container path for completed grab files. App data path is fixed via lib/paths.ts. */
  downloadDir: string;
  /** Editable Upload NZB page — sites list + tips (admin edits on /upload). */
  uploadNzbSitesHeading: string;
  uploadNzbSitesIntro: string;
  uploadNzbSites: UploadNzbSite[];
  uploadNzbTipsHeading: string;
  uploadNzbTips: UploadNzbTip[];
};

export const DEFAULT_SETTINGS: AppSettings = {
  instanceName: "Snatcharr",
  hostUrl: "http://localhost:3000",
  logLevel: "info",
  maxConcurrentGrabsPerUser: 2,
  completedGrabKeepDays: 7,
  infoPopupEnabled: false,
  infoPopupMode: "disabled",
  infoPopupTitle: "",
  infoPopupText: "",
  uiLanguage: "en",
  userDownloadSpeedLimitMbit: 0,
  debugMockExternal: false,
  setupCompleted: false,
  backgroundTasks: DEFAULT_BACKGROUND_TASKS,
  maxResults: 100,
  maxGrabsPerUserPerDay: 0,
  maxSearchRequestsPerUserPerDay: 0,
  maxManualNzbPerUserPerDay: 5,
  maxDownloadsPerUserPerDay: 0,
  searchRateLimitPerMinute: 30,
  grabFilterExtensionLimits: DEFAULT_GRAB_EXTENSION_LIMITS,
  grabFilterExtensionLimitsEnabled: true,
  grabFilterTitleBlacklist: [],
  grabFilterDomainBlacklist: [],
  enabledCategories: CATEGORY_GROUPS.map((g) => g.label),
  authMethod: "local",
  authFallbackMethod: "none",
  forgotPasswordUrl: "",
  requireEmail: false,
  signupEnabled: false,
  requireAppGrant: false,
  requireUploadGrant: true,
  allowPickDownloader: false,
  sessionTimeoutHours: 24,
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  smtpFrom: "snatcharr@localhost",
  grabEmailSubject: "[$instance] Download ready: $requestedgrab",
  grabEmailBody:
    "Hi $user,\n\nYour download **$requestedgrab** ($size) is ready.\n\n$passwordblock\nBrowse or download your files here: $grablink",
  downloadDir: "/downloads",
  uploadNzbSitesHeading: "Where to find NZBs?",
  uploadNzbSitesIntro:
    'These sites are commonly used — you may find a lot, but that does not mean content is safe. No guarantee at all.',
  uploadNzbSites: DEFAULT_UPLOAD_NZB_SITES,
  uploadNzbTipsHeading: "Tips for better search results",
  uploadNzbTips: DEFAULT_UPLOAD_NZB_TIPS,
};

export function migrateLegacySettings(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.completedGrabKeepDays === undefined) {
    const legacyDays = raw.downloadRetentionDays;
    const days =
      typeof legacyDays === "number" && legacyDays >= 0
        ? legacyDays
        : typeof raw.autoDeleteAfterDays === "number" && raw.autoDeleteAfterDays > 0
          ? raw.autoDeleteAfterDays
          : typeof raw.downloadAvailabilityHours === "number"
            ? Math.max(1, Math.ceil(raw.downloadAvailabilityHours / 24))
            : DEFAULT_SETTINGS.completedGrabKeepDays;
    raw.completedGrabKeepDays = days;
  }

  if (raw.maxConcurrentGrabsPerUser === undefined) {
    raw.maxConcurrentGrabsPerUser =
      typeof raw.maxConcurrentDownloadsPerUser === "number"
        ? raw.maxConcurrentDownloadsPerUser
        : DEFAULT_SETTINGS.maxConcurrentGrabsPerUser;
  }

  if (!Array.isArray(raw.backgroundTasks)) {
    raw.backgroundTasks = DEFAULT_BACKGROUND_TASKS;
  } else {
    const saved = raw.backgroundTasks as BackgroundTask[];
    raw.backgroundTasks = DEFAULT_BACKGROUND_TASKS.map((def) => {
      const match = saved.find((t) => t?.id === def.id);
      const intervalMs = Math.min(
        Math.max(match?.intervalMs ?? def.intervalMs, 1_000),
        2_147_483_647,
      );
      return { ...def, ...match, intervalMs };
    });
  }

  if (raw.signupEnabled === undefined) {
    raw.signupEnabled = false;
  }

  if (raw.maxSearchRequestsPerUserPerDay === undefined) {
    raw.maxSearchRequestsPerUserPerDay = DEFAULT_SETTINGS.maxSearchRequestsPerUserPerDay;
  }

  if (raw.requireAppGrant === undefined) {
    raw.requireAppGrant = DEFAULT_SETTINGS.requireAppGrant;
  }

  if (raw.infoPopupMode === undefined) {
    if (raw.infoPopupEnabled === false) raw.infoPopupMode = "disabled";
    else if (raw.infoPopupEnabled === true) raw.infoPopupMode = "always";
    else raw.infoPopupMode = DEFAULT_SETTINGS.infoPopupMode;
  }
  raw.infoPopupEnabled = raw.infoPopupMode !== "disabled";

  if (raw.requireEmail === undefined && typeof raw.emailRequired === "boolean") {
    raw.requireEmail = raw.emailRequired;
  }

  if (raw.downloadDir === undefined || raw.downloadDir === "") {
    raw.downloadDir = "/downloads";
  }

  if (Array.isArray(raw.enabledCategories)) {
    const legacyLabels: Record<string, string> = {
      "PC/Software": "PC",
      "Games/Console": "Console",
    };
    raw.enabledCategories = (raw.enabledCategories as string[]).map(
      (label) => legacyLabels[label] ?? label,
    );
  }

  if (!Array.isArray(raw.grabFilterExtensionLimits)) {
    raw.grabFilterExtensionLimits = DEFAULT_GRAB_EXTENSION_LIMITS;
  }
  if (raw.grabFilterExtensionLimitsEnabled === undefined) {
    raw.grabFilterExtensionLimitsEnabled = true;
  }

  if (raw.authMethod === "seerr-jellyfin-fallback") {
    raw.authMethod = "seerr-jellyfin";
    if (raw.authFallbackMethod === undefined) raw.authFallbackMethod = "jellyfin";
  }
  if (raw.authFallbackMethod === undefined) {
    raw.authFallbackMethod = DEFAULT_SETTINGS.authFallbackMethod;
  }

  if (!Array.isArray(raw.uploadNzbSites) || raw.uploadNzbSites.length === 0) {
    raw.uploadNzbSites = DEFAULT_UPLOAD_NZB_SITES;
  }
  if (!Array.isArray(raw.uploadNzbTips) || raw.uploadNzbTips.length === 0) {
    raw.uploadNzbTips = DEFAULT_UPLOAD_NZB_TIPS;
  }
  if (typeof raw.uploadNzbSitesHeading !== "string" || !raw.uploadNzbSitesHeading) {
    raw.uploadNzbSitesHeading = DEFAULT_SETTINGS.uploadNzbSitesHeading;
  }
  if (typeof raw.uploadNzbSitesIntro !== "string" || !raw.uploadNzbSitesIntro) {
    raw.uploadNzbSitesIntro = DEFAULT_SETTINGS.uploadNzbSitesIntro;
  }
  if (typeof raw.uploadNzbTipsHeading !== "string" || !raw.uploadNzbTipsHeading) {
    raw.uploadNzbTipsHeading = DEFAULT_SETTINGS.uploadNzbTipsHeading;
  }

  return raw;
}
