import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { downloadClients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { setDefaultDownloadClient } from "@/lib/download-client-default";
import { z } from "zod";
import { stripApiKeyFromResponse } from "@/lib/mask-secrets";
import { testDownloadClientConnection } from "@/lib/sabnzbd";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["sabnzbd", "nzbget", "nzbvortex"]).optional(),
  url: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  category: z.string().optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.query.downloadClients.findFirst({ where: eq(downloadClients.id, id) });
  if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  const { apiKey, ...rest } = parsed.data;
  const update: Partial<typeof downloadClients.$inferInsert> = {
    ...rest,
    updatedAt: new Date(),
  };
  if (apiKey !== undefined && apiKey.trim() !== "") {
    const testType = rest.type ?? existing.type;
    const testUrl = rest.url ?? existing.url;
    const testResult = await testDownloadClientConnection(testType, testUrl, apiKey.trim());
    if (!testResult.ok) {
      return NextResponse.json(
        { error: testResult.error ?? "API key connection test failed" },
        { status: 422 },
      );
    }
    update.apiKey = apiKey.trim();
  }

  const [updated] = await db
    .update(downloadClients)
    .set(update)
    .where(eq(downloadClients.id, id))
    .returning();

  if (parsed.data.isDefault) {
    await setDefaultDownloadClient(id);
  }

  return NextResponse.json({ client: stripApiKeyFromResponse(updated) });
}
