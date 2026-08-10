import { db } from "./db";
import { externalApps, users } from "./db/schema";
import type { ExternalApp, User } from "./db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { authJellyfinForSync, authSeerrForSyncWithFallback } from "./external-auth";
import { cacheUserAvatar } from "./avatars";
import { seerrEmailOverride } from "./email-sync";
import { importedEmailPatch } from "./email-verification";

export type SyncSource = "jellyfin" | "seerr";

const SYNC_SOURCES: SyncSource[] = ["jellyfin", "seerr"];

export interface UserSyncResult {
  ok: boolean;
  email?: string | null;
  avatarUrl?: string | null;
  error?: string;
}

function isSyncApp(app: ExternalApp, source: SyncSource): boolean {
  if (!app.enabled || app.type !== source) return false;
  return !!app.apiKey?.trim();
}

/** Enabled Jellyfin/Seerr apps with API key (health check not required). */
export async function getHealthySyncApps(
  sources?: SyncSource[],
): Promise<{ jellyfin: ExternalApp | null; seerr: ExternalApp | null }> {
  const wanted = sources ?? SYNC_SOURCES;
  const apps = await db.query.externalApps.findMany({
    where: and(
      eq(externalApps.enabled, true),
      inArray(externalApps.type, wanted),
    ),
  });

  const jellyfin =
    wanted.includes("jellyfin")
      ? apps.find((a) => isSyncApp(a, "jellyfin")) ?? null
      : null;
  const seerr =
    wanted.includes("seerr")
      ? apps.find((a) => isSyncApp(a, "seerr")) ?? null
      : null;

  return { jellyfin, seerr };
}

async function resolveAvatar(
  userId: string,
  remoteUrl: string | undefined,
  headers?: Record<string, string>,
): Promise<string | undefined> {
  if (!remoteUrl) return undefined;
  const cached = await cacheUserAvatar(userId, remoteUrl, headers ? { headers } : undefined);
  return cached ?? undefined;
}

export async function syncUserFromExternalApps(
  user: User,
  source: SyncSource,
): Promise<UserSyncResult> {
  const { jellyfin: jellyfinApp, seerr } = await getHealthySyncApps([source]);
  const jellyfinForSeerr =
    source === "seerr" && !jellyfinApp
      ? (await getHealthySyncApps(["jellyfin"])).jellyfin
      : jellyfinApp;
  const updates: Partial<User> = { updatedAt: new Date() };
  const errors: string[] = [];

  if (source === "jellyfin" && jellyfinApp?.apiKey) {
    const info = await authJellyfinForSync(jellyfinApp.url, jellyfinApp.apiKey, {
      jellyfinUserId: user.jellyfinUserId,
      username: user.username,
    });
    if (info.ok) {
      if (info.email?.trim()) {
        updates.email = info.email.trim();
        Object.assign(updates, importedEmailPatch(updates.email));
      }
      if (info.externalId) updates.jellyfinUserId = info.externalId;
      if (info.avatarUrl) {
        const local = await resolveAvatar(user.id, info.avatarUrl);
        if (local) updates.avatarUrl = local;
      }
    } else if (info.error) {
      errors.push(`Jellyfin: ${info.error}`);
    }
  }

  if (seerr?.apiKey) {
    const info = await authSeerrForSyncWithFallback(
      seerr.url,
      seerr.apiKey,
      { username: user.username, jellyfinUserId: user.jellyfinUserId },
      jellyfinForSeerr,
    );
    if (info.ok) {
      const override = seerrEmailOverride(user.email, info.email);
      const resolved = (override ?? info.email?.trim()) || undefined;
      if (resolved) {
        updates.email = resolved;
        Object.assign(updates, importedEmailPatch(resolved));
      }
      if (info.avatarUrl) {
        const headers = { "X-Api-Key": seerr.apiKey };
        const local = await resolveAvatar(user.id, info.avatarUrl, headers);
        if (local) updates.avatarUrl = local;
      }
    } else if (info.error) {
      errors.push(`Seerr: ${info.error}`);
    }
  }

  const hasProfileData =
    updates.email !== undefined ||
    updates.avatarUrl !== undefined ||
    updates.jellyfinUserId !== undefined;

  if (!hasProfileData) {
    if (errors.length > 0) {
      return { ok: false, error: errors[0] };
    }
    await db
      .update(users)
      .set({ imported: true, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return { ok: true, email: user.email, avatarUrl: user.avatarUrl };
  }

  updates.imported = true;
  await db.update(users).set(updates).where(eq(users.id, user.id));
  return {
    ok: true,
    email: updates.email ?? user.email,
    avatarUrl: updates.avatarUrl ?? user.avatarUrl,
  };
}
