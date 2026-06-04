import { sql } from "drizzle-orm";
import {
  integer,
  text,
  sqliteTable,
  real,
  blob,
} from "drizzle-orm/sqlite-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  maxGrabsPerDay: integer("max_grabs_per_day").default(20),
  maxGrabsTotal: integer("max_grabs_total"),
  showGrabsPublic: integer("show_grabs_public", { mode: "boolean" }).default(false),
  emailNotifications: integer("email_notifications", { mode: "boolean" }).default(false),
  jellyfinUserId: text("jellyfin_user_id"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Indexers (Prowlarr) ──────────────────────────────────────────────────────

export const indexers = sqliteTable("indexers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  prowlarrUrl: text("prowlarr_url").notNull(),
  apiKey: text("api_key").notNull(),
  categories: text("categories").notNull().default("[]"), // JSON array of category IDs
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  priority: integer("priority").default(0),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp" }),
  lastStatus: text("last_status", { enum: ["ok", "warning", "error", "unknown"] }).default("unknown"),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Download Clients ─────────────────────────────────────────────────────────

export const downloadClients = sqliteTable("download_clients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: text("type", { enum: ["sabnzbd", "nzbget", "nzbvortex"] }).notNull().default("sabnzbd"),
  url: text("url").notNull(),
  apiKey: text("api_key").notNull(),
  category: text("category").default("snatcharr"),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  priority: integer("priority").default(0),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp" }),
  lastStatus: text("last_status", { enum: ["ok", "warning", "error", "unknown"] }).default("unknown"),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── External Apps ────────────────────────────────────────────────────────────

export const externalApps = sqliteTable("external_apps", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["jellyfin", "jellyseerr", "lidarr", "radarr", "sonarr", "organizr"],
  }).notNull(),
  url: text("url").notNull(),
  apiKey: text("api_key"),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Grabs ────────────────────────────────────────────────────────────────────

export const grabs = sqliteTable("grabs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  downloadClientId: text("download_client_id").references(() => downloadClients.id),

  // NZB metadata
  title: text("title").notNull(),
  indexerName: text("indexer_name"),
  category: text("category"),
  categoryId: integer("category_id"),
  sizeBytes: integer("size_bytes"),
  ageSeconds: integer("age_seconds"),
  guid: text("guid"),
  nzbUrl: text("nzb_url"), // internal only, never exposed to UI

  // Download client tracking
  downloadClientJobId: text("download_client_job_id"),
  status: text("status", {
    enum: ["queued", "downloading", "paused", "failed", "completed", "expired"],
  }).default("queued"),
  progress: real("progress").default(0),
  downloadedBytes: integer("downloaded_bytes").default(0),
  speed: integer("speed_bytes_per_sec").default(0),
  eta: integer("eta_seconds"),

  // Post-processing
  archivePath: text("archive_path"),
  archivePassword: text("archive_password"),
  downloadToken: text("download_token").unique(),
  downloadTokenExpiresAt: integer("download_token_expires_at", { mode: "timestamp" }),

  // Visibility
  isPublic: integer("is_public", { mode: "boolean" }).default(false),

  // Timestamps
  queuedAt: integer("queued_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Indexer = typeof indexers.$inferSelect;
export type NewIndexer = typeof indexers.$inferInsert;
export type DownloadClient = typeof downloadClients.$inferSelect;
export type NewDownloadClient = typeof downloadClients.$inferInsert;
export type ExternalApp = typeof externalApps.$inferSelect;
export type Grab = typeof grabs.$inferSelect;
export type NewGrab = typeof grabs.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
