import { db } from "./index";
import { settings } from "./schema";
import { eq } from "drizzle-orm";
import { getConfig } from "../config";
import {
  DEFAULT_SETTINGS,
  migrateLegacySettings,
  type AppSettings,
  type BackgroundTask,
} from "./settings-shared";

export type { AppSettings, BackgroundTask, TaskIntervalUnit } from "./settings-shared";
export {
  DEFAULT_BACKGROUND_TASKS,
  DEFAULT_SETTINGS,
  formatTaskInterval,
  intervalPartsToMs,
  migrateLegacySettings,
  msToIntervalParts,
} from "./settings-shared";

const LEGACY_SETTING_KEYS = [
  "maxConcurrentDownloadsPerUser",
  "downloadRetentionDays",
  "emailRequired",
] as const;

type LegacySettingKey = (typeof LEGACY_SETTING_KEYS)[number];

const SETTING_ALIASES: Partial<Record<keyof AppSettings, readonly LegacySettingKey[]>> = {
  maxConcurrentGrabsPerUser: ["maxConcurrentDownloadsPerUser"],
  completedGrabKeepDays: ["downloadRetentionDays"],
  requireEmail: ["emailRequired"],
};

const BOOLEAN_KEYS = new Set<keyof AppSettings>([
  "requireEmail",
  "signupEnabled",
  "requireAppGrant",
  "requireUploadGrant",
  "allowPickDownloader",
  "infoPopupEnabled",
  "setupCompleted",
  "grabFilterExtensionLimitsEnabled",
]);

/** Keys mirrored in config.json — used when SQLite has no row yet. */
const CONFIG_FALLBACK_KEYS = new Set<keyof AppSettings>([
  "requireEmail",
  "signupEnabled",
  "requireAppGrant",
  "authMethod",
  "maxSearchRequestsPerUserPerDay",
  "maxGrabsPerUserPerDay",
  "infoPopupText",
  "infoPopupMode",
]);

function configFallback<K extends keyof AppSettings>(key: K): AppSettings[K] | undefined {
  const config = getConfig();
  switch (key) {
    case "requireEmail":
      return config.emailRequired as AppSettings[K];
    case "signupEnabled":
      return config.allowGuestRegister as AppSettings[K];
    case "requireAppGrant":
      return (config.requireAppGrant ??
        !!(config.usersNeedSearchGrant || config.usersNeedGrabGrant)) as AppSettings[K];
    case "authMethod":
      return (config.authMethod ?? "local") as AppSettings[K];
    case "maxSearchRequestsPerUserPerDay":
      return (config.maxSearchRequestsPerUserPerDay ?? 0) as AppSettings[K];
    case "maxGrabsPerUserPerDay":
      return (config.maxGrabsPerUserPerDay ?? 0) as AppSettings[K];
    case "infoPopupText":
      return config.importantPopupText as AppSettings[K];
    case "infoPopupMode":
      return config.warningOnOpen as AppSettings[K];
    default:
      return undefined;
  }
}

function parseSettingValue<K extends keyof AppSettings>(key: K, raw: string): AppSettings[K] {
  try {
    const parsed = JSON.parse(raw) as AppSettings[K];
    if (BOOLEAN_KEYS.has(key)) return !!parsed as AppSettings[K];
    return parsed;
  } catch {
    if (BOOLEAN_KEYS.has(key)) {
      return (raw === "true" || raw === "1") as AppSettings[K];
    }
    return raw as unknown as AppSettings[K];
  }
}

export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  let row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  if (!row) {
    for (const legacy of SETTING_ALIASES[key] ?? []) {
      row = await db.query.settings.findFirst({ where: eq(settings.key, legacy) });
      if (row) break;
    }
  }
  if (row) return parseSettingValue(key, row.value);

  if (CONFIG_FALLBACK_KEYS.has(key)) {
    const fromConfig = configFallback(key);
    if (fromConfig !== undefined) return fromConfig;
  }

  return DEFAULT_SETTINGS[key];
}

export async function getAllSettings(): Promise<Partial<AppSettings>> {
  const rows = await db.query.settings.findMany();
  const fromDb = new Set(rows.map((r) => r.key));
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    const key = row.key as keyof AppSettings;
    if (key in DEFAULT_SETTINGS) {
      result[key] = parseSettingValue(key, row.value);
    } else {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
  }

  const migrated = migrateLegacySettings(result) as Partial<AppSettings>;

  for (const key of CONFIG_FALLBACK_KEYS) {
    if (!fromDb.has(key) && !(SETTING_ALIASES[key] ?? []).some((alias) => fromDb.has(alias))) {
      const fromConfig = configFallback(key);
      if (fromConfig !== undefined) {
        (migrated as Record<string, unknown>)[key] = fromConfig;
      }
    }
  }

  if (!fromDb.has("infoPopupMode") && !fromDb.has("infoPopupEnabled")) {
    const config = getConfig();
    migrated.infoPopupMode = config.warningOnOpen;
    migrated.infoPopupEnabled = config.warningOnOpen !== "disabled";
  }

  return migrated;
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  const serialized = JSON.stringify(value);
  const existing = await db.query.settings.findFirst({ where: eq(settings.key, key) });

  if (existing) {
    await db
      .update(settings)
      .set({ value: serialized, updatedAt: new Date() })
      .where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({
      key,
      value: serialized,
      updatedAt: new Date(),
    });
  }
}

export async function setManySettings(values: Partial<AppSettings>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    await setSetting(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
  }
}
