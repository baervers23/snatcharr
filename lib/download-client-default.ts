import { db } from "./db";
import { downloadClients } from "./db/schema";
import { and, asc, eq, ne } from "drizzle-orm";

export async function getDefaultDownloadClient() {
  const marked = await db.query.downloadClients.findFirst({
    where: and(eq(downloadClients.enabled, true), eq(downloadClients.isDefault, true)),
  });
  if (marked) return marked;

  return db.query.downloadClients.findFirst({
    where: eq(downloadClients.enabled, true),
    orderBy: [asc(downloadClients.priority), asc(downloadClients.name)],
  });
}

export async function setDefaultDownloadClient(id: string): Promise<void> {
  await clearOtherDefaults(id);
  await db
    .update(downloadClients)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(downloadClients.id, id));
}

export async function ensureDefaultDownloadClientAfterDelete(): Promise<void> {
  const remaining = await db.query.downloadClients.findMany({
    orderBy: [asc(downloadClients.priority), asc(downloadClients.name)],
  });
  if (remaining.length === 0) return;
  if (!remaining.some((c) => c.isDefault)) {
    await setDefaultDownloadClient(remaining[0].id);
  }
}

export async function clearOtherDefaults(exceptId: string): Promise<void> {
  await db
    .update(downloadClients)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(ne(downloadClients.id, exceptId));
}
