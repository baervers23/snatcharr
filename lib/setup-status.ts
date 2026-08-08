import Database from "better-sqlite3";
import { invalidateConfigCache, getConfig, updateConfig } from "./config";
import { configFileExists } from "./setup-config";
import { getConfigPath } from "./paths";
import { getDbPath } from "./db/migrate";
import { SETUP_ADMIN_ID } from "./setup-prefill";

function truthySetupFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export type SetupPageStatus = {
  configPath: string;
  dbPath: string;
  configExists: boolean;
  configSetupComplete: boolean;
  hasPrimaryLocalAdmin: boolean;
  needsPrimaryLocalAdmin: boolean;
  adminNeedsPassword: boolean;
};

type UserRow = {
  id: string;
  role: string;
  password_hash: string | null;
  is_active: number | null;
};

function readUsersFromDb(dbPath: string): UserRow[] {
  const sqlite = new Database(dbPath, { readonly: true });
  try {
    return sqlite.prepare("SELECT id, role, password_hash, is_active FROM users").all() as UserRow[];
  } finally {
    sqlite.close();
  }
}

/** Read users directly from SQLite — same path the app uses for all DB access. */
export function hasPrimaryLocalAdminSync(): boolean {
  const dbPath = getDbPath();
  try {
    const rows = readUsersFromDb(dbPath);
    return rows.some((u) => {
      if (u.is_active === 0) return false;
      const hasPassword = !!u.password_hash?.trim();
      if (u.id === SETUP_ADMIN_ID && u.role === "admin") return hasPassword;
      return u.role === "admin" && hasPassword;
    });
  } catch (err) {
    console.error(`[Setup] hasPrimaryLocalAdmin failed (${dbPath}):`, err);
    return false;
  }
}

/** Admin row id "1" exists but password_hash is empty — needs password on setup step 1. */
export function adminNeedsPasswordSync(): boolean {
  const dbPath = getDbPath();
  try {
    const rows = readUsersFromDb(dbPath);
    const primary = rows.find((u) => u.id === SETUP_ADMIN_ID && u.role === "admin");
    if (!primary || primary.is_active === 0) return false;
    return !primary.password_hash?.trim();
  } catch {
    return false;
  }
}

export async function hasPrimaryLocalAdmin(): Promise<boolean> {
  return hasPrimaryLocalAdminSync();
}

export async function getSetupPageStatus(): Promise<SetupPageStatus> {
  invalidateConfigCache();
  const config = getConfig();
  const dbPath = getDbPath();
  const exists = configFileExists();
  const configSetupComplete = truthySetupFlag(config.setupComplete);
  const hasAdmin = hasPrimaryLocalAdminSync();
  const adminNeedsPassword = adminNeedsPasswordSync();

  return {
    configPath: getConfigPath(),
    dbPath,
    configExists: exists,
    configSetupComplete,
    hasPrimaryLocalAdmin: hasAdmin,
    needsPrimaryLocalAdmin: !hasAdmin,
    adminNeedsPassword,
  };
}

/** Log config.json presence and setupComplete at container startup (docker logs). */
export function logStartupConfigStatus(): void {
  invalidateConfigCache();
  const configPath = getConfigPath();
  const dbPath = getDbPath();
  const exists = configFileExists();

  if (!exists) {
    console.log(`[Snatcharr] Config not found: ${configPath}`);
    return;
  }

  const config = getConfig();
  const setupComplete = truthySetupFlag(config.setupComplete);

  if (setupComplete) {
    console.log(`[Snatcharr] Config ready: ${configPath} (setupComplete: true)`);
  } else {
    console.log(`[Snatcharr] Config found: ${configPath} (setupComplete: false)`);
  }

  if (!setupComplete) return;

  const hasAdmin = hasPrimaryLocalAdminSync();
  if (hasAdmin) {
    console.log(`[Snatcharr] Primary local admin found in ${dbPath}`);
    return;
  }

  console.warn(
    `[Snatcharr] Setup repair needed: ${configPath} has setupComplete: true but no primary local admin in ${dbPath}`,
  );
}

/** Setup is done when a local admin with password exists. */
export async function isSetupComplete(): Promise<boolean> {
  try {
    const { ensureDatabaseReady } = await import("./db/migrate");
    ensureDatabaseReady();

    invalidateConfigCache();
    const hasAdmin = hasPrimaryLocalAdminSync();
    if (!hasAdmin) return false;

    const config = getConfig();
    if (!truthySetupFlag(config.setupComplete)) {
      updateConfig({ setupComplete: true });
    }
    return true;
  } catch (err) {
    console.error("[Setup] isSetupComplete failed:", err);
    return false;
  }
}
