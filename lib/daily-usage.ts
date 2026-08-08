import { db } from "./db";
import { userDailyUsage } from "./db/schema";
import { and, eq } from "drizzle-orm";
import { getDailyPeriodStart } from "./daily-limits";

function periodStartFor(now = new Date()): Date {
  return getDailyPeriodStart(now);
}

async function getUsageRow(userId: string, now = new Date()) {
  const periodStart = periodStartFor(now);
  return db.query.userDailyUsage.findFirst({
    where: and(
      eq(userDailyUsage.userId, userId),
      eq(userDailyUsage.periodStart, periodStart),
    ),
  });
}

async function sumSearchCountForPeriod(periodStart: Date): Promise<number> {
  const rows = await db.query.userDailyUsage.findMany({
    where: eq(userDailyUsage.periodStart, periodStart),
    columns: { searchCount: true },
  });
  return rows.reduce((sum, row) => sum + row.searchCount, 0);
}

async function sumGrabCountForPeriod(periodStart: Date): Promise<number> {
  const rows = await db.query.userDailyUsage.findMany({
    where: eq(userDailyUsage.periodStart, periodStart),
    columns: { grabCount: true },
  });
  return rows.reduce((sum, row) => sum + (row.grabCount ?? 0), 0);
}

export async function getGlobalSearchCountToday(now = new Date()): Promise<number> {
  return sumSearchCountForPeriod(periodStartFor(now));
}

export async function getGlobalGrabCountToday(now = new Date()): Promise<number> {
  return sumGrabCountForPeriod(periodStartFor(now));
}

export async function getSearchCountToday(userId: string, now = new Date()): Promise<number> {
  const row = await getUsageRow(userId, now);
  return row?.searchCount ?? 0;
}

export async function incrementSearchCount(userId: string, now = new Date()): Promise<number> {
  const periodStart = periodStartFor(now);
  const existing = await getUsageRow(userId, now);

  if (existing) {
    const next = existing.searchCount + 1;
    await db
      .update(userDailyUsage)
      .set({ searchCount: next })
      .where(
        and(eq(userDailyUsage.userId, userId), eq(userDailyUsage.periodStart, periodStart)),
      );
    return next;
  }

  await db.insert(userDailyUsage).values({
    userId,
    periodStart,
    searchCount: 1,
    grabCount: 0,
    downloadCount: 0,
    manualNzbCount: 0,
  });
  return 1;
}

export async function getGrabCountToday(userId: string, now = new Date()): Promise<number> {
  const row = await getUsageRow(userId, now);
  return row?.grabCount ?? 0;
}

export async function incrementGrabCount(userId: string, now = new Date()): Promise<number> {
  const periodStart = periodStartFor(now);
  const existing = await getUsageRow(userId, now);

  if (existing) {
    const next = (existing.grabCount ?? 0) + 1;
    await db
      .update(userDailyUsage)
      .set({ grabCount: next })
      .where(
        and(eq(userDailyUsage.userId, userId), eq(userDailyUsage.periodStart, periodStart)),
      );
    return next;
  }

  await db.insert(userDailyUsage).values({
    userId,
    periodStart,
    searchCount: 0,
    grabCount: 1,
    downloadCount: 0,
    manualNzbCount: 0,
  });
  return 1;
}

export async function getDownloadCountToday(userId: string, now = new Date()): Promise<number> {
  const row = await getUsageRow(userId, now);
  return row?.downloadCount ?? 0;
}

export async function incrementDownloadCount(userId: string, now = new Date()): Promise<number> {
  const periodStart = periodStartFor(now);
  const existing = await getUsageRow(userId, now);

  if (existing) {
    const next = (existing.downloadCount ?? 0) + 1;
    await db
      .update(userDailyUsage)
      .set({ downloadCount: next })
      .where(
        and(eq(userDailyUsage.userId, userId), eq(userDailyUsage.periodStart, periodStart)),
      );
    return next;
  }

  await db.insert(userDailyUsage).values({
    userId,
    periodStart,
    searchCount: 0,
    grabCount: 0,
    downloadCount: 1,
    manualNzbCount: 0,
  });
  return 1;
}

export async function getManualNzbCountToday(userId: string, now = new Date()): Promise<number> {
  const row = await getUsageRow(userId, now);
  return row?.manualNzbCount ?? 0;
}

export async function incrementManualNzbCount(userId: string, now = new Date()): Promise<number> {
  const periodStart = periodStartFor(now);
  const existing = await getUsageRow(userId, now);

  if (existing) {
    const next = (existing.manualNzbCount ?? 0) + 1;
    await db
      .update(userDailyUsage)
      .set({ manualNzbCount: next })
      .where(
        and(eq(userDailyUsage.userId, userId), eq(userDailyUsage.periodStart, periodStart)),
      );
    return next;
  }

  await db.insert(userDailyUsage).values({
    userId,
    periodStart,
    searchCount: 0,
    grabCount: 0,
    downloadCount: 0,
    manualNzbCount: 1,
  });
  return 1;
}
