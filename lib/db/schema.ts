import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";


export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiresAt: integer("email_verification_expires_at", { mode: "timestamp" }),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  maxGrabsPerDay: integer("max_grabs_per_day").default(20),
  maxGrabsTotal: integer("max_grabs_total"),
  maxDownloadsPerDay: integer("max_downloads_per_day"),
  canGrab: integer("can_grab", { mode: "boolean" }).default(true),
  canDownload: integer("can_download", { mode: "boolean" }).default(true),
  canUploadNzb: integer("can_upload_nzb", { mode: "boolean" }).default(false),
  canPickDownloader: integer("can_pick_downloader", { mode: "boolean" }).default(false),
  maxManualNzbPerDay: integer("max_manual_nzb_per_day"),
  showGrabsPublic: integer("show_grabs_public", { mode: "boolean" }).default(false),
  hideMyGrabs: integer("hide_my_grabs", { mode: "boolean" }).default(false),
  ignoreSyncedLimits: integer("ignore_synced_limits", { mode: "boolean" }).default(false),
  emailNotifications: integer("email_notifications", { mode: "boolean" }).default(false),
  jellyfinUserId: text("jellyfin_user_id"),
  /** Set when the account was created via external auth import (Jellyfin/Seerr/etc.). */
  imported: integer("imported", { mode: "boolean" }).default(false),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiresAt: integer("password_reset_expires_at", { mode: "timestamp" }),
  avatarUrl: text("avatar_url"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  /** Total grabs ever queued — not reduced when grab rows are deleted. */
  lifetimeGrabs: integer("lifetime_grabs").default(0),
  lifetimeCompleted: integer("lifetime_completed").default(0),
  lifetimeBytes: integer("lifetime_bytes").default(0),
});

export const sessions = sqliteTable("sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});


export const indexers = sqliteTable("indexers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: text("type").notNull(),
  url: text("url").notNull(),
  apiKey: text("api_key").notNull(),
  categories: text("categories").notNull().default("[]"), // JSON array of category IDs
  /** Prowlarr tag labels to include when searching (JSON string array). Empty/`[]` → snatcharr-only; `["*"]` → all indexers. */
  prowlarrTags: text("prowlarr_tags")
    .notNull()
    .default('["snatcharr-only"]'),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  priority: integer("priority").default(0),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp" }),
  lastStatus: text("last_status", { enum: ["ok", "warning", "error", "unknown"] }).default(
    "unknown",
  ),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});


export const downloadClients = sqliteTable("download_clients", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: text("type", { enum: ["sabnzbd", "nzbget", "nzbvortex"] })
    .notNull()
    .default("sabnzbd"),
  url: text("url").notNull(),
  apiKey: text("api_key").notNull(),
  category: text("category").default("snatcharr"),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  priority: integer("priority").default(0),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp" }),
  lastStatus: text("last_status", { enum: ["ok", "warning", "error", "unknown"] }).default(
    "unknown",
  ),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});


export const externalApps = sqliteTable("external_apps", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["jellyfin", "seerr", "lidarr", "radarr", "sonarr", "organizr", "jfago"],
  }).notNull(),
  url: text("url").notNull(),
  apiKey: text("api_key"),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp" }),
  lastStatus: text("last_status", { enum: ["ok", "warning", "error", "unknown"] }).default(
    "unknown",
  ),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});


export const grabs = sqliteTable("grabs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  downloadClientId: text("download_client_id").references(() => downloadClients.id),

  title: text("title").notNull(),
  indexerName: text("indexer_name"),
  category: text("category"),
  categoryId: integer("category_id"),
  sizeBytes: integer("size_bytes"),
  ageSeconds: integer("age_seconds"),
  guid: text("guid"),
  source: text("source", { enum: ["search", "manual"] }).default("search"),
  nzbUrl: text("nzb_url"), // internal only, never exposed to UI

  downloadClientJobId: text("download_client_job_id"),
  /** Last SABnzbd status string (e.g. Completed, Failed, Downloading). */
  downloadClientStatus: text("download_client_status"),
  /** Human-readable warning/error from the download client. */
  downloadClientMessage: text("download_client_message"),
  downloadClientAlert: text("download_client_alert", { enum: ["error", "warning"] }),
  status: text("status", {
    enum: ["queued", "downloading", "processing", "paused", "failed", "completed", "expired"],
  }).default("queued"),
  progress: real("progress").default(0),
  downloadedBytes: integer("downloaded_bytes").default(0),
  speed: integer("speed_bytes_per_sec").default(0),
  eta: integer("eta_seconds"),

  // Post-processing
  archivePath: text("archive_path"),
  archivePassword: text("archive_password"),
  nzbPassword: text("nzb_password"),
  storagePath: text("storage_path"),
  downloadToken: text("download_token").unique(),
  downloadTokenExpiresAt: integer("download_token_expires_at", { mode: "timestamp" }),

  isPublic: integer("is_public", { mode: "boolean" }).default(false),

  queuedAt: integer("queued_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  lifetimeBytesRecorded: integer("lifetime_bytes_recorded", { mode: "boolean" }).default(false),
});


export const settings = sqliteTable("settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});


export const userDailyUsage = sqliteTable(
  "user_daily_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodStart: integer("period_start", { mode: "timestamp" }).notNull(),
    searchCount: integer("search_count").notNull().default(0),
    grabCount: integer("grab_count").notNull().default(0),
    downloadCount: integer("download_count").notNull().default(0),
    manualNzbCount: integer("manual_nzb_count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.periodStart] })],
);


export const auditLog = sqliteTable("audit_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});


export type User = typeof users.$inferSelect;
export type Indexer = typeof indexers.$inferSelect;
export type DownloadClient = typeof downloadClients.$inferSelect;
export type ExternalApp = typeof externalApps.$inferSelect;
export type Grab = typeof grabs.$inferSelect;
