/**
 * Database bootstrap — creates tables if missing.
 * Called from instrumentation.ts and lazily on first db access.
 */
import { backfillLifetimeStats } from "./backfill-lifetime";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { ensureAppDataDir, getAppDataDir } from "../paths";

let _schemaReady = false;

export function getDbPath(): string {
  const env = process.env.DATABASE_URL?.trim();
  if (env) {
    const raw = env.replace(/^file:/, "");
    if (path.isAbsolute(raw)) return raw;
    // file:./data/snatcharr.db → /app/data/snatcharr.db (Docker volume)
    return path.join(getAppDataDir(), path.basename(raw));
  }
  return path.join(getAppDataDir(), "snatcharr.db");
}

function bootstrapSchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      max_grabs_per_day INTEGER DEFAULT 20,
      max_grabs_total INTEGER,
      max_downloads_per_day INTEGER,
      can_grab INTEGER DEFAULT 1,
      can_download INTEGER DEFAULT 1,
      show_grabs_public INTEGER DEFAULT 0,
      hide_my_grabs INTEGER DEFAULT 0,
      ignore_synced_limits INTEGER DEFAULT 0,
      email_notifications INTEGER DEFAULT 0,
      jellyfin_user_id TEXT,
      avatar_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS indexers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      categories TEXT NOT NULL DEFAULT '[]',
      prowlarr_tags TEXT DEFAULT '["snatcharr-only"]',
      enabled INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      last_checked_at INTEGER,
      last_status TEXT DEFAULT 'unknown',
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS download_clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'sabnzbd',
      url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      category TEXT DEFAULT 'snatcharr',
      enabled INTEGER DEFAULT 1,
      is_default INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 0,
      last_checked_at INTEGER,
      last_status TEXT DEFAULT 'unknown',
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS external_apps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      api_key TEXT,
      enabled INTEGER DEFAULT 1,
      last_checked_at INTEGER,
      last_status TEXT DEFAULT 'unknown',
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grabs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      download_client_id TEXT REFERENCES download_clients(id),
      title TEXT NOT NULL,
      indexer_name TEXT,
      category TEXT,
      category_id INTEGER,
      size_bytes INTEGER,
      age_seconds INTEGER,
      guid TEXT,
      nzb_url TEXT,
      download_client_job_id TEXT,
      status TEXT DEFAULT 'queued',
      progress REAL DEFAULT 0,
      downloaded_bytes INTEGER DEFAULT 0,
      speed_bytes_per_sec INTEGER DEFAULT 0,
      eta_seconds INTEGER,
      archive_path TEXT,
      archive_password TEXT,
      nzb_password TEXT,
      storage_path TEXT,
      download_token TEXT UNIQUE,
      download_token_expires_at INTEGER,
      is_public INTEGER DEFAULT 1,
      queued_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      expires_at INTEGER,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_daily_usage (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period_start INTEGER NOT NULL,
      search_count INTEGER NOT NULL DEFAULT 0,
      grab_count INTEGER NOT NULL DEFAULT 0,
      download_count INTEGER NOT NULL DEFAULT 0,
      manual_nzb_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, period_start)
    );
  `);
}

function applyColumnAdditions(sqlite: Database.Database): void {
  const columnAdditions: string[] = [
    "ALTER TABLE users ADD COLUMN avatar_url TEXT",
    "ALTER TABLE external_apps ADD COLUMN last_checked_at INTEGER",
    "ALTER TABLE external_apps ADD COLUMN last_status TEXT DEFAULT 'unknown'",
    "ALTER TABLE external_apps ADD COLUMN last_error TEXT",
    "ALTER TABLE grabs ADD COLUMN nzb_password TEXT",
    "ALTER TABLE grabs ADD COLUMN storage_path TEXT",
    "ALTER TABLE users ADD COLUMN hide_my_grabs INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN ignore_synced_limits INTEGER DEFAULT 0",
    "ALTER TABLE user_daily_usage ADD COLUMN grab_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE user_daily_usage ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN lifetime_grabs INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN lifetime_completed INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN lifetime_bytes INTEGER DEFAULT 0",
    "ALTER TABLE grabs ADD COLUMN lifetime_bytes_recorded INTEGER DEFAULT 0",
    `ALTER TABLE indexers ADD COLUMN prowlarr_tags TEXT DEFAULT '["snatcharr-only","radarr","sonarr"]'`,
    "ALTER TABLE users ADD COLUMN can_upload_nzb INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN max_manual_nzb_per_day INTEGER",
    "ALTER TABLE grabs ADD COLUMN source TEXT DEFAULT 'search'",
    "ALTER TABLE user_daily_usage ADD COLUMN manual_nzb_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN email_verification_token TEXT",
    "ALTER TABLE users ADD COLUMN email_verification_expires_at INTEGER",
    "ALTER TABLE download_clients ADD COLUMN is_default INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN can_pick_downloader INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN imported INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN password_reset_token TEXT",
    "ALTER TABLE users ADD COLUMN password_reset_expires_at INTEGER",
    "ALTER TABLE grabs ADD COLUMN download_client_status TEXT",
    "ALTER TABLE grabs ADD COLUMN download_client_message TEXT",
    "ALTER TABLE grabs ADD COLUMN download_client_alert TEXT",
  ];
  for (const stmt of columnAdditions) {
    try {
      sqlite.exec(stmt);
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (!msg.includes("duplicate column name")) {
        console.warn(`[Snatcharr] Migration step skipped: ${stmt} → ${msg}`);
      }
    }
  }
}

/** Idempotent — safe to call on every process start and before first query. */
export function ensureDatabaseReady(): void {
  if (_schemaReady) return;

  ensureAppDataDir();
  const dbPath = getDbPath();
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  bootstrapSchema(sqlite);
  applyColumnAdditions(sqlite);

  backfillLifetimeStats(sqlite);

  try {
    const def = sqlite.prepare("SELECT id FROM download_clients WHERE is_default = 1 LIMIT 1").get();
    if (!def) {
      const first = sqlite.prepare("SELECT id FROM download_clients ORDER BY priority ASC, name ASC LIMIT 1").get() as
        | { id: string }
        | undefined;
      if (first) {
        sqlite.prepare("UPDATE download_clients SET is_default = 0").run();
        sqlite.prepare("UPDATE download_clients SET is_default = 1 WHERE id = ?").run(first.id);
      }
    }
  } catch {
    /* column may not exist yet on very old DBs */
  }

  const migrationsFolder = path.join(process.cwd(), "lib/db/migrations");
  const migrationFiles = fs.existsSync(migrationsFolder)
    ? fs.readdirSync(migrationsFolder).filter((f) => f.endsWith(".sql"))
    : [];
  if (migrationFiles.length > 0) {
    try {
      migrate(drizzle(sqlite), { migrationsFolder });
      console.log("[Snatcharr] Drizzle migrations applied.");
    } catch (err) {
      console.warn("[Snatcharr] Drizzle migrate skipped:", err);
    }
  }

  try {
    sqlite.exec(`
      UPDATE indexers SET prowlarr_tags = '["snatcharr-only"]'
      WHERE prowlarr_tags IS NULL
         OR prowlarr_tags = '[]'
         OR prowlarr_tags = '["snatcharr-only","radarr","sonarr"]'
    `);
  } catch {
    /* indexers table may not exist yet */
  }

  sqlite.close();
  _schemaReady = true;
  console.log("[Snatcharr] Database ready:", dbPath);
}

export async function runMigrations(): Promise<void> {
  ensureDatabaseReady();
}
