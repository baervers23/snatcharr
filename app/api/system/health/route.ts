import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { indexers, downloadClients } from "@/lib/db/schema";
import { testProwlarrConnection } from "@/lib/prowlarr";
import { testSabnzbdConnection } from "@/lib/sabnzbd";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const indexerList = await db.query.indexers.findMany({ where: eq(indexers.enabled, true) });
  const clientList = await db.query.downloadClients.findMany({ where: eq(downloadClients.enabled, true) });

  const results = await Promise.all([
    ...indexerList.map(async (idx) => {
      const result = await testProwlarrConnection(idx.prowlarrUrl, idx.apiKey);
      await db.update(indexers).set({
        lastCheckedAt: new Date(),
        lastStatus: result.ok ? "ok" : "error",
        lastError: result.error ?? null,
        updatedAt: new Date(),
      }).where(eq(indexers.id, idx.id));
      return { id: idx.id, status: result.ok ? "ok" as const : "error" as const, message: result.error };
    }),
    ...clientList.map(async (client) => {
      const result = await testSabnzbdConnection(client.url, client.apiKey);
      await db.update(downloadClients).set({
        lastCheckedAt: new Date(),
        lastStatus: result.ok ? "ok" : "error",
        lastError: result.error ?? null,
        updatedAt: new Date(),
      }).where(eq(downloadClients.id, client.id));
      return { id: client.id, status: result.ok ? "ok" as const : "error" as const, message: result.error };
    }),
  ]);

  return NextResponse.json({ results });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const indexerList = await db.query.indexers.findMany();
  const clientList = await db.query.downloadClients.findMany();

  return NextResponse.json({
    indexers: indexerList.map((i) => ({ id: i.id, name: i.name, status: i.lastStatus, error: i.lastError })),
    clients: clientList.map((c) => ({ id: c.id, name: c.name, status: c.lastStatus, error: c.lastError })),
  });
}
