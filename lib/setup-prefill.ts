import {
  getConfig,
  type AppConfig,
  type DownloadClientConfig,
  type ExternalAppConfig,
  type IndexerConfig,
} from "./config";
import { db } from "./db";
import { downloadClients, externalApps, indexers, users } from "./db/schema";
import { getAllSettings } from "./db/settings";
import { eq } from "drizzle-orm";
import { configFileExists } from "./setup-config";
import {
  generalFromConfig,
  mergeGeneralFromDb,
  type SetupGeneralSettings,
} from "./setup-settings";

export const SETUP_ADMIN_ID = "1";

export type SetupPrefillIndexer = {
  id: string;
  name: string;
  type: string;
  url: string;
  apiKey: string;
  categories: string;
  tested: boolean;
};

export type SetupPrefillClient = {
  id: string;
  name: string;
  type: string;
  url: string;
  apiKey: string;
  category: string;
  tested: boolean;
};

export type SetupPrefillApp = {
  id: string;
  name: string;
  type: string;
  url: string;
  apiKey: string;
  tested: boolean;
};

export type SetupPrefillData = {
  adminUsername: string;
  indexers: SetupPrefillIndexer[];
  clients: SetupPrefillClient[];
  apps: SetupPrefillApp[];
  generalSettings: SetupGeneralSettings;
  hasExistingData: boolean;
  loadedFromConfig: boolean;
};

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mergeByUrl<T extends { url: string }>(primary: T[], secondary: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...primary, ...secondary]) {
    const key = item.url.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function categoriesFromDb(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as number[];
    if (Array.isArray(parsed)) return parsed.join(",");
  } catch {
    // ignore
  }
  return "";
}

function mapConfigIndexer(ix: IndexerConfig): SetupPrefillIndexer {
  return {
    id: ix.id || newId(),
    name: ix.name,
    type: ix.type,
    url: ix.url,
    apiKey: ix.apiKey,
    categories: ix.categories ?? "",
    tested: true,
  };
}

function mapConfigClient(cl: DownloadClientConfig): SetupPrefillClient {
  return {
    id: cl.id || newId(),
    name: cl.name,
    type: cl.type,
    url: cl.url,
    apiKey: cl.apiKey,
    category: cl.category ?? "snatcharr",
    tested: true,
  };
}

function mapConfigApp(ap: ExternalAppConfig): SetupPrefillApp {
  return {
    id: ap.id || newId(),
    name: ap.name,
    type: ap.type,
    url: ap.url,
    apiKey: ap.apiKey ?? "",
    tested: true,
  };
}

function hasStep5Data(config: AppConfig, general: SetupGeneralSettings): boolean {
  return (
    general.authMethod !== "local" ||
    general.signupEnabled ||
    general.requireEmail ||
    general.requireAppGrant ||
    general.maxSearchRequestsPerUserPerDay > 0 ||
    general.maxGrabsPerUserPerDay > 0 ||
    general.warningOnOpen !== "disabled" ||
    general.importantPopupText.length > 0
  );
}

export async function getSetupPrefillData(): Promise<SetupPrefillData> {
  const fromFile = configFileExists();
  const config = getConfig();
  const dbSettings = await getAllSettings();

  const adminUser = await db.query.users.findFirst({
    where: eq(users.id, SETUP_ADMIN_ID),
    columns: { username: true },
  });

  const configIndexers = config.indexers.map(mapConfigIndexer);
  const configClients = config.downloadClients.map(mapConfigClient);
  const configApps = config.externalApps.map(mapConfigApp);

  let indexersList = configIndexers;
  let clientsList = configClients;
  let appsList = configApps;

  if (!fromFile) {
    const dbIndexers = (await db.query.indexers.findMany()).map((ix) => ({
      id: ix.id,
      name: ix.name,
      type: ix.type,
      url: ix.url,
      apiKey: ix.apiKey,
      categories: categoriesFromDb(ix.categories),
      tested: true,
    }));
    const dbClients = (await db.query.downloadClients.findMany()).map((cl) => ({
      id: cl.id,
      name: cl.name,
      type: cl.type,
      url: cl.url,
      apiKey: cl.apiKey,
      category: cl.category ?? "snatcharr",
      tested: true,
    }));
    const dbApps = (await db.query.externalApps.findMany()).map((ap) => ({
      id: ap.id,
      name: ap.name,
      type: ap.type,
      url: ap.url,
      apiKey: ap.apiKey ?? "",
      tested: true,
    }));
    indexersList = dbIndexers;
    clientsList = dbClients;
    appsList = dbApps;
  } else {
    const dbIndexers = (await db.query.indexers.findMany()).map((ix) => ({
      id: ix.id,
      name: ix.name,
      type: ix.type,
      url: ix.url,
      apiKey: ix.apiKey,
      categories: categoriesFromDb(ix.categories),
      tested: true,
    }));
    const dbClients = (await db.query.downloadClients.findMany()).map((cl) => ({
      id: cl.id,
      name: cl.name,
      type: cl.type,
      url: cl.url,
      apiKey: cl.apiKey,
      category: cl.category ?? "snatcharr",
      tested: true,
    }));
    const dbApps = (await db.query.externalApps.findMany()).map((ap) => ({
      id: ap.id,
      name: ap.name,
      type: ap.type,
      url: ap.url,
      apiKey: ap.apiKey ?? "",
      tested: true,
    }));
    indexersList = mergeByUrl(configIndexers, dbIndexers);
    clientsList = mergeByUrl(configClients, dbClients);
    appsList = mergeByUrl(configApps, dbApps);
  }

  const adminUsername = config.adminUsername ?? adminUser?.username ?? "";
  const generalSettings = mergeGeneralFromDb(config, dbSettings);

  const hasExistingData =
    fromFile ||
    !!adminUsername ||
    indexersList.length > 0 ||
    clientsList.length > 0 ||
    appsList.length > 0 ||
    hasStep5Data(config, generalSettings);

  return {
    adminUsername,
    indexers: indexersList,
    clients: clientsList,
    apps: appsList,
    generalSettings,
    hasExistingData,
    loadedFromConfig: fromFile,
  };
}
