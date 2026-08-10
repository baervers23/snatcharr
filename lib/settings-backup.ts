import { db } from "@/lib/db";
import { downloadClients, externalApps, indexers } from "@/lib/db/schema";
import { getAllSettings, setManySettings } from "@/lib/db/settings";
import type { AppSettings } from "@/lib/db/settings-shared";
import { buildConfigSnapshot } from "@/lib/setup-config";
import { saveConfig } from "@/lib/config";
import { z } from "zod";

export const BACKUP_VERSION = 1;

const backupSchema = z.object({
  version: z.number().int(),
  exportedAt: z.string(),
  settings: z.record(z.unknown()),
  indexers: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      url: z.string(),
      apiKey: z.string(),
      categories: z.string().optional(),
      prowlarrTags: z.string().optional(),
      enabled: z.boolean().optional(),
      priority: z.number().optional(),
    }),
  ),
  downloadClients: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["sabnzbd", "nzbget", "nzbvortex"]),
      url: z.string(),
      apiKey: z.string(),
      category: z.string().optional(),
      enabled: z.boolean().optional(),
      isDefault: z.boolean().optional(),
      priority: z.number().optional(),
    }),
  ),
  externalApps: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["jellyfin", "seerr", "organizr", "jfago", "lidarr", "radarr", "sonarr"]),
      url: z.string(),
      apiKey: z.string().nullable().optional(),
      enabled: z.boolean().optional(),
    }),
  ),
});

export async function buildSettingsBackup() {
  const settings = await getAllSettings();
  const indexerRows = await db.query.indexers.findMany();
  const clientRows = await db.query.downloadClients.findMany();
  const appRows = await db.query.externalApps.findMany();

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    indexers: indexerRows.map((ix) => ({
      name: ix.name,
      type: ix.type,
      url: ix.url,
      apiKey: ix.apiKey,
      categories: ix.categories,
      prowlarrTags: ix.prowlarrTags ?? "",
      enabled: ix.enabled ?? true,
      priority: ix.priority ?? 0,
    })),
    downloadClients: clientRows.map((cl) => ({
      name: cl.name,
      type: cl.type,
      url: cl.url,
      apiKey: cl.apiKey,
      category: cl.category ?? "snatcharr",
      enabled: cl.enabled ?? true,
      isDefault: cl.isDefault ?? false,
      priority: cl.priority ?? 0,
    })),
    externalApps: appRows.map((ap) => ({
      name: ap.name,
      type: ap.type,
      url: ap.url,
      apiKey: ap.apiKey,
      enabled: ap.enabled ?? true,
    })),
  };
}

export async function restoreSettingsBackup(payload: unknown) {
  const parsed = backupSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Invalid backup file");
  }

  const { settings, indexers: ixRows, downloadClients: clRows, externalApps: apRows } = parsed.data;
  const now = new Date();

  await setManySettings(settings as Partial<AppSettings>);

  await db.delete(indexers);
  await db.delete(downloadClients);
  await db.delete(externalApps);

  if (ixRows.length > 0) {
    await db.insert(indexers).values(
      ixRows.map((ix) => ({
        name: ix.name,
        type: ix.type,
        url: ix.url,
        apiKey: ix.apiKey,
        categories: ix.categories ?? "[]",
        prowlarrTags: ix.prowlarrTags ?? "",
        enabled: ix.enabled ?? true,
        priority: ix.priority ?? 0,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  if (clRows.length > 0) {
    await db.insert(downloadClients).values(
      clRows.map((cl) => ({
        name: cl.name,
        type: cl.type,
        url: cl.url,
        apiKey: cl.apiKey,
        category: cl.category ?? "snatcharr",
        enabled: cl.enabled ?? true,
        isDefault: cl.isDefault ?? false,
        priority: cl.priority ?? 0,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  if (apRows.length > 0) {
    await db.insert(externalApps).values(
      apRows.map((ap) => ({
        name: ap.name,
        type: ap.type,
        url: ap.url,
        apiKey: ap.apiKey ?? null,
        enabled: ap.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  const gs = settings as Partial<AppSettings>;
  const snapshot = buildConfigSnapshot({
    setupComplete: true,
    indexers: ixRows.map((ix, i) => ({
      id: String(i + 1),
      name: ix.name,
      type: ix.type,
      url: ix.url,
      apiKey: ix.apiKey,
      categories: ix.categories ?? "",
    })),
    clients: clRows.map((cl, i) => ({
      id: String(i + 1),
      name: cl.name,
      type: cl.type,
      url: cl.url,
      apiKey: cl.apiKey,
      category: cl.category ?? "snatcharr",
    })),
    apps: apRows.map((ap, i) => ({
      id: String(i + 1),
      name: ap.name,
      type: ap.type,
      url: ap.url,
      apiKey: ap.apiKey ?? "",
    })),
    generalSettings: {
      authMethod: gs.authMethod,
      signupEnabled: gs.signupEnabled,
      requireEmail: gs.requireEmail,
      requireAppGrant: gs.requireAppGrant,
      maxSearchRequestsPerUserPerDay: gs.maxSearchRequestsPerUserPerDay,
      maxGrabsPerUserPerDay: gs.maxGrabsPerUserPerDay,
      warningOnOpen: gs.infoPopupMode ?? (gs.infoPopupEnabled ? "always" : "disabled"),
      importantPopupText: gs.infoPopupText,
    },
  });
  saveConfig(snapshot);

  if (gs.maxGrabsPerUserPerDay !== undefined) {
    const { syncGlobalGrabLimitToUsers } = await import("@/lib/user-limits-sync");
    await syncGlobalGrabLimitToUsers(gs.maxGrabsPerUserPerDay);
  }

  if (gs.logLevel !== undefined) {
    const { setLogLevel } = await import("@/lib/logger");
    setLogLevel(gs.logLevel);
  }

  if (gs.backgroundTasks !== undefined) {
    const { startBackgroundTasks } = await import("@/lib/tasks");
    startBackgroundTasks();
  }
}
