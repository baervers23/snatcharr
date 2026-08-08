/**
 * App-wide configuration stored in a plain JSON file.
 *
 * Stored at `<data-dir>/config.json` (default `/app/data` in Docker via volume mount).
 *
 * Connection credentials (Prowlarr, SABnzbd, …), setup state, and access-
 * control settings live here. User accounts, grab history, and statistics
 * stay in the SQLite database.
 */

import fs from "fs";

import { ensureAppDataDir, getAppDataDir, getConfigPath } from "./paths";

// ─── Paths ────────────────────────────────────────────────────────────────────

/** @deprecated Use getAppDataDir() from lib/paths */
export function getDataDir(): string {
  return getAppDataDir();
}

// ─── Shape ────────────────────────────────────────────────────────────────────

export type IndexerConfig = {
  id: string;
  name: string;
  type: string; // "prowlarr" | …
  url: string;
  apiKey: string;
  categories: string; // comma-separated category IDs
  enabled: boolean;
};

export type DownloadClientConfig = {
  id: string;
  name: string;
  type: string; // "sabnzbd" | "nzbget" | "qbittorrent" | …
  url: string;
  apiKey: string;
  category: string;
  enabled: boolean;
};

export type ExternalAppConfig = {
  id: string;
  name: string;
  type: string; // "jellyfin" | "seerr" | "organizr" | …
  url: string;
  apiKey: string;
  enabled: boolean;
};

export type AppConfig = {
  // Setup
  setupComplete: boolean;
  instanceName: string;
  /** Last admin username from setup step 1 (password never stored). */
  adminUsername?: string;

  // Auth & access control (mirrored from DB settings during setup)
  authMethod?:
    | "local"
    | "jellyfin"
    | "organizr"
    | "organizr-sso"
    | "jfago"
    | "seerr"
    | "seerr-local"
    | "seerr-jellyfin"
    | "seerr-jellyfin-fallback";
  /** @deprecated use authMethod */
  loginMethod?: "local" | "additional-app";
  allowGuestRegister: boolean;
  emailRequired: boolean;
  requireAppGrant?: boolean;
  /** @deprecated use requireAppGrant */
  usersNeedSearchGrant?: boolean;
  /** @deprecated use requireAppGrant */
  usersNeedGrabGrant?: boolean;
  maxSearchRequestsPerUserPerDay?: number;
  maxGrabsPerUserPerDay?: number;

  // Popup warning
  warningOnOpen: "once" | "always" | "disabled";
  importantPopupText: string;

  // Connection info (Prowlarr, SABnzbd, Jellyfin, …)
  indexers: IndexerConfig[];
  downloadClients: DownloadClientConfig[];
  externalApps: ExternalAppConfig[];
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AppConfig = {
  setupComplete: false,
  instanceName: "Snatcharr",
  authMethod: "local",
  allowGuestRegister: false,
  emailRequired: false,
  requireAppGrant: false,
  maxSearchRequestsPerUserPerDay: 0,
  maxGrabsPerUserPerDay: 0,
  warningOnOpen: "disabled",
  importantPopupText: "",
  indexers: [],
  downloadClients: [],
  externalApps: [],
};

// ─── In-memory cache (globalThis survives Next.js dev HMR module reloads) ─────

const configGlobal = globalThis as typeof globalThis & {
  __snatcharrConfigCache?: AppConfig | null;
};

function getCache(): AppConfig | null {
  return configGlobal.__snatcharrConfigCache ?? null;
}

function setCache(config: AppConfig | null): void {
  configGlobal.__snatcharrConfigCache = config;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function ensureDataDir(): void {
  ensureAppDataDir();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load the config from disk (once) and return the cached value.
 * Safe to call multiple times — reads the file only on the first call.
 */
export function loadConfig(): AppConfig {
  const cached = getCache();
  if (cached) return cached;

  ensureDataDir();

  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    const defaults = { ...DEFAULT_CONFIG };
    setCache(defaults);
    return defaults;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const setupFlag = parsed.setupComplete;
    const setupComplete =
      setupFlag === true ||
      setupFlag === "true" ||
      setupFlag === 1 ||
      setupFlag === "1";
    const loaded = { ...DEFAULT_CONFIG, ...(parsed as Partial<AppConfig>), setupComplete };
    setCache(loaded);
    return loaded;
  } catch (err) {
    console.error("[Config] Failed to parse config.json — using defaults:", err);
    const defaults = { ...DEFAULT_CONFIG };
    setCache(defaults);
    return defaults;
  }
}

/** Get the current config. Re-reads from disk when cache says setup is incomplete. */
export function getConfig(): AppConfig {
  const cached = getCache();
  if (cached?.setupComplete) return cached;
  if (cached && !cached.setupComplete) setCache(null);
  return loadConfig();
}

/** Persist a full config object to disk and update the cache. */
export function saveConfig(config: AppConfig): void {
  ensureDataDir();
  setCache(config);
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}

/** Merge a partial update into the current config and persist it. */
export function updateConfig(partial: Partial<AppConfig>): AppConfig {
  const current = getConfig();
  const updated: AppConfig = { ...current, ...partial };
  saveConfig(updated);
  return updated;
}

/** Invalidate the in-memory cache (used in tests or after external changes). */
export function invalidateConfigCache(): void {
  setCache(null);
}
