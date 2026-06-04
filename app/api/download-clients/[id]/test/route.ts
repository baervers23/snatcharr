import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { downloadClients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { testSabnzbdConnection } from "@/lib/sabnzbd";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const client = await db.query.downloadClients.findFirst({ where: eq(downloadClients.id, id) });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const result = await testSabnzbdConnection(client.url, client.apiKey);

  await db.update(downloadClients).set({
    lastCheckedAt: new Date(),
    lastStatus: result.ok ? "ok" : "error",
    lastError: result.error ?? null,
    updatedAt: new Date(),
  }).where(eq(downloadClients.id, id));

  return NextResponse.json(result);
}
