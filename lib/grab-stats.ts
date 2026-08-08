import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

/** Increment when a new grab is queued (survives grab record deletion). */
export async function recordGrabQueued(userId: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return;
  await db
    .update(users)
    .set({
      lifetimeGrabs: (user.lifetimeGrabs ?? 0) + 1,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/** Increment when a grab completes (bytes + completed count, once per grab). */
export async function recordGrabCompleted(userId: string, bytes: number): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return;
  const safeBytes = Math.max(0, Math.floor(bytes) || 0);
  await db
    .update(users)
    .set({
      lifetimeCompleted: (user.lifetimeCompleted ?? 0) + 1,
      lifetimeBytes: (user.lifetimeBytes ?? 0) + safeBytes,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

