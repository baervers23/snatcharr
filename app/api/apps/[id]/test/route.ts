import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { externalApps } from "@/lib/db/schema";
import { testExternalApp } from "@/lib/app-test";
import { eq } from "drizzle-orm";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const app = await db.query.externalApps.findFirst({ where: eq(externalApps.id, id) });
  if (!app) return NextResponse.json({ error: "App not found" }, { status: 404 });

  const result = await testExternalApp(app.type, app.url, app.apiKey ?? "");

  await db
    .update(externalApps)
    .set({
      lastCheckedAt: new Date(),
      lastStatus: result.ok ? "ok" : "error",
      lastError: result.error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(externalApps.id, id));

  return NextResponse.json(result);
}
