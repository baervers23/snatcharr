import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { indexers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { testProwlarrConnection } from "@/lib/prowlarr";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const indexer = await db.query.indexers.findFirst({ where: eq(indexers.id, id) });
  if (!indexer) return NextResponse.json({ error: "Indexer not found" }, { status: 404 });

  const result = await testProwlarrConnection(indexer.prowlarrUrl, indexer.apiKey);

  await db.update(indexers).set({
    lastCheckedAt: new Date(),
    lastStatus: result.ok ? "ok" : "error",
    lastError: result.error ?? null,
    updatedAt: new Date(),
  }).where(eq(indexers.id, id));

  return NextResponse.json(result);
}
