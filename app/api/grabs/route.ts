import { auth } from "@/auth";
import { db } from "@/lib/db";
import { downloadClients, grabs, indexers, users } from "@/lib/db/schema";
import { incrementGrabCount } from "@/lib/daily-usage";
import { getDefaultDownloadClient } from "@/lib/download-client-default";
import {
  checkGlobalGrabLimit,
  checkPersonalGrabLimit,
  userCanPickDownloader,
  userCanUseApp,
} from "@/lib/grants";
import { getSetting } from "@/lib/db/settings";
import { downloadNzb } from "@/lib/prowlarr";
import {
  addNzbToSabnzbd,
  getSabnzbdQueue,
  getSabnzbdHistory,
  sabHistoryIsFailed,
  sabHistoryIsCompleted,
  sabQueueIsPostProcessing,
  sabClientAlertFields,
} from "@/lib/sabnzbd";
import { checkGrabAllowed } from "@/lib/grab-filters";
import { getGrabDir } from "@/lib/grab-files";
import { recordGrabQueued, recordGrabCompleted } from "@/lib/grab-stats";
import { logAction, logActionFail } from "@/lib/audit";
import type { Grab } from "@/lib/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Best-effort extraction of an NZB password. Indexers commonly embed it either
 * as an NZB <meta type="password"> tag or as a "{{password}}" / "password: x"
 * suffix in the release title.
 */
function extractNzbPassword(nzbXml: string, title: string): string | null {
  const metaMatch = nzbXml.match(/<meta[^>]*type=["']password["'][^>]*>([^<]+)<\/meta>/i);
  if (metaMatch?.[1]?.trim()) return metaMatch[1].trim();

  const braceMatch = title.match(/\{\{([^}]+)\}\}/);
  if (braceMatch?.[1]?.trim()) return braceMatch[1].trim();

  const labelMatch = title.match(/(?:pass(?:word)?|pw)\s*[:=]\s*(\S+)/i);
  if (labelMatch?.[1]?.trim()) return labelMatch[1].trim();

  return null;
}

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
  indexerId: z.number().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    logActionFail("GRAB", "create", "denied", { details: "not authenticated", req });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = grabSchema.safeParse(body);
  if (!parsed.success) {
    logActionFail("GRAB", "create", "aborted", {
      username: session.user.username,
      details: "invalid request",
      req,
    });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const filterCheck = await checkGrabAllowed(
    {
      title: parsed.data?.title ?? "",
      sizeBytes: parsed.data?.size,
      category: parsed.data?.category,
      categoryId: parsed.data?.categoryId,
    },
    { username: session.user.username, source: "search", req },
  );
  if (!filterCheck.allowed) {
    return NextResponse.json({ error: filterCheck.reason }, { status: 403 });
  }

  const grant = await userCanUseApp(session.user.id, session.user.role);
  if (!grant.allowed) {
    logActionFail("GRAB", "create", "denied", {
      username: session.user.username,
      details: grant.reason ?? "access denied",
      req,
    });
    return NextResponse.json({ error: grant.reason ?? "Access denied" }, { status: 403 });
  }

  const userRow = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

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
    indexerId,
  } = parsed.data;

  const duplicate = await db.query.grabs.findFirst({
    where: and(eq(grabs.userId, session.user.id), eq(grabs.guid, guid)),
  });
  if (duplicate && !["failed", "expired"].includes(duplicate.status ?? "")) {
    logActionFail("GRAB", "create", "aborted", {
      username: session.user.username,
      details: `duplicate release "${title}"`,
      req,
    });
    return NextResponse.json({ error: "You already grabbed this release" }, { status: 409 });
  }

  const globalGrabLimit = await checkGlobalGrabLimit();
  if (!globalGrabLimit.allowed) {
    logActionFail("GRAB", "create", "denied", {
      username: session.user.username,
      details: `global daily limit (${globalGrabLimit.max}/day)`,
      req,
    });
    return NextResponse.json(
      { error: `Daily grab limit reached for this instance (${globalGrabLimit.max}/day)` },
      { status: 429 },
    );
  }

  const personalGrabLimit = await checkPersonalGrabLimit(session.user.id);
  if (!personalGrabLimit.allowed) {
    logActionFail("GRAB", "create", "denied", {
      username: session.user.username,
      details: `personal daily limit (${personalGrabLimit.max}/day)`,
      req,
    });
    return NextResponse.json(
      { error: `Daily grab limit reached (${personalGrabLimit.max}/day)` },
      { status: 429 },
    );
  }

  const todayGrabs = await db.query.grabs.findMany({
    where: and(eq(grabs.userId, session.user.id)),
  });

  const maxConcurrent = await getSetting("maxConcurrentGrabsPerUser");
  if (maxConcurrent > 0) {
    const active = todayGrabs.filter((g) =>
      ["queued", "downloading", "paused"].includes(g.status ?? ""),
    ).length;
    if (active >= maxConcurrent) {
      logActionFail("GRAB", "create", "denied", {
        username: session.user.username,
        details: `concurrent limit (${active}/${maxConcurrent})`,
        req,
      });
      return NextResponse.json(
        { error: `Too many active grabs (${active}/${maxConcurrent}). Wait for one to finish before grabbing more.` },
        { status: 429 },
      );
    }
  }

  const mayPickClient = await userCanPickDownloader(session.user.id, session.user.role);
  let client =
    mayPickClient && downloadClientId
      ? await db.query.downloadClients.findFirst({
          where: and(eq(downloadClients.id, downloadClientId), eq(downloadClients.enabled, true)),
        })
      : null;
  if (!client) client = await getDefaultDownloadClient();

  if (!client) {
    logActionFail("GRAB", "create", "failed", {
      username: session.user.username,
      details: `no download client — "${title}"`,
      req,
    });
    return NextResponse.json({ error: "No download client configured" }, { status: 503 });
  }

  const indexer = await db.query.indexers.findFirst({
    where: eq(indexers.enabled, true),
  });

  if (!indexer) {
    logActionFail("GRAB", "create", "failed", {
      username: session.user.username,
      details: `no indexer — "${title}"`,
      req,
    });
    return NextResponse.json({ error: "No indexer configured" }, { status: 503 });
  }

  const sabCategory = client.category?.trim() || category?.trim() || "snatcharr";

  try {
    let nzbBuffer: Buffer;
    try {
      nzbBuffer = await downloadNzb(indexer, guid, downloadUrl, indexerId);
    } catch (err) {
      logActionFail("GRAB", "create", "failed", {
        username: session.user.username,
        details: `"${title}" — NZB fetch from ${indexer.name} failed`,
        error: err,
        req,
      });
      throw err;
    }

    const nzbPassword = extractNzbPassword(nzbBuffer.toString("utf-8"), title);

    let jobId: string;
    try {
      jobId = await addNzbToSabnzbd(
        client,
        nzbBuffer,
        `${title}.nzb`,
        sabCategory,
        nzbPassword,
      );
    } catch (err) {
      logActionFail("GRAB", "create", "failed", {
        username: session.user.username,
        details: `"${title}" — SAB queue via ${client.name} (cat: ${sabCategory}) failed`,
        error: err,
        req,
      });
      throw err;
    }

    const keepDays = await getSetting("completedGrabKeepDays");
    const expiresAt =
      keepDays > 0
        ? new Date(Date.now() + keepDays * 24 * 60 * 60 * 1000)
        : null;

    await db.insert(grabs).values({
      userId: session.user.id,
      downloadClientId: client.id,
      title,
      indexerName: session.user.role === "admin" ? indexerName : null,
      category,
      categoryId,
      sizeBytes: size,
      ageSeconds,
      guid,
      nzbUrl: downloadUrl, // stored server-side, never returned to client
      downloadClientJobId: jobId,
      nzbPassword,
      status: "queued",
      progress: 0,
      isPublic: userRow?.showGrabsPublic ?? false,
      queuedAt: new Date(),
      expiresAt,
    });

    await recordGrabQueued(session.user.id);
    await incrementGrabCount(session.user.id);

    logAction({
      domain: "GRAB",
      action: "create",
      outcome: "ok",
      username: session.user.username,
      details: `"${title}" → ${client.name} (job ${jobId})`,
      req,
    });
    return NextResponse.json({ success: true, jobId });
  } catch (err) {
    logActionFail("GRAB", "create", "failed", {
      username: session.user.username,
      details: `"${title}"`,
      error: err,
      req,
    });
    const message = err instanceof Error ? err.message : "Grab failed";
    const userMessage = message.includes("Failed to download NZB")
      ? "Could not fetch the NZB from Prowlarr. The release may have expired — try searching again."
      : message;
    return NextResponse.json({ error: userMessage }, { status: 502 });
  }
}

function grabNeedsSabSync(g: Grab): boolean {
  if (!g.downloadClientId || !g.downloadClientJobId) return false;
  if (["queued", "downloading", "processing", "paused"].includes(g.status ?? "")) return true;
  if (g.status === "completed" && !getGrabDir(g)) return true;
  if (["failed", "completed"].includes(g.status ?? "") && g.downloadClientStatus == null) {
    return true;
  }
  return false;
}

async function syncActiveGrabs(list: Grab[]): Promise<Grab[]> {
  const activeByClient = new Map<string, Grab[]>();
  for (const g of list) {
    if (grabNeedsSabSync(g)) {
      const arr = activeByClient.get(g.downloadClientId!) ?? [];
      arr.push(g);
      activeByClient.set(g.downloadClientId!, arr);
    }
  }
  if (activeByClient.size === 0) return list;

  const patches = new Map<string, Partial<Grab>>();

  for (const [clientId, clientGrabs] of activeByClient) {
    const client = await db.query.downloadClients.findFirst({
      where: eq(downloadClients.id, clientId),
    });
    if (!client) continue;

    let queue, history;
    try {
      [queue, history] = await Promise.all([
        getSabnzbdQueue(client),
        getSabnzbdHistory(client, 200),
      ]);
    } catch (err) {
      logActionFail("GRAB", "sync", "failed", {
        details: `client ${client.name}`,
        error: err,
      });
      continue;
    }

    for (const g of clientGrabs) {
      const q = queue.find((i) => i.nzo_id === g.downloadClientJobId);
      if (q) {
        const postProcessing = sabQueueIsPostProcessing(q);
        patches.set(g.id, {
          status: postProcessing ? "processing" : "downloading",
          progress: postProcessing ? 1 : parseFloat(q.percentage) / 100 || 0,
          speed: postProcessing ? 0 : Math.round((parseFloat(q.speed) || 0) * 1024),
          ...sabClientAlertFields(q, "queue"),
        });
        continue;
      }
      const h = history.find((i) => i.nzo_id === g.downloadClientJobId);
      if (h) {
        const alertFields = sabClientAlertFields(h, "history");
        const storagePath = h.storage || h.path || g.storagePath || null;
        if (sabHistoryIsFailed(h)) {
          patches.set(g.id, {
            status: "failed",
            progress: g.progress ?? 0,
            downloadedBytes: h.bytes ?? g.downloadedBytes ?? 0,
            speed: 0,
            storagePath,
            ...alertFields,
          });
          if (g.status !== "failed") {
            const failMsg =
              h.fail_message?.trim() ||
              alertFields.downloadClientMessage?.trim() ||
              h.status ||
              "unknown error";
            logActionFail("GRAB", "sync", "failed", {
              details: `"${g.title}" job ${g.downloadClientJobId} — ${failMsg}`,
            });
          }
          continue;
        }
        if (!sabHistoryIsCompleted(h)) {
          patches.set(g.id, {
            status: "processing",
            progress: 1,
            downloadedBytes: h.bytes ?? g.downloadedBytes ?? g.sizeBytes ?? 0,
            sizeBytes: g.sizeBytes ?? h.bytes ?? 0,
            speed: 0,
            storagePath,
            ...alertFields,
          });
          continue;
        }
        const dir = getGrabDir({
          storagePath,
          archivePath: g.archivePath,
          title: g.title,
        });
        if (!dir) {
          patches.set(g.id, {
            status: "processing",
            progress: 1,
            downloadedBytes: h.bytes ?? g.downloadedBytes ?? g.sizeBytes ?? 0,
            sizeBytes: g.sizeBytes ?? h.bytes ?? 0,
            speed: 0,
            storagePath,
            ...alertFields,
          });
          if (g.status !== "processing" || g.storagePath !== storagePath) {
            logActionFail("GRAB", "sync", "failed", {
              details: `"${g.title}" completed in SAB but folder not found (storage: ${storagePath ?? "none"})`,
            });
          }
          continue;
        }
        patches.set(g.id, {
          status: "completed",
          progress: 1,
          downloadedBytes: h.bytes ?? g.sizeBytes ?? 0,
          sizeBytes: g.sizeBytes ?? h.bytes ?? 0,
          speed: 0,
          storagePath,
          completedAt: new Date(),
          ...alertFields,
        });
        continue;
      }
      if (["failed", "completed"].includes(g.status ?? "")) {
        patches.set(g.id, {
          downloadClientStatus: "unknown",
          downloadClientMessage: null,
          downloadClientAlert: null,
        });
        if (g.downloadClientStatus !== "unknown") {
          logActionFail("GRAB", "sync", "failed", {
            details: `"${g.title}" job ${g.downloadClientJobId} — not found in SAB queue or history`,
          });
        }
      }
    }
  }

  if (patches.size === 0) return list;

  for (const [id, patch] of patches) {
    const grab = list.find((g) => g.id === id);
    const completing =
      patch.status === "completed" &&
      grab &&
      grab.status !== "completed" &&
      !grab.lifetimeBytesRecorded;

    const rowPatch = completing
      ? { ...patch, lifetimeBytesRecorded: true }
      : patch;

    await db.update(grabs).set(rowPatch).where(eq(grabs.id, id));

    if (completing && grab) {
      const bytes = patch.downloadedBytes ?? grab.sizeBytes ?? 0;
      await recordGrabCompleted(grab.userId, bytes);
      const completedDir = getGrabDir({
        storagePath: patch.storagePath ?? grab.storagePath,
        archivePath: grab.archivePath,
        title: grab.title,
      });
      if (completedDir) {
        const { prepareGrabDirectory } = await import("@/lib/grab-files");
        prepareGrabDirectory(completedDir, grab.nzbPassword);
      }
      const { notifyGrabCompleted } = await import("@/lib/grab-notifications");
      void notifyGrabCompleted({
        id: grab.id,
        userId: grab.userId,
        title: grab.title,
        sizeBytes: grab.sizeBytes,
        downloadedBytes: patch.downloadedBytes ?? grab.downloadedBytes,
        nzbPassword: grab.nzbPassword,
      });
    }
  }
  return list.map((g) => (patches.has(g.id) ? { ...g, ...patches.get(g.id) } : g));
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = (page - 1) * limit;

  const isAdmin = session.user.role === "admin";
  const grabList = isAdmin
    ? await db.query.grabs.findMany({
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

  const synced = await syncActiveGrabs(grabList);

  const usernameById = isAdmin
    ? new Map((await db.query.users.findMany()).map((u): [string, string] => [u.id, u.username]))
    : null;

  const safe = synced.map((g) => ({
    ...g,
    user: usernameById ? { username: usernameById.get(g.userId) ?? "unknown" } : undefined,
    nzbUrl: undefined,
    archivePassword: undefined,
    ...(isAdmin ? {} : { indexerName: undefined }),
  }));

  return NextResponse.json({ grabs: safe });
}
