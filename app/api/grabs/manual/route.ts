import { auth } from "@/auth";
import { db } from "@/lib/db";
import { downloadClients, grabs, users } from "@/lib/db/schema";
import { getManualNzbCountToday, incrementGrabCount, incrementManualNzbCount } from "@/lib/daily-usage";
import {
  checkGlobalGrabLimit,
  checkPersonalGrabLimit,
  effectiveManualNzbLimitPerDay,
  userCanUploadNzb,
} from "@/lib/grants";
import { getSetting } from "@/lib/db/settings";
import { fetchNzbFromUrl, isValidNzbBuffer, parseNzbTitle } from "@/lib/manual-nzb";
import { addNzbToSabnzbd } from "@/lib/sabnzbd";
import { recordGrabQueued } from "@/lib/grab-stats";
import { logAction, logActionFail } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

function extractNzbPassword(nzbXml: string, title: string): string | null {
  const metaMatch = nzbXml.match(/<meta[^>]*type=["']password["'][^>]*>([^<]+)<\/meta>/i);
  if (metaMatch?.[1]?.trim()) return metaMatch[1].trim();
  const braceMatch = title.match(/\{\{([^}]+)\}\}/);
  if (braceMatch?.[1]?.trim()) return braceMatch[1].trim();
  const labelMatch = title.match(/(?:pass(?:word)?|pw)\s*[:=]\s*(\S+)/i);
  if (labelMatch?.[1]?.trim()) return labelMatch[1].trim();
  return null;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uploadGrant = await userCanUploadNzb(session.user.id, session.user.role);
  if (!uploadGrant.allowed) {
    logActionFail("GRAB", "manual", "denied", {
      username: session.user.username,
      details: uploadGrant.reason ?? "upload not granted",
      req,
    });
    return NextResponse.json({ error: uploadGrant.reason ?? "Forbidden" }, { status: 403 });
  }

  const globalGrabLimit = await checkGlobalGrabLimit();
  if (!globalGrabLimit.allowed) {
    logActionFail("GRAB", "manual", "denied", {
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
    logActionFail("GRAB", "manual", "denied", {
      username: session.user.username,
      details: `personal daily limit (${personalGrabLimit.max}/day)`,
      req,
    });
    return NextResponse.json(
      { error: `Daily grab limit reached (${personalGrabLimit.max}/day)` },
      { status: 429 },
    );
  }

  const maxManual = await effectiveManualNzbLimitPerDay(session.user.id);
  if (maxManual > 0) {
    const used = await getManualNzbCountToday(session.user.id);
    if (used >= maxManual) {
      logActionFail("GRAB", "manual", "denied", {
        username: session.user.username,
        details: `manual limit (${maxManual}/day)`,
        req,
      });
      return NextResponse.json(
        { error: `Daily manual NZB limit reached (${maxManual}/day)` },
        { status: 429 },
      );
    }
  }

  const maxConcurrent = await getSetting("maxConcurrentGrabsPerUser");
  if (maxConcurrent > 0) {
    const active = await db.query.grabs.findMany({
      where: eq(grabs.userId, session.user.id),
    });
    const busy = active.filter((g) =>
      ["queued", "downloading", "paused"].includes(g.status ?? ""),
    ).length;
    if (busy >= maxConcurrent) {
      return NextResponse.json(
        { error: `Too many active grabs (${busy}/${maxConcurrent})` },
        { status: 429 },
      );
    }
  }

  const client = await db.query.downloadClients.findFirst({
    where: eq(downloadClients.enabled, true),
  });
  if (!client) {
    return NextResponse.json({ error: "No download client configured" }, { status: 503 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let nzbBuffer: Buffer;
  let titleOverride: string | undefined;
  let nzbPasswordInput: string | undefined;

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const url = form.get("url")?.toString().trim();
      titleOverride = form.get("title")?.toString().trim() || undefined;
      nzbPasswordInput = form.get("password")?.toString().trim() || undefined;

      if (file instanceof File && file.size > 0) {
        nzbBuffer = Buffer.from(await file.arrayBuffer());
      } else if (url) {
        nzbBuffer = await fetchNzbFromUrl(url);
      } else {
        return NextResponse.json({ error: "Provide an NZB file or URL" }, { status: 400 });
      }
    } else {
      const body = (await req.json()) as {
        url?: string;
        title?: string;
        password?: string;
      };
      if (!body.url?.trim()) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 });
      }
      titleOverride = body.title?.trim();
      nzbPasswordInput = body.password?.trim();
      nzbBuffer = await fetchNzbFromUrl(body.url.trim());
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid NZB";
    logActionFail("GRAB", "manual", "failed", {
      username: session.user.username,
      details: message,
      req,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!isValidNzbBuffer(nzbBuffer)) {
    return NextResponse.json({ error: "Invalid NZB file" }, { status: 400 });
  }

  const nzbXml = nzbBuffer.toString("utf-8");
  const title = titleOverride || parseNzbTitle(nzbXml);
  const nzbPassword =
    nzbPasswordInput || extractNzbPassword(nzbXml, title) || null;
  const guid = `manual:${crypto.randomUUID()}`;

  try {
    const sabCategory = client.category?.trim() || "snatcharr";
    const jobId = await addNzbToSabnzbd(
      client,
      nzbBuffer,
      `${title}.nzb`,
      sabCategory,
      nzbPassword,
    );
    const keepDays = await getSetting("completedGrabKeepDays");
    const expiresAt =
      keepDays > 0 ? new Date(Date.now() + keepDays * 24 * 60 * 60 * 1000) : null;

    const owner = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { showGrabsPublic: true },
    });

    await db.insert(grabs).values({
      userId: session.user.id,
      downloadClientId: client.id,
      title,
      indexerName: "Manual upload",
      source: "manual",
      guid,
      downloadClientJobId: jobId,
      nzbPassword,
      status: "queued",
      progress: 0,
      isPublic: owner?.showGrabsPublic ?? false,
      queuedAt: new Date(),
      expiresAt,
    });

    await recordGrabQueued(session.user.id);
    await incrementGrabCount(session.user.id);
    await incrementManualNzbCount(session.user.id);

    logAction({
      domain: "GRAB",
      action: "manual",
      outcome: "ok",
      username: session.user.username,
      details: `"${title}" → ${client.name}`,
      req,
    });

    return NextResponse.json({ success: true, jobId, title });
  } catch (err) {
    logActionFail("GRAB", "manual", "failed", {
      username: session.user.username,
      details: `"${title}"`,
      error: err,
      req,
    });
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
