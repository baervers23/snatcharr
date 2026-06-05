import { db } from "@/lib/db";
import { downloadClients, externalApps, indexers, users } from "@/lib/db/schema";
import { getSetting, setSetting } from "@/lib/db/settings";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const setupSchema = z.object({
  admin: z.object({
    username: z.string().min(2).max(50),
    password: z.string().min(8),
    confirmPassword: z.string(),
  }),
  indexer: z
    .object({
      name: z.string(),
      type: z.enum(["prowlarr"]), // Hier können weitere Typen wie "nzbget", "prowlarr" etc. hinzugefügt werden
      url: z.string().url(),
      apiKey: z.string(),
      categories: z.string().default(""),
    })
    .nullable()
    .optional(),
  downloadClient: z
    .object({
      name: z.string(),
      type: z.enum(["sabnzbd", "nzbget", "nzbvortex"]),
      url: z.string().url(),
      apiKey: z.string(),
      category: z.string().default("snatcharr"),
    })
    .nullable()
    .optional(),
  apps: z
    .object({
      jellyfinUrl: z.string().optional(),
      jellyfinApiKey: z.string().optional(),
      seerrUrl: z.string().optional(),
      seerrApiKey: z.string().optional(),
    })
    .optional(),
});

// === TEST SCHEMA (verbessert) ===
const testSchema = z.object({
  action: z.literal("test"),
  type: z.enum(["prowlarr", "sabnzbd", "nzbget", "sonarr", "radarr", "lidarr", "readarr"]),
  url: z.string().url("Ungültige URL"),
  apiKey: z.string().min(5, "API-Key zu kurz"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // === TEST CONNECTION ===
    if (body.action === "test") {
      const parsed = testSchema.safeParse(body);
      if (!parsed.success) {
        console.error("[Test Schema Error]:", parsed.error.flatten());
        return NextResponse.json(
          {
            error: "Ungültige Test-Daten",
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 422 },
        );
      }
      return await handleConnectionTest(parsed.data);
    }

    // === NORMAL SETUP ===
    const setupCompleted = await getSetting("setupCompleted");
    if (setupCompleted) {
      return NextResponse.json({ error: "Setup already completed" }, { status: 400 });
    }

    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { admin, indexer, downloadClient, apps } = parsed.data;

    if (admin.password !== admin.confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    // Create admin user
    const passwordHash = await bcrypt.hash(admin.password, 12);
    await db.insert(users).values({
      username: admin.username,
      passwordHash,
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Indexer
    if (indexer?.apiKey) {
      const cats = indexer.categories
        ? indexer.categories
            .split(",")
            .map((c) => parseInt(c.trim()))
            .filter((n) => !isNaN(n))
        : [];
      await db.insert(indexers).values({
        name: indexer.name,
        type: indexer.type,
        url: indexer.url,
        apiKey: indexer.apiKey,
        categories: JSON.stringify(cats),
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Download Client
    if (downloadClient?.apiKey) {
      await db.insert(downloadClients).values({
        name: downloadClient.name || "SABnzbd",
        type: downloadClient.type,
        url: downloadClient.url,
        apiKey: downloadClient.apiKey,
        category: downloadClient.category,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // External Apps
    if (apps) {
      if (apps.jellyfinUrl && apps.jellyfinApiKey) {
        await db.insert(externalApps).values({
          name: "Jellyfin",
          type: "jellyfin",
          url: apps.jellyfinUrl,
          apiKey: apps.jellyfinApiKey,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      if (apps.seerrUrl && apps.seerrApiKey) {
        await db.insert(externalApps).values({
          name: "Seerr",
          type: "seerr",
          url: apps.seerrUrl,
          apiKey: apps.seerrApiKey,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    await setSetting("setupCompleted", true);
    await setSetting("instanceName", "Snatcharr");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Setup] Error:", err);
    return NextResponse.json({ error: "Setup fehlgeschlagen" }, { status: 500 });
  }
}

// ==================== CONNECTION TEST HANDLER (verbessert) ====================
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
    // URL bereinigen und validieren
    let cleanUrl = url.trim();

    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = "http://" + cleanUrl;
    }

    cleanUrl = cleanUrl.replace(/\/$/, ""); // trailing slash entfernen

    console.log(`[Connection Test][${type}] Testing: ${cleanUrl}`);

    let testUrl = "";
    let headers: HeadersInit = {};
    let method: "GET" | "POST" = "GET";
    let body: any = undefined;

    switch (type.toLowerCase()) {
      case "prowlarr":
        testUrl = `${cleanUrl}/api/v1/health`;
        headers = { "X-Api-Key": apiKey };
        break;

      case "sonarr":
      case "radarr":
      case "lidarr":
      case "readarr":
        testUrl = `${cleanUrl}/api/v1/system/status?apikey=${encodeURIComponent(apiKey)}`;
        break;

      case "sabnzbd":
        testUrl = `${cleanUrl}/api?mode=version&apikey=${encodeURIComponent(apiKey)}`;
        break;

      case "nzbget":
        testUrl = `${cleanUrl}/jsonrpc`;
        method = "POST";
        headers = { "Content-Type": "application/json" };
        body = JSON.stringify({ method: "status", params: [], id: 1 });
        break;

      default:
        return NextResponse.json({ error: "Unbekannter Typ" }, { status: 400 });
    }

    console.log(`[Connection Test][${type}] Fetching: ${testUrl}`);

    const response = await fetch(testUrl, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(12000), // 12 Sekunden
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: "Verbindung erfolgreich",
      });
    }

    let errorMsg = `Status ${response.status}`;
    try {
      const errData = await response.json().catch(() => ({}));
      errorMsg = errData.error || errData.message || errorMsg;
    } catch {
      // Ignore JSON parse errors, we already have a fallback error message
    }

    return NextResponse.json(
      {
        error: errorMsg,
        status: response.status,
        url: testUrl,
      },
      { status: 400 },
    );
  } catch (error: any) {
    console.error(`[Connection Test][${type}] Error:`, error);

    let message = "Verbindung fehlgeschlagen.";

    if (error.message?.includes("unknown scheme") || error.message?.includes("Invalid URL")) {
      message = "Ungültige URL. Bitte mit http:// oder https:// beginnen.";
    } else if (error.name === "TimeoutError") {
      message = "Timeout: Der Dienst antwortet nicht (läuft er und ist erreichbar?)";
    } else if (error.code === "ECONNREFUSED") {
      message = "Verbindung verweigert – Dienst läuft nicht oder falsche IP/Port.";
    }

    return NextResponse.json(
      {
        error: message,
        details: error.message,
      },
      { status: 500 },
    );
  }
}
