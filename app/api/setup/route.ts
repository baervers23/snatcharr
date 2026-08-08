import { db } from "@/lib/db";
import {
  users,
  indexers as indexersTable,
  downloadClients as downloadClientsTable,
  externalApps as externalAppsTable,
} from "@/lib/db/schema";
import { getConfig } from "@/lib/config";
import { setManySettings } from "@/lib/db/settings";
import { saveSetupComplete, saveSetupDraft } from "@/lib/setup-config";
import { getSetupPrefillData } from "@/lib/setup-prefill";
import { generalToDbSettings } from "@/lib/setup-settings";
import { SETUP_COOKIE } from "@/lib/setup-config";
import { DEFAULT_PROWLARR_SEARCH_TAGS, serializeProwlarrTags } from "@/lib/prowlarr-tags";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const SETUP_ADMIN_ID = "1";

const adminSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(8),
  confirmPassword: z.string(),
});

const authMethodSchema = z.enum([
  "local",
  "jellyfin",
  "organizr",
  "organizr-sso",
  "jfago",
  "seerr",
  "seerr-local",
  "seerr-jellyfin",
  "seerr-jellyfin-fallback",
]);

const generalSettingsSchema = z.object({
  authMethod: authMethodSchema.default("local"),
  signupEnabled: z.boolean().default(false),
  requireEmail: z.boolean().default(false),
  requireAppGrant: z.boolean().default(false),
  maxSearchRequestsPerUserPerDay: z.number().int().min(0).default(0),
  maxGrabsPerUserPerDay: z.number().int().min(0).default(0),
  warningOnOpen: z.enum(["once", "always", "disabled"]).default("disabled"),
  importantPopupText: z.string().default(""),
});

// Wizard now sends arrays for each step
const setupSchema = z.object({
  action: z.literal("complete"),

  admin: adminSchema,

  // Step 2 — zero or more indexer clients
  indexers: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        url: z.string().url(),
        apiKey: z.string(),
        categories: z.string().default(""),
        tested: z.boolean().optional(),
      }),
    )
    .default([]),

  // Step 3 — zero or more download clients
  clients: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        url: z.string().url(),
        apiKey: z.string(),
        category: z.string().default("snatcharr"),
        tested: z.boolean().optional(),
      }),
    )
    .default([]),

  // Step 4 — zero or more additional apps (Jellyfin, Seerr, …)
  apps: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        url: z.string().url(),
        apiKey: z.string().default(""),
        tested: z.boolean().optional(),
      }),
    )
    .default([]),

  generalSettings: generalSettingsSchema.default({}),
});

// Connection-test schema — add all supported service types
const testSchema = z.object({
  action: z.literal("test"),
  type: z.enum([
    // Indexers
    "prowlarr",
    "nzbhydra2",
    "jackett",
    // Usenet download clients
    "sabnzbd",
    "nzbget",
    // Torrent download clients
    "qbittorrent",
    "transmission",
    "deluge",
    // *arr apps
    "sonarr",
    "radarr",
    "lidarr",
    "readarr",
    // Additional apps
    "jellyfin",
    "seerr",
    "organizr",
    "jfago",
  ]),
  url: z.string().url("Invalid URL"),
  apiKey: z.string().default(""),
});

async function upsertSetupAdmin(admin: z.infer<typeof adminSchema>): Promise<void> {
  if (admin.password !== admin.confirmPassword) {
    throw new Error("PASSWORDS_MISMATCH");
  }

  const passwordHash = await bcrypt.hash(admin.password, 12);
  const now = new Date();
  const existing = await db.query.users.findFirst({
    where: eq(users.id, SETUP_ADMIN_ID),
  });

  if (existing) {
    await db
      .update(users)
      .set({
        username: admin.username,
        passwordHash,
        role: "admin",
        isActive: true,
        updatedAt: now,
      })
      .where(eq(users.id, SETUP_ADMIN_ID));
    return;
  }

  const sameUsername = await db.query.users.findFirst({
    where: eq(users.username, admin.username),
  });
  if (sameUsername) {
    await db
      .update(users)
      .set({
        passwordHash,
        role: "admin",
        isActive: true,
        updatedAt: now,
      })
      .where(eq(users.id, sameUsername.id));
    return;
  }

  await db.insert(users).values({
    id: SETUP_ADMIN_ID,
    username: admin.username,
    passwordHash,
    role: "admin",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

const progressSchema = z.object({
  indexers: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        url: z.string(),
        apiKey: z.string(),
        categories: z.string().optional(),
      }),
    )
    .optional(),
  clients: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        url: z.string(),
        apiKey: z.string(),
        category: z.string().optional(),
      }),
    )
    .optional(),
  apps: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        url: z.string(),
        apiKey: z.string().optional(),
      }),
    )
    .optional(),
  generalSettings: generalSettingsSchema.partial().optional(),
});

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const prefill = await getSetupPrefillData();
  const { getSetupPageStatus } = await import("@/lib/setup-status");
  const status = await getSetupPageStatus();
  return NextResponse.json({ ...prefill, status });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── Connection test ───────────────────────────────────────────────────────
    if (body.action === "test") {
      const parsed = testSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid test data", details: parsed.error.flatten().fieldErrors },
          { status: 422 },
        );
      }
      return handleConnectionTest(parsed.data);
    }

    // ── Step 1: create or replace setup admin (fixed id "1") ─────────────────
    if (body.action === "saveAdmin") {
      const parsed = adminSchema.safeParse(body.admin);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
          { status: 422 },
        );
      }
      const configBefore = getConfig();
      const configWasComplete = configBefore.setupComplete === true;
      try {
        await upsertSetupAdmin(parsed.data);
        saveSetupDraft({ adminUsername: parsed.data.username });
      } catch (err) {
        if (err instanceof Error && err.message === "PASSWORDS_MISMATCH") {
          return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
        }
        const message = err instanceof Error ? err.message : "Failed to save admin";
        console.error("[Setup] saveAdmin failed:", err);
        return NextResponse.json({ error: message }, { status: 500 });
      }

      if (configWasComplete) {
        const { syncConfigConnectionsToDb, finalizeSetupState } = await import("@/lib/setup-repair");
        await syncConfigConnectionsToDb();
        await finalizeSetupState(parsed.data.username);
        const res = NextResponse.json({ success: true, userId: SETUP_ADMIN_ID, finished: true });
        res.cookies.set(SETUP_COOKIE, "done", {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 365 * 10,
        });
        return res;
      }

      return NextResponse.json({ success: true, userId: SETUP_ADMIN_ID });
    }

    // ── Save wizard progress to config.json (incomplete setup) ───────────────
    if (body.action === "saveProgress") {
      const config = getConfig();
      if (config.setupComplete) {
        return NextResponse.json({ error: "Setup already completed" }, { status: 400 });
      }
      const parsed = progressSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid data" }, { status: 422 });
      }
      saveSetupDraft(parsed.data);
      return NextResponse.json({ success: true });
    }

    // ── Setup complete ────────────────────────────────────────────────────────
    if (body.action === "complete") {
      const config = getConfig();
      if (config.setupComplete) {
        return NextResponse.json({ error: "Setup already completed" }, { status: 400 });
      }

      const parsed = setupSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid data", details: parsed.error.flatten() },
          { status: 422 },
        );
      }

      const { admin, indexers, clients, apps, generalSettings } = parsed.data;

      try {
        await upsertSetupAdmin(admin);
      } catch (err) {
        if (err instanceof Error && err.message === "PASSWORDS_MISMATCH") {
          return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
        }
        throw err;
      }

      // 2. Persist connections to the SQLite DB — this is the source of truth the
      //    running app reads from (search, settings, system, grabs).
      const now = new Date();

      if (indexers.length > 0) {
        await db.insert(indexersTable).values(
          indexers.map((ix) => ({
            name: ix.name || "Prowlarr",
            type: ix.type,
            url: ix.url,
            apiKey: ix.apiKey,
            categories: JSON.stringify(
              ix.categories
                ? ix.categories
                    .split(",")
                    .map((c) => parseInt(c.trim(), 10))
                    .filter((n) => !isNaN(n))
                : [],
            ),
            prowlarrTags: serializeProwlarrTags([...DEFAULT_PROWLARR_SEARCH_TAGS]),
            enabled: true,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }

      if (clients.length > 0) {
        await db.insert(downloadClientsTable).values(
          clients.map((cl) => ({
            name: cl.name || cl.type,
            type: cl.type as (typeof downloadClientsTable.$inferInsert)["type"],
            url: cl.url,
            apiKey: cl.apiKey,
            category: cl.category,
            enabled: true,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }

      if (apps.length > 0) {
        await db.insert(externalAppsTable).values(
          apps.map((ap) => ({
            name: ap.name || ap.type,
            type: ap.type as (typeof externalAppsTable.$inferInsert)["type"],
            url: ap.url,
            apiKey: ap.apiKey || null,
            enabled: true,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }

      // 3. Full snapshot to config.json + sync step 5 settings to DB.
      saveSetupComplete({
        adminUsername: admin.username,
        indexers,
        clients,
        apps,
        generalSettings,
      });

      await setManySettings({
        ...generalToDbSettings(generalSettings),
        instanceName: config.instanceName,
      });

      const { syncGlobalGrabLimitToUsers } = await import("@/lib/user-limits-sync");
      await syncGlobalGrabLimitToUsers(generalSettings.maxGrabsPerUserPerDay);

      console.info(
        `[Setup] Completed. Admin: ${admin.username}, Indexers: ${indexers.length}, Clients: ${clients.length}, Apps: ${apps.length}`,
      );

      // Set a long-lived cookie so middleware knows setup is done without
      // needing file-system access (avoids cross-context cache issues).
      const res = NextResponse.json({ success: true });
      res.cookies.set(SETUP_COOKIE, "done", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
      });
      return res;
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[Setup] Error:", err);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}

// ─── Connection test handler ──────────────────────────────────────────────────

async function handleConnectionTest({
  type,
  url,
  apiKey,
}: {
  type: string;
  url: string;
  apiKey: string;
}) {
  try {
    let cleanUrl = url.trim().replace(/\/$/, "");
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = "http://" + cleanUrl;
    }

    let testUrl = "";
    let headers: HeadersInit = {};
    let method: "GET" | "POST" = "GET";
    let reqBody: string | undefined;

    switch (type.toLowerCase()) {
      case "prowlarr":
        testUrl = `${cleanUrl}/api/v1/health`;
        headers = { "X-Api-Key": apiKey };
        break;

      // NZBHydra2 — GET /api?t=caps (works with or without API key)
      case "nzbhydra2":
        testUrl = apiKey
          ? `${cleanUrl}/api?t=caps&apikey=${encodeURIComponent(apiKey)}`
          : `${cleanUrl}/api?t=caps`;
        break;

      // Jackett — GET /api/v2.0/indexers/all/results/torznab?t=caps
      case "jackett":
        testUrl = `${cleanUrl}/api/v2.0/indexers/all/results/torznab/api?t=caps&apikey=${encodeURIComponent(apiKey)}`;
        break;

      case "sonarr":
      case "radarr":
      case "lidarr":
      case "readarr":
        testUrl = `${cleanUrl}/api/v1/system/status`;
        headers = { "X-Api-Key": apiKey };
        break;

      case "sabnzbd":
        testUrl = `${cleanUrl}/api?mode=version&apikey=${encodeURIComponent(apiKey)}`;
        break;

      case "nzbget":
        testUrl = `${cleanUrl}/jsonrpc`;
        method = "POST";
        headers = { "Content-Type": "application/json" };
        reqBody = JSON.stringify({ method: "status", params: [], id: 1 });
        break;

      case "qbittorrent":
        testUrl = `${cleanUrl}/api/v2/app/version`;
        break;

      case "transmission":
        testUrl = `${cleanUrl}/transmission/rpc`;
        break;

      case "deluge":
        testUrl = `${cleanUrl}/json`;
        method = "POST";
        headers = { "Content-Type": "application/json" };
        reqBody = JSON.stringify({ method: "auth.check_session", params: [], id: 1 });
        break;

      case "jellyfin":
        testUrl = `${cleanUrl}/System/Info/Public`;
        if (apiKey) headers = { "X-MediaBrowser-Token": apiKey };
        break;

      case "seerr":
        testUrl = `${cleanUrl}/api/v1/status`;
        if (apiKey) headers = { "X-Api-Key": apiKey };
        break;

      case "organizr":
        testUrl = `${cleanUrl}/api/?v=1&apikey=${encodeURIComponent(apiKey)}&call=user/checkKey`;
        break;

      default:
        return NextResponse.json({ error: "Unknown service type" }, { status: 400 });
    }

    console.info(`[Connection Test][${type}] → ${testUrl}`);

    const response = await fetch(testUrl, {
      method,
      headers,
      body: reqBody,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (response.ok) {
      return NextResponse.json({ success: true, message: "Connected successfully" });
    }

    let errorMsg = `HTTP ${response.status}`;
    try {
      const errData = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      errorMsg = errData.error ?? errData.message ?? errorMsg;
    } catch {
      // keep the status-code message
    }

    return NextResponse.json({ error: errorMsg, status: response.status }, { status: 400 });
  } catch (error: unknown) {
    const err = error as { message?: string; name?: string; code?: string };
    console.error(`[Connection Test][${type}] Error:`, err);

    let message = "Connection failed.";
    if (err.name === "TimeoutError") {
      message = "Timeout — is the service running and reachable?";
    } else if (err.code === "ECONNREFUSED") {
      message = "Connection refused — service not running or wrong IP/port.";
    } else if (err.message?.includes("Invalid URL")) {
      message = "Invalid URL — must start with http:// or https://";
    }

    return NextResponse.json({ error: message, details: err.message }, { status: 500 });
  }
}
