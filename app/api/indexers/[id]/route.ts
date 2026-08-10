import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { indexers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { parseProwlarrTagsInput, serializeProwlarrTags, DEFAULT_PROWLARR_SEARCH_TAGS } from "@/lib/prowlarr-tags";
import { stripApiKeyFromResponse } from "@/lib/mask-secrets";
import { testProwlarrConnection } from "@/lib/prowlarr";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  categories: z.string().optional(),
  prowlarrTags: z.string().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.query.indexers.findFirst({ where: eq(indexers.id, id) });
  if (!existing) return NextResponse.json({ error: "Indexer not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  const update: Partial<typeof indexers.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.url !== undefined) update.url = parsed.data.url;
  if (parsed.data.apiKey !== undefined && parsed.data.apiKey.trim() !== "") {
    const testUrl = parsed.data.url ?? existing.url;
    const testResult = await testProwlarrConnection(testUrl, parsed.data.apiKey.trim());
    if (!testResult.ok) {
      return NextResponse.json(
        { error: testResult.error ?? "API key connection test failed" },
        { status: 422 },
      );
    }
    update.apiKey = parsed.data.apiKey.trim();
  }
  if (parsed.data.enabled !== undefined) update.enabled = parsed.data.enabled;
  if (parsed.data.categories !== undefined) {
    const cats = parsed.data.categories
      ? parsed.data.categories
          .split(",")
          .map((c) => parseInt(c.trim(), 10))
          .filter((n) => !isNaN(n))
      : [];
    update.categories = JSON.stringify(cats);
  }
  if (parsed.data.prowlarrTags !== undefined) {
    const tagInput = parseProwlarrTagsInput(parsed.data.prowlarrTags);
    const tagsToStore = tagInput.length > 0 ? tagInput : [...DEFAULT_PROWLARR_SEARCH_TAGS];
    update.prowlarrTags = serializeProwlarrTags(tagsToStore);
  }

  const [updated] = await db.update(indexers).set(update).where(eq(indexers.id, id)).returning();
  return NextResponse.json({ indexer: stripApiKeyFromResponse(updated) });
}
