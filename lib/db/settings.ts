import { db } from "./index";
import { settings } from "./schema";
import { eq } from "drizzle-orm";

export type AppSettings = {
  // General
  instanceName: string;
  hostUrl: string;
  maxResults: number;
  maxGrabsPerUserPerDay: number;
  downloadAvailabilityHours: number;
  autoDeleteAfterDays: number;
  logLevel: "debug" | "info" | "warn" | "error";
  infoPopupEnabled: boolean;
  infoPopupText: string;
  setupCompleted: boolean;

  // Security
  authMethod: "local" | "jellyfin" | "organizr";
  apiKey: string;
  sessionTimeoutHours: number;

  // Email
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  instanceName: "Snatcharr",
  hostUrl: "http://localhost:3000",
  maxResults: 100,
  maxGrabsPerUserPerDay: 20,
  downloadAvailabilityHours: 72,
  autoDeleteAfterDays: 7,
  logLevel: "info",
  infoPopupEnabled: false,
  infoPopupText: "",
  setupCompleted: false,
  authMethod: "local",
  apiKey: "",
  sessionTimeoutHours: 24,
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  smtpFrom: "snatcharr@localhost",
};

export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  if (!row) return DEFAULT_SETTINGS[key];
  try {
    return JSON.parse(row.value) as AppSettings[K];
  } catch {
    return row.value as unknown as AppSettings[K];
  }
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
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

export async function getAllSettings(): Promise<Partial<AppSettings>> {
  const rows = await db.query.settings.findMany();
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value);
    } catch {
      result[row.key] = row.value;
    }
  }
  return result as Partial<AppSettings>;
}

export async function setManySettings(values: Partial<AppSettings>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    await setSetting(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
  }
}
