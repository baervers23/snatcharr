import { db } from "./db";
import { externalApps } from "./db/schema";
import type { AppSettings } from "./db/settings";
import { and, eq } from "drizzle-orm";
import {
  authJellyfinForSync,
  authSeerrForSyncWithFallback,
} from "./external-auth";

async function getEnabledSyncApp(type: "jellyfin" | "seerr") {
  const apps = await db.query.externalApps.findMany({
    where: and(eq(externalApps.enabled, true), eq(externalApps.type, type)),
  });
  return apps.find((a) => !!a.apiKey?.trim()) ?? null;
}

function authPathUsesJellyfin(method: AppSettings["authMethod"], via?: string): boolean {
  const path = via ?? method;
  return path === "jellyfin" || path.includes("jellyfin");
}

function authPathUsesSeerr(method: AppSettings["authMethod"], via?: string): boolean {
  const path = via ?? method;
  return path === "seerr" || path.startsWith("seerr");
}

/** If Seerr has an email and it differs from Snatcharr, return the Seerr address. */
export function seerrEmailOverride(
  snatcharrEmail: string | null | undefined,
  seerrEmail: string | null | undefined,
): string | undefined {
  const external = seerrEmail?.trim();
  if (!external) return undefined;
  const current = (snatcharrEmail ?? "").trim();
  if (external.toLowerCase() === current.toLowerCase()) return undefined;
  return external;
}

export type AuthEmailImportResult = {
  email: string | null;
  /** True when email was fetched from Jellyfin/Seerr API sync. */
  syncedFromApp: boolean;
};

/**
 * After successful external auth: sync email from the auth provider's app(s).
 * Jellyfin/Seerr API success → imported email + caller should mark verified.
 */
export async function resolveEmailOnAuthImport(opts: {
  authMethod: AppSettings["authMethod"];
  via?: string;
  username: string;
  snatcharrEmail?: string | null;
  authEmail?: string | null;
  jellyfinUserId?: string | null;
}): Promise<AuthEmailImportResult> {
  const { authMethod, username, snatcharrEmail, authEmail, jellyfinUserId } = opts;
  const via = opts.via ?? authMethod;

  let syncedEmail: string | undefined;
  let syncedFromApp = false;

  const jellyfinApp = await getEnabledSyncApp("jellyfin");
  const seerrApp = await getEnabledSyncApp("seerr");

  if (authPathUsesJellyfin(authMethod, via) && jellyfinApp?.apiKey) {
    const info = await authJellyfinForSync(jellyfinApp.url, jellyfinApp.apiKey, {
      username,
      jellyfinUserId,
    });
    if (info.ok && info.email?.trim()) {
      syncedEmail = info.email.trim();
      syncedFromApp = true;
    }
  }

  if (authPathUsesSeerr(authMethod, via) && seerrApp?.apiKey) {
    const info = await authSeerrForSyncWithFallback(
      seerrApp.url,
      seerrApp.apiKey,
      { username, jellyfinUserId },
      jellyfinApp,
    );
    if (info.ok && info.email?.trim()) {
      syncedEmail = info.email.trim();
      syncedFromApp = true;
    }
  }

  // Jellyfin auth often has email only in Seerr — try Seerr as secondary source.
  if (!syncedFromApp && authPathUsesJellyfin(authMethod, via) && seerrApp?.apiKey) {
    const info = await authSeerrForSyncWithFallback(
      seerrApp.url,
      seerrApp.apiKey,
      { username, jellyfinUserId },
      jellyfinApp,
    );
    if (info.ok && info.email?.trim()) {
      syncedEmail = info.email.trim();
      syncedFromApp = true;
    }
  }

  if (syncedEmail) {
    const override = seerrEmailOverride(snatcharrEmail, syncedEmail);
    return {
      email: override ?? syncedEmail,
      syncedFromApp,
    };
  }

  const fromAuth = authEmail?.trim();
  if (fromAuth) {
    const override = seerrEmailOverride(snatcharrEmail, fromAuth);
    return {
      email: override ?? fromAuth,
      syncedFromApp: false,
    };
  }

  return {
    email: snatcharrEmail?.trim() || null,
    syncedFromApp: false,
  };
}

/**
 * Resolve email after external auth or import: prefer Seerr email when it differs.
 * Falls back to existing Snatcharr email, then auth response email.
 * @deprecated Prefer resolveEmailOnAuthImport for login import flow.
 */
export async function resolveEmailWithSeerrSync(
  username: string,
  snatcharrEmail: string | null | undefined,
  authEmail?: string | null,
  jellyfinUserId?: string | null,
): Promise<string | null> {
  const result = await resolveEmailOnAuthImport({
    authMethod: "seerr",
    username,
    snatcharrEmail,
    authEmail,
    jellyfinUserId,
  });
  return result.email;
}
