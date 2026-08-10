import { db } from "./db";
import { users } from "./db/schema";
import { eq, isNull, or } from "drizzle-orm";

/** Users that follow global grab limits (ignore_synced_limits = 0 or unset). */
export function usersFollowingSyncedLimits() {
  return or(eq(users.ignoreSyncedLimits, false), isNull(users.ignoreSyncedLimits));
}

export async function syncGlobalGrabLimitToUsers(limit: number): Promise<void> {
  await db
    .update(users)
    .set({ maxGrabsPerDay: limit, updatedAt: new Date() })
    .where(usersFollowingSyncedLimits());
}
