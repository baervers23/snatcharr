import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { indexers, downloadClients, externalApps } from "@/lib/db/schema";
import { testProwlarrConnection } from "@/lib/prowlarr";
import { testSabnzbdConnection } from "@/lib/sabnzbd";
import { testExternalApp } from "@/lib/app-test";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const indexerList = await db.query.indexers.findMany({ where: eq(indexers.enabled, true) });
  const clientList = await db.query.downloadClients.findMany({ where: eq(downloadClients.enabled, true) });
  const appList = await db.query.externalApps.findMany({ where: eq(externalApps.enabled, true) });

  const results = await Promise.all([
    ...indexerList.map(async (idx) => {
      const result = await testProwlarrConnection(idx.url, idx.apiKey);
      await db.update(indexers).set({
        lastCheckedAt: new Date(),
        lastStatus: result.ok ? "ok" : "error",
        lastError: result.error ?? null,
        updatedAt: new Date(),
      }).where(eq(indexers.id, idx.id));
      const lastCheckedAt = new Date().toISOString();
      return { id: idx.id, status: result.ok ? "ok" as const : "error" as const, message: result.error, lastCheckedAt };
    }),
    ...clientList.map(async (client) => {
      const result = await testSabnzbdConnection(client.url, client.apiKey);
      await db.update(downloadClients).set({
        lastCheckedAt: new Date(),
        lastStatus: result.ok ? "ok" : "error",
        lastError: result.error ?? null,
        updatedAt: new Date(),
      }).where(eq(downloadClients.id, client.id));
      const lastCheckedAt = new Date().toISOString();
      return { id: client.id, status: result.ok ? "ok" as const : "error" as const, message: result.error, lastCheckedAt };
    }),
    ...appList.map(async (app) => {
      const result = await testExternalApp(app.type, app.url, app.apiKey ?? "");
      await db.update(externalApps).set({
        lastCheckedAt: new Date(),
        lastStatus: result.ok ? "ok" : "error",
        lastError: result.error ?? null,
        updatedAt: new Date(),
      }).where(eq(externalApps.id, app.id));
      const lastCheckedAt = new Date().toISOString();
      return { id: app.id, status: result.ok ? "ok" as const : "error" as const, message: result.error, lastCheckedAt };
    }),
  ]);

  return NextResponse.json({ results });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const indexerList = await db.query.indexers.findMany();
  const clientList = await db.query.downloadClients.findMany();
  const appList = await db.query.externalApps.findMany();

  return NextResponse.json({
    indexers: indexerList.map((i) => ({
      id: i.id,
      name: i.name,
      status: i.lastStatus,
      error: i.lastError,
      lastCheckedAt: i.lastCheckedAt,
    })),
    clients: clientList.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.lastStatus,
      error: c.lastError,
      lastCheckedAt: c.lastCheckedAt,
    })),
    apps: appList.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.lastStatus,
      error: a.lastError,
      lastCheckedAt: a.lastCheckedAt,
    })),
  });
}
