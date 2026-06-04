/**
 * Run this at app startup to ensure DB is initialized.
 * Called from instrumentation.ts (Next.js 15 server startup hook).
 */
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export async function runMigrations() {
  const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const dbPath = process.env.DATABASE_URL?.replace("file:", "") ?? path.join(DATA_DIR, "snatcharr.db");
  const migrationsFolder = path.join(process.cwd(), "lib/db/migrations");

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite);

  if (fs.existsSync(migrationsFolder) && fs.readdirSync(migrationsFolder).length > 0) {
    migrate(db, { migrationsFolder });
    console.log("[Snatcharr] Database migrations applied.");
  } else {
    // First run: create tables inline using the schema (no migration files yet)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        max_grabs_per_day INTEGER DEFAULT 20,
        max_grabs_total INTEGER,
        show_grabs_public INTEGER DEFAULT 0,
        email_notifications INTEGER DEFAULT 0,
        jellyfin_user_id TEXT,
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
        prowlarr_url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        categories TEXT NOT NULL DEFAULT '[]',
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
        download_token TEXT UNIQUE,
        download_token_expires_at INTEGER,
        is_public INTEGER DEFAULT 0,
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
    `);
    console.log("[Snatcharr] Database tables created.");
  }

  sqlite.close();
}
