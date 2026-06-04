import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, indexers, downloadClients, externalApps } from "@/lib/db/schema";
import { setSetting, getSetting } from "@/lib/db/settings";
import { z } from "zod";
import bcrypt from "bcryptjs";

const setupSchema = z.object({
  admin: z.object({
    username: z.string().min(2).max(50),
    password: z.string().min(8),
    confirmPassword: z.string(),
  }),
  indexer: z
    .object({
      name: z.string(),
      prowlarrUrl: z.string().url(),
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
      jellyseerrUrl: z.string().optional(),
      jellyseerrApiKey: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  try {
    // Check if setup already done
    const setupCompleted = await getSetting("setupCompleted");
    if (setupCompleted) {
      return NextResponse.json({ error: "Setup already completed" }, { status: 400 });
    }

    const body = await req.json();
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

    // Create indexer if provided
    if (indexer?.apiKey) {
      const cats = indexer.categories
        ? indexer.categories
            .split(",")
            .map((c) => parseInt(c.trim()))
            .filter((n) => !isNaN(n))
        : [];
      await db.insert(indexers).values({
        name: indexer.name || "Prowlarr",
        prowlarrUrl: indexer.prowlarrUrl,
        apiKey: indexer.apiKey,
        categories: JSON.stringify(cats),
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Create download client if provided
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

    // Create external apps if provided
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
      if (apps.jellyseerrUrl && apps.jellyseerrApiKey) {
        await db.insert(externalApps).values({
          name: "Jellyseerr",
          type: "jellyseerr",
          url: apps.jellyseerrUrl,
          apiKey: apps.jellyseerrApiKey,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Mark setup as complete
    await setSetting("setupCompleted", true);
    await setSetting("instanceName", "Snatcharr");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Setup] Error:", err);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
