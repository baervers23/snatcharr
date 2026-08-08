import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { externalApps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { stripApiKeyFromResponse } from "@/lib/mask-secrets";
import { testExternalApp } from "@/lib/app-test";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["jellyfin", "seerr", "organizr", "jfago"]).optional(),
  url: z.string().url().optional(),
  apiKey: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.query.externalApps.findFirst({ where: eq(externalApps.id, id) });
  if (!existing) return NextResponse.json({ error: "App not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  const { apiKey, ...rest } = parsed.data;
  const update: Partial<typeof externalApps.$inferInsert> = {
    ...rest,
    updatedAt: new Date(),
  };
  if (apiKey !== undefined && apiKey !== null && apiKey.trim() !== "") {
    const testType = rest.type ?? existing.type;
    const testUrl = rest.url ?? existing.url;
    const testResult = await testExternalApp(testType, testUrl, apiKey.trim());
    if (!testResult.ok) {
      return NextResponse.json(
        { error: testResult.error ?? "API key connection test failed" },
        { status: 422 },
      );
    }
    update.apiKey = apiKey.trim();
  } else if (apiKey === null || apiKey === "") {
    update.apiKey = null;
  }

  const [updated] = await db
    .update(externalApps)
    .set(update)
    .where(eq(externalApps.id, id))
    .returning();

  return NextResponse.json({ app: stripApiKeyFromResponse(updated) });
}
