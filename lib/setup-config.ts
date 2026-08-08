import fs from "fs";
import { getConfig, saveConfig, type AppConfig } from "./config";
import { getConfigPath } from "./paths";
import type { SetupGeneralSettings } from "./setup-settings";
import { generalToConfigPatch } from "./setup-settings";

/** Cookie set when setup wizard completes (read by middleware). */
export const SETUP_COOKIE = "snatcharr_setup_done";

type DraftIndexer = {
  id: string;
  name: string;
  type: string;
  url: string;
  apiKey: string;
  categories?: string;
};

type DraftClient = {
  id: string;
  name: string;
  type: string;
  url: string;
  apiKey: string;
  category?: string;
};

type DraftApp = {
  id: string;
  name: string;
  type: string;
  url: string;
  apiKey?: string;
};

export function configFileExists(): boolean {
  return fs.existsSync(getConfigPath());
}

export function buildConfigSnapshot(opts: {
  setupComplete: boolean;
  adminUsername?: string;
  indexers?: DraftIndexer[];
  clients?: DraftClient[];
  apps?: DraftApp[];
  generalSettings?: Partial<SetupGeneralSettings>;
}): AppConfig {
  const config = getConfig();
  const gs = opts.generalSettings;
  const patch = gs ? generalToConfigPatch(gs as SetupGeneralSettings) : {};

  return {
    ...config,
    ...patch,
    setupComplete: opts.setupComplete,
    adminUsername: opts.adminUsername ?? config.adminUsername,
    indexers: opts.indexers
      ? opts.indexers.map((ix) => ({
          id: ix.id,
          name: ix.name,
          type: ix.type,
          url: ix.url,
          apiKey: ix.apiKey,
          categories: ix.categories ?? "",
          enabled: true,
        }))
      : config.indexers,
    downloadClients: opts.clients
      ? opts.clients.map((cl) => ({
          id: cl.id,
          name: cl.name,
          type: cl.type,
          url: cl.url,
          apiKey: cl.apiKey,
          category: cl.category ?? "snatcharr",
          enabled: true,
        }))
      : config.downloadClients,
    externalApps: opts.apps
      ? opts.apps.map((ap) => ({
          id: ap.id,
          name: ap.name,
          type: ap.type,
          url: ap.url,
          apiKey: ap.apiKey ?? "",
          enabled: true,
        }))
      : config.externalApps,
  };
}

/** Persist in-progress setup wizard state. Preserves setupComplete when already true. */
export function saveSetupDraft(opts: {
  adminUsername?: string;
  indexers?: DraftIndexer[];
  clients?: DraftClient[];
  apps?: DraftApp[];
  generalSettings?: Partial<SetupGeneralSettings>;
}): AppConfig {
  const current = getConfig();
  const updated = buildConfigSnapshot({
    ...opts,
    setupComplete: current.setupComplete === true,
  });
  saveConfig(updated);
  return updated;
}

/** Persist finished setup — full snapshot with setupComplete: true. */
export function saveSetupComplete(opts: {
  adminUsername?: string;
  indexers?: DraftIndexer[];
  clients?: DraftClient[];
  apps?: DraftApp[];
  generalSettings?: Partial<SetupGeneralSettings>;
}): AppConfig {
  const updated = buildConfigSnapshot({ ...opts, setupComplete: true });
  saveConfig(updated);
  return updated;
}
