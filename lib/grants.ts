import { db } from "./db";
import { users } from "./db/schema";
import { getSetting } from "./db/settings";
import {
  getGlobalGrabCountToday,
  getGlobalSearchCountToday,
  getGrabCountToday,
} from "./daily-usage";
import { eq } from "drizzle-orm";

export async function userCanUseApp(
  userId: string,
  role: "admin" | "user",
): Promise<{ allowed: boolean; reason?: string }> {
  if (role === "admin") return { allowed: true };

  const requireGrant = await getSetting("requireAppGrant");
  if (!requireGrant) return { allowed: true };

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canGrab: true },
  });

  if (user?.canGrab) return { allowed: true };
  return { allowed: false, reason: "Admin grant required before you can use Snatcharr" };
}

/** Personal grab limit — enforced in addition to the global instance limit. */
export async function effectiveGrabLimitPerDay(userId: string): Promise<number> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { maxGrabsPerDay: true },
  });
  return user?.maxGrabsPerDay ?? 0;
}

/** Personal finished-file download limit per day (0 = unlimited). */
export async function effectiveDownloadLimitPerDay(userId: string): Promise<number> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { maxDownloadsPerDay: true },
  });
  return user?.maxDownloadsPerDay ?? 0;
}

export async function userCanUploadNzb(
  userId: string,
  role: "admin" | "user",
): Promise<{ allowed: boolean; reason?: string }> {
  if (role === "admin") return { allowed: true };

  const uploadGrantEnabled = await getSetting("requireUploadGrant");
  if (!uploadGrantEnabled) {
    return { allowed: false, reason: "Manual NZB upload is disabled in Settings" };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canUploadNzb: true },
  });

  if (user?.canUploadNzb) return { allowed: true };
  return { allowed: false, reason: "Manual NZB upload is not enabled for your account" };
}

/** Personal manual NZB upload limit per day (0 = unlimited). */
export async function effectiveManualNzbLimitPerDay(userId: string): Promise<number> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { maxManualNzbPerDay: true },
  });
  return user?.maxManualNzbPerDay ?? 0;
}

export async function userCanPickDownloader(
  userId: string,
  role: "admin" | "user",
): Promise<boolean> {
  if (role === "admin") return true;
  const enabled = await getSetting("allowPickDownloader");
  if (!enabled) return false;
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canPickDownloader: true },
  });
  return !!user?.canPickDownloader;
}

export async function userCanDownload(
  userId: string,
  role: "admin" | "user",
): Promise<{ allowed: boolean; reason?: string }> {
  if (role === "admin") return { allowed: true };

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canDownload: true },
  });

  if (user?.canDownload) return { allowed: true };
  return { allowed: false, reason: "Download permission disabled for your account" };
}

/** Global instance search limit (maxSearchRequestsPerUserPerDay setting). */
export async function checkGlobalSearchLimit(): Promise<{
  allowed: boolean;
  used: number;
  max: number;
}> {
  const max = await getSetting("maxSearchRequestsPerUserPerDay");
  const used = await getGlobalSearchCountToday();
  return { allowed: max === 0 || used < max, used, max };
}

/** Global instance grab limit (maxGrabsPerUserPerDay setting). */
export async function checkGlobalGrabLimit(): Promise<{
  allowed: boolean;
  used: number;
  max: number;
}> {
  const max = await getSetting("maxGrabsPerUserPerDay");
  const used = await getGlobalGrabCountToday();
  return { allowed: max === 0 || used < max, used, max };
}

/** Personal per-user grab limit. */
export async function checkPersonalGrabLimit(userId: string): Promise<{
  allowed: boolean;
  used: number;
  max: number;
}> {
  const max = await effectiveGrabLimitPerDay(userId);
  const used = await getGrabCountToday(userId);
  return { allowed: max === 0 || used < max, used, max };
}
