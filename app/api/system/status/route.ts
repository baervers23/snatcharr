import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { grabs } from "@/lib/db/schema";
import { getSetting } from "@/lib/db/settings";
import {
  getDownloadCountToday,
  getGlobalGrabCountToday,
  getGlobalSearchCountToday,
  getGrabCountToday,
  getManualNzbCountToday,
} from "@/lib/daily-usage";
import { DAILY_RESET_HOUR, getMsUntilDailyReset } from "@/lib/daily-limits";
import {
  effectiveDownloadLimitPerDay,
  effectiveGrabLimitPerDay,
  effectiveManualNzbLimitPerDay,
  userCanUploadNzb,
} from "@/lib/grants";
import { getAppUpdateStatus } from "@/lib/app-update";
import { disksAreSame, getAppDiskUsage, getDownloadDiskUsage } from "@/lib/disk";
import { eq, or } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const indexers = await db.query.indexers.findMany({ where: (t, { eq }) => eq(t.enabled, true) });
  const clients = await db.query.downloadClients.findMany({ where: (t, { eq }) => eq(t.enabled, true) });
  const apps = await db.query.externalApps.findMany({ where: (t, { eq }) => eq(t.enabled, true) });

  const healthIssues = [
    ...indexers.filter((i) => i.lastStatus === "error" || i.lastStatus === "warning"),
    ...clients.filter((c) => c.lastStatus === "error" || c.lastStatus === "warning"),
    ...apps.filter((a) => a.lastStatus === "error" || a.lastStatus === "warning"),
  ].length;

  const isAdmin = session.user.role === "admin";
  const activeGrabs = await db.query.grabs.findMany({
    where: or(
      eq(grabs.status, "queued"),
      eq(grabs.status, "downloading"),
      eq(grabs.status, "paused"),
    ),
  });

  const userActive = activeGrabs.filter((g) => g.userId === session.user.id).length;
  const appDisk = getAppDiskUsage();
  const downloadDisk = getDownloadDiskUsage();
  const sameDisk = disksAreSame(appDisk, downloadDisk);

  const uploadGrant = await userCanUploadNzb(session.user.id, session.user.role);
  const [searchUsed, grabUsed, personalGrabUsed, downloadUsed, searchMax, globalGrabMax, grabMax, downloadMax, manualNzbUsed, manualNzbMax] =
    await Promise.all([
      getGlobalSearchCountToday(),
      getGlobalGrabCountToday(),
      getGrabCountToday(session.user.id),
      getDownloadCountToday(session.user.id),
      getSetting("maxSearchRequestsPerUserPerDay"),
      getSetting("maxGrabsPerUserPerDay"),
      effectiveGrabLimitPerDay(session.user.id),
      effectiveDownloadLimitPerDay(session.user.id),
      uploadGrant.allowed ? getManualNzbCountToday(session.user.id) : Promise.resolve(0),
      uploadGrant.allowed ? effectiveManualNzbLimitPerDay(session.user.id) : Promise.resolve(0),
    ]);

  const update = await getAppUpdateStatus();

  return NextResponse.json({
    update,
    healthIssues,
    hasHealthIssues: healthIssues > 0,
    activeDownloads: userActive,
    globalActiveDownloads: isAdmin ? activeGrabs.length : userActive,
    appDisk: isAdmin ? appDisk : null,
    downloadDisk: isAdmin && !sameDisk ? downloadDisk : null,
    sameDisk,
    dailyLimits: {
      searchUsed,
      searchMax,
      grabUsed,
      personalGrabUsed,
      globalGrabMax,
      grabMax,
      downloadUsed,
      downloadMax,
      manualNzbUsed,
      manualNzbMax,
      resetInMs: getMsUntilDailyReset(),
      resetAtHour: DAILY_RESET_HOUR,
    },
  });
}
