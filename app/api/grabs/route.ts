import { auth } from "@/auth";
import { db } from "@/lib/db";
import { downloadClients, grabs, indexers } from "@/lib/db/schema";
import { getSetting } from "@/lib/db/settings";
import { downloadNzb } from "@/lib/prowlarr";
import { addNzbToSabnzbd } from "@/lib/sabnzbd";
import { and, desc, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const grabSchema = z.object({
  guid: z.string(),
  downloadUrl: z.string(),
  title: z.string(),
  size: z.number().optional(),
  indexer: z.string().optional(),
  category: z.string().optional(),
  categoryId: z.number().optional(),
  ageSeconds: z.number().optional(),
  downloadClientId: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = grabSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const {
    guid,
    downloadUrl,
    title,
    size,
    indexer: indexerName,
    category,
    categoryId,
    ageSeconds,
    downloadClientId,
  } = parsed.data;

  // Check daily grab limit
  const maxPerDay = await getSetting("maxGrabsPerUserPerDay");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayGrabs = await db.query.grabs.findMany({
    where: and(eq(grabs.userId, session.user.id)),
  });
  const todayCount = todayGrabs.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (g: any) => g.queuedAt >= todayStart && !["failed", "expired"].includes(g.status ?? ""),
  ).length;

  if (todayCount >= maxPerDay) {
    return NextResponse.json(
      { error: `Daily grab limit reached (${maxPerDay}/day)` },
      { status: 429 },
    );
  }

  // Find download client
  const client = downloadClientId
    ? await db.query.downloadClients.findFirst({ where: eq(downloadClients.id, downloadClientId) })
    : await db.query.downloadClients.findFirst({ where: eq(downloadClients.enabled, true) });

  if (!client) {
    return NextResponse.json({ error: "No download client configured" }, { status: 503 });
  }

  // Find the Prowlarr indexer that matched
  const indexer = await db.query.indexers.findFirst({
    where: eq(indexers.enabled, true),
  });

  if (!indexer) {
    return NextResponse.json({ error: "No indexer configured" }, { status: 503 });
  }

  try {
    // Download NZB server-side
    const nzbBuffer = await downloadNzb(indexer, guid, downloadUrl);

    // Add to SABnzbd
    const jobId = await addNzbToSabnzbd(
      client,
      nzbBuffer,
      `${title}.nzb`,
      client.category ?? "snatcharr",
    );

    // Create grab record
    const availabilityHours = await getSetting("downloadAvailabilityHours");
    const expiresAt = new Date(Date.now() + availabilityHours * 60 * 60 * 1000);

    await db.insert(grabs).values({
      userId: session.user.id,
      downloadClientId: client.id,
      title,
      indexerName,
      category,
      categoryId,
      sizeBytes: size,
      ageSeconds,
      guid,
      nzbUrl: downloadUrl, // stored server-side, never returned to client
      downloadClientJobId: jobId,
      status: "queued",
      progress: 0,
      queuedAt: new Date(),
      expiresAt,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Grabs] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Grab failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = (page - 1) * limit;

  // Admins see all, users see their own + public grabs
  const grabList =
    session.user.role === "admin"
      ? await db.query.grabs.findMany({
          with: { user: { columns: { username: true } } } as never,
          orderBy: [desc(grabs.queuedAt)],
          limit,
          offset,
        })
      : await db.query.grabs.findMany({
          where: or(eq(grabs.userId, session.user.id), eq(grabs.isPublic, true)),
          orderBy: [desc(grabs.queuedAt)],
          limit,
          offset,
        });

  // Strip sensitive fields
  const safe = grabList.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (g: any) => ({
      ...g,
      nzbUrl: undefined,
      archivePassword: undefined,
    }),
  );

  return NextResponse.json({ grabs: safe });
}
