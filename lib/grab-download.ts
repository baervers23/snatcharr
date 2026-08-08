import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { grabs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";
import { secureDownloadHeaders, shouldExcludeGrabFile } from "@/lib/grab-file-security";
import { logAudit, logActionFail } from "@/lib/audit";
import { effectiveDownloadLimitPerDay, userCanDownload } from "@/lib/grants";
import { getDownloadCountToday, incrementDownloadCount } from "@/lib/daily-usage";
import {
  canAccessGrab,
  getGrabDir,
  listGrabFiles,
  prepareGrabDirectory,
  resolveGrabFileByIndex,
} from "@/lib/grab-files";

/** Serve grab file(s) by id + numeric file index only — no client paths. */
export async function serveGrabDownload(req: Request, grabId: string) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const grab = await db.query.grabs.findFirst({ where: eq(grabs.id, grabId) });
  if (!grab) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canAccessGrab(grab, { id: session.user.id, role: session.user.role })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const downloadGrant = await userCanDownload(session.user.id, session.user.role);
  if (!downloadGrant.allowed) {
    logActionFail("DOWNLOAD", "file", "denied", {
      username: session.user.username,
      details: downloadGrant.reason ?? "download permission",
      req,
    });
    return NextResponse.json({ error: downloadGrant.reason ?? "Forbidden" }, { status: 403 });
  }

  const maxDownloads = await effectiveDownloadLimitPerDay(session.user.id);
  if (maxDownloads > 0) {
    const used = await getDownloadCountToday(session.user.id);
    if (used >= maxDownloads) {
      logActionFail("DOWNLOAD", "file", "denied", {
        username: session.user.username,
        details: `"${grab.title}" — daily limit (${used}/${maxDownloads})`,
        req,
      });
      return NextResponse.json(
        { error: `Daily download limit reached (${maxDownloads}/day)` },
        { status: 429 },
      );
    }
  }

  if (grab.status !== "completed") {
    const message =
      grab.status === "processing"
        ? "Files are still being moved — try again in a moment."
        : "Download not ready";
    logActionFail("DOWNLOAD", "file", "aborted", {
      username: session.user.username,
      details: `"${grab.title}" — status: ${grab.status ?? "unknown"}`,
      req,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const dir = getGrabDir(grab);
  if (!dir) {
    logActionFail("DOWNLOAD", "file", "failed", {
      username: session.user.username,
      details: `"${grab.title}" — folder not accessible (storage: ${grab.storagePath ?? grab.archivePath ?? "none"})`,
      req,
    });
    return NextResponse.json(
      { error: "Download folder is not accessible from Snatcharr (check the shared volume)." },
      { status: 503 },
    );
  }

  prepareGrabDirectory(dir, grab.nzbPassword);

  const { searchParams } = new URL(req.url);
  const fileParam = searchParams.get("file");
  const zipAll = fileParam === null || fileParam === "" || fileParam === "zip";

  if (!zipAll) {
    const fileIndex = Number.parseInt(fileParam, 10);
    if (!Number.isInteger(fileIndex) || fileIndex < 0) {
      logActionFail("DOWNLOAD", "file", "aborted", {
        username: session.user.username,
        details: `"${grab.title}" — invalid file index: ${fileParam}`,
        req,
      });
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }

    const resolved = resolveGrabFileByIndex(dir, fileIndex);
    if (!resolved) {
      logActionFail("DOWNLOAD", "file", "aborted", {
        username: session.user.username,
        details: `"${grab.title}" — file #${fileIndex} not found in ${dir}`,
        req,
      });
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }

    const stream = fs.createReadStream(resolved);
    const filename = path.basename(resolved);

    await incrementDownloadCount(session.user.id);
    await logAudit("grab.download", {
      userId: session.user.id,
      username: session.user.username,
      details: `${grab.title} → #${fileIndex} ${filename}`,
      req,
    });

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: secureDownloadHeaders(filename),
    });
  }

  const archive = archiver("zip", { zlib: { level: 5 } });
  const passThrough = new PassThrough();
  archive.pipe(passThrough);

  for (const f of listGrabFiles(dir)) {
    if (shouldExcludeGrabFile(f.name) || shouldExcludeGrabFile(f.relativePath)) continue;
    archive.file(path.join(dir, f.relativePath), { name: f.relativePath });
  }

  await incrementDownloadCount(session.user.id);
  await logAudit("grab.download", {
    userId: session.user.id,
    username: session.user.username,
    details: `${grab.title} → zip`,
    req,
  });

  void archive.finalize();
  const safeName = grab.title.replace(/[^\w.-]+/g, "_").slice(0, 80);
  return new NextResponse(Readable.toWeb(passThrough) as ReadableStream, {
    headers: {
      ...secureDownloadHeaders(`${safeName}.zip`),
      "Content-Type": "application/zip",
    },
  });
}
