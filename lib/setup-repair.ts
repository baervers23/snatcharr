import { getConfig, updateConfig } from "./config";
import { db } from "./db";
import {
  downloadClients as downloadClientsTable,
  externalApps as externalAppsTable,
  indexers as indexersTable,
} from "./db/schema";
import { setManySettings } from "./db/settings";
import { generalFromConfig, generalToDbSettings } from "./setup-settings";
import { DEFAULT_PROWLARR_SEARCH_TAGS, serializeProwlarrTags } from "./prowlarr-tags";

function parseCategories(raw: string | undefined): string {
  if (!raw?.trim()) return "[]";
  try {
    const parsed = JSON.parse(raw) as number[];
    if (Array.isArray(parsed)) return JSON.stringify(parsed);
  } catch {
    // comma-separated ids from setup wizard
  }
  const ids = raw
    .split(",")
    .map((c) => parseInt(c.trim(), 10))
    .filter((n) => !Number.isNaN(n));
  return JSON.stringify(ids);
}

/** Import indexers/clients/apps from config.json when SQLite tables are empty. */
export async function syncConfigConnectionsToDb(): Promise<void> {
  const config = getConfig();
  const now = new Date();

  const [dbIndexers, dbClients, dbApps] = await Promise.all([
    db.query.indexers.findMany(),
    db.query.downloadClients.findMany(),
    db.query.externalApps.findMany(),
  ]);

  if (dbIndexers.length === 0 && config.indexers.length > 0) {
    await db.insert(indexersTable).values(
      config.indexers.map((ix) => ({
        name: ix.name || "Prowlarr",
        type: ix.type,
        url: ix.url,
        apiKey: ix.apiKey,
        categories: parseCategories(ix.categories),
        prowlarrTags: serializeProwlarrTags([...DEFAULT_PROWLARR_SEARCH_TAGS]),
        enabled: ix.enabled !== false,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  if (dbClients.length === 0 && config.downloadClients.length > 0) {
    await db.insert(downloadClientsTable).values(
      config.downloadClients.map((cl) => ({
        name: cl.name || cl.type,
        type: cl.type as (typeof downloadClientsTable.$inferInsert)["type"],
        url: cl.url,
        apiKey: cl.apiKey,
        category: cl.category ?? "snatcharr",
        enabled: cl.enabled !== false,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  if (dbApps.length === 0 && config.externalApps.length > 0) {
    await db.insert(externalAppsTable).values(
      config.externalApps.map((ap) => ({
        name: ap.name || ap.type,
        type: ap.type as (typeof externalAppsTable.$inferInsert)["type"],
        url: ap.url,
        apiKey: ap.apiKey || null,
        enabled: ap.enabled !== false,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
}

/** Mark setup finished in config + DB settings after admin repair. */
export async function finalizeSetupState(adminUsername: string): Promise<void> {
  const config = getConfig();
  const generalSettings = generalFromConfig(config);

  updateConfig({ setupComplete: true, adminUsername });
  await setManySettings({
    ...generalToDbSettings(generalSettings),
    setupCompleted: true,
  });

  const { syncGlobalGrabLimitToUsers } = await import("./user-limits-sync");
  await syncGlobalGrabLimitToUsers(generalSettings.maxGrabsPerUserPerDay);
}
