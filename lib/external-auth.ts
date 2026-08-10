import { db } from "./db";
import { externalApps } from "./db/schema";
import type { ExternalApp } from "./db/schema";
import { and, eq } from "drizzle-orm";
import type { AppSettings } from "./db/settings";
import { logActionFail } from "./audit";

export type ExternalAppType = ExternalApp["type"];

export interface ExternalAuthResult {
  ok: boolean;
  /** True when the provider could not be reached or verified (not wrong password). */
  unreachable?: boolean;
  isAdmin?: boolean;
  /** Resolved username from the provider (SSO flows). */
  username?: string;
  email?: string;
  avatarUrl?: string;
  externalId?: string;
  error?: string;
  via?: string;
}

export function isAuthUnreachable(result: ExternalAuthResult): boolean {
  return !!result.unreachable;
}

function normalizeUrl(url: string): string {
  let u = url.trim().replace(/\/$/, "");
  if (!u.startsWith("http://") && !u.startsWith("https://")) u = `http://${u}`;
  return u;
}

function connectionError(service: string, baseUrl: string, err: unknown): ExternalAuthResult {
  const msg = err instanceof Error ? err.message : "Connection failed";
  const cause =
    err instanceof Error && err.cause instanceof Error
      ? err.cause.message
      : err instanceof Error && "code" in err
        ? String((err as NodeJS.ErrnoException).code)
        : "";

  const unreachable =
    msg.includes("fetch failed") ||
    cause.includes("ECONNREFUSED") ||
    cause.includes("ENOTFOUND") ||
    (err as NodeJS.ErrnoException)?.code === "ECONNREFUSED";

  const hint = unreachable
    ? " — service unreachable (from WSL, use the Windows host IP instead of localhost)"
    : "";

  logActionFail("AUTH", "connect", "failed", {
    details: `${service} @ ${baseUrl}: ${msg}${cause ? ` (${cause})` : ""}`,
  });
  return { ok: false, unreachable: true, error: `Cannot reach ${service} at ${baseUrl}${hint}` };
}

function missingAppError(appType: string): ExternalAuthResult {
  return { ok: false, unreachable: true, error: `No enabled ${appType} app configured` };
}

async function postJson(url: string, body: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
}

export function appTypeForMethod(method: AppSettings["authMethod"]): ExternalAppType | null {
  switch (method) {
    case "jellyfin":
      return "jellyfin";
    case "organizr":
    case "organizr-sso":
      return "organizr";
    case "jfago":
      return "jfago";
    case "seerr":
    case "seerr-local":
    case "seerr-jellyfin":
    case "seerr-jellyfin-fallback":
      return "seerr";
    default:
      return null;
  }
}

type OrganizrApiEnvelope = {
  response?: {
    result?: string;
    message?: string;
    data?: Record<string, unknown>;
  };
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function organizrCookieHeader(cookieValue: string): string {
  const trimmed = cookieValue.trim();
  if (trimmed.includes("=")) return trimmed;
  return `organizr_token=${trimmed}`;
}

function extractOrganizrToken(cookieValue: string): string {
  const trimmed = cookieValue.trim();
  const eq = trimmed.indexOf("=");
  return eq >= 0 ? trimmed.slice(eq + 1) : trimmed;
}

function claimsFromOrganizrToken(token: string): {
  username?: string;
  email?: string;
  avatarUrl?: string;
  externalId?: string;
} {
  const claims = decodeJwtPayload(token);
  if (!claims) return {};
  const username =
    (typeof claims.username === "string" && claims.username) ||
    (typeof claims.user === "string" && claims.user) ||
    undefined;
  const email = typeof claims.email === "string" ? claims.email : undefined;
  const avatarUrl =
    (typeof claims.image === "string" && claims.image) ||
    (typeof claims.avatar === "string" && claims.avatar) ||
    undefined;
  const externalId =
    claims.userID !== undefined
      ? String(claims.userID)
      : claims.sub !== undefined
        ? String(claims.sub)
        : undefined;
  return { username, email, avatarUrl, externalId };
}

export async function authOrganizrV2(
  baseUrl: string,
  username: string,
  password: string,
): Promise<ExternalAuthResult> {
  const base = normalizeUrl(baseUrl);
  let res: Response;
  try {
    res = await fetch(`${base}/api/v2/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        remember: "",
        oAuth: "",
        oAuthType: "",
        tfaCode: "",
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return connectionError("Organizr", base, err);
  }

  const body = (await res.json().catch(() => ({}))) as OrganizrApiEnvelope;
  const api = body.response ?? {};
  if (api.result !== "success") {
    const msg = api.message ?? `Organizr login failed (${res.status})`;
    const rejected =
      res.status === 401 ||
      res.status === 403 ||
      msg.toLowerCase().includes("incorrect") ||
      msg.toLowerCase().includes("wrong");
    return { ok: false, error: msg, unreachable: !rejected && res.status >= 500 };
  }

  const data = (api.data ?? {}) as Record<string, unknown>;
  const resolvedUsername =
    (typeof data.username === "string" && data.username) || username.toLowerCase();
  const email = typeof data.email === "string" ? data.email : undefined;
  const avatarUrl = typeof data.image === "string" ? data.image : undefined;
  const externalId = data.userID !== undefined ? String(data.userID) : undefined;

  return {
    ok: true,
    username: resolvedUsername,
    email,
    avatarUrl,
    externalId,
    via: "organizr",
  };
}

export async function authOrganizrSso(
  baseUrl: string,
  cookieValue: string,
  groupId = 0,
): Promise<ExternalAuthResult> {
  const base = normalizeUrl(baseUrl);
  const token = extractOrganizrToken(cookieValue);
  if (!token) return { ok: false, error: "No Organizr session token" };

  const cookieHeader = organizrCookieHeader(cookieValue);
  let res: Response;
  try {
    res = await fetch(`${base}/api/v2/auth/${groupId}`, {
      headers: { Cookie: cookieHeader },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return connectionError("Organizr", base, err);
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "Organizr session invalid or not authorized" };
  }
  if (!res.ok) {
    return {
      ok: false,
      unreachable: res.status >= 500,
      error: `Organizr auth check failed (${res.status})`,
    };
  }

  const body = (await res.json().catch(() => ({}))) as OrganizrApiEnvelope;
  const api = body.response ?? {};
  const data = (api.data ?? {}) as Record<string, unknown>;
  const fromClaims = claimsFromOrganizrToken(token);

  const username =
    (typeof data.user === "string" && data.user) ||
    (typeof data.username === "string" && data.username) ||
    fromClaims.username;
  if (!username) return { ok: false, error: "Organizr session valid but username missing" };

  const email =
    (typeof data.email === "string" && data.email) || fromClaims.email;
  const avatarUrl = fromClaims.avatarUrl;
  const externalId =
    data.userID !== undefined ? String(data.userID) : fromClaims.externalId;

  return {
    ok: true,
    username,
    email,
    avatarUrl,
    externalId,
    via: "organizr-sso",
  };
}

export async function authJfaGo(
  baseUrl: string,
  username: string,
  password: string,
): Promise<ExternalAuthResult> {
  const base = normalizeUrl(baseUrl);
  const basic = Buffer.from(`${username}:${password}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(`${base}/my/token/login`, {
      headers: { Authorization: `Basic ${basic}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return connectionError("JFA-GO", base, err);
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "JFA-GO rejected credentials" };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const unreachable = res.status >= 500;
    return {
      ok: false,
      unreachable,
      error: text || `JFA-GO auth failed (${res.status})`,
    };
  }

  const data = (await res.json().catch(() => ({}))) as { token?: string };
  if (!data.token) return { ok: false, error: "JFA-GO returned no token" };

  const claims = decodeJwtPayload(data.token);
  const jfId =
    (typeof claims?.jfid === "string" && claims.jfid) ||
    (typeof claims?.id === "string" && claims.id) ||
    undefined;

  return {
    ok: true,
    username,
    externalId: jfId,
    via: "jfago",
  };
}

async function getEnabledApp(type: ExternalAppType) {
  return db.query.externalApps.findFirst({
    where: and(eq(externalApps.type, type), eq(externalApps.enabled, true)),
  });
}

function jellyfinAvatarUrl(
  base: string,
  apiKey: string,
  jellyfinUserId: string,
  imageTag?: string,
): string {
  const params = new URLSearchParams({ api_key: apiKey });
  if (imageTag) params.set("tag", imageTag);
  return `${base}/Users/${jellyfinUserId}/Images/Primary?${params.toString()}`;
}

export async function authJellyfin(
  baseUrl: string,
  username: string,
  password: string,
): Promise<ExternalAuthResult> {
  const base = normalizeUrl(baseUrl);
  const url = `${base}/Users/authenticatebyname`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Authorization":
          'MediaBrowser Client="Snatcharr", Device="Server", DeviceId="snatcharr", Version="1.0"',
      },
      body: JSON.stringify({ Username: username, Pw: password }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return connectionError("Jellyfin", base, err);
  }

  if (!res.ok) return { ok: false, error: `Jellyfin auth failed (${res.status})` };

  const data = (await res.json()) as {
    User?: { Id?: string; PrimaryImageTag?: string };
  };

  if (!data.User?.Id) return { ok: false, error: "Invalid Jellyfin response" };

  const app = await getEnabledApp("jellyfin");
  const avatarUrl = app?.apiKey
    ? jellyfinAvatarUrl(base, app.apiKey, data.User.Id, data.User.PrimaryImageTag)
    : data.User.PrimaryImageTag
      ? `${base}/Users/${data.User.Id}/Images/Primary?tag=${data.User.PrimaryImageTag}`
      : undefined;

  return { ok: true, externalId: data.User.Id, avatarUrl, via: "jellyfin" };
}

async function fetchJellyfinUserProfile(
  base: string,
  apiKey: string,
  jellyfinUserId: string,
): Promise<{ email?: string; primaryImageTag?: string }> {
  try {
    const res = await fetch(`${base}/Users/${jellyfinUserId}`, {
      headers: { "X-Emby-Token": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { Email?: string; PrimaryImageTag?: string };
    return {
      email: data.Email?.trim() || undefined,
      primaryImageTag: data.PrimaryImageTag || undefined,
    };
  } catch {
    return {};
  }
}

function resolveSeerrAvatar(base: string, avatar?: string): string | undefined {
  if (!avatar?.trim()) return undefined;
  return avatar.startsWith("http") ? avatar : `${base}${avatar.startsWith("/") ? "" : "/"}${avatar}`;
}

/**
 * Read-only Jellyfin user lookup for admin sync (uses API key).
 * Match by Jellyfin user id or Jellyfin username — never Snatcharr's internal user id.
 */
export async function authJellyfinForSync(
  baseUrl: string,
  apiKey: string,
  opts: { jellyfinUserId?: string | null; username: string },
): Promise<ExternalAuthResult> {
  if (!apiKey?.trim()) return { ok: false, error: "No Jellyfin API key" };

  const base = normalizeUrl(baseUrl);
  const jellyfinId = opts.jellyfinUserId?.trim() || undefined;
  const username = opts.username.trim();

  try {
    const res = await fetch(`${base}/Users`, {
      headers: { "X-Emby-Token": apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `Jellyfin users fetch failed (${res.status})` };

    const list = (await res.json()) as Array<{
      Id?: string;
      Name?: string;
      PrimaryImageTag?: string;
    }>;

    const match =
      (jellyfinId ? list.find((u) => u.Id === jellyfinId) : undefined) ??
      list.find((u) => u.Name?.toLowerCase() === username.toLowerCase());

    if (!match?.Id) {
      return {
        ok: false,
        error: `Jellyfin user not found (looked up by ${jellyfinId ? "Jellyfin id + " : ""}username "${username}")`,
      };
    }

    const profile = await fetchJellyfinUserProfile(base, apiKey, match.Id);
    const imageTag = match.PrimaryImageTag ?? profile.primaryImageTag;
    const avatarUrl = jellyfinAvatarUrl(base, apiKey, match.Id, imageTag);

    return {
      ok: true,
      externalId: match.Id,
      avatarUrl,
      email: profile.email,
      via: "jellyfin",
    };
  } catch (err) {
    return connectionError("Jellyfin", base, err);
  }
}

async function authSeerr(
  baseUrl: string,
  username: string,
  password: string,
  mode: "local" | "jellyfin" | "both",
): Promise<ExternalAuthResult> {
  const base = normalizeUrl(baseUrl);
  const attempts: Array<{ endpoint: string; body: Record<string, string> }> = [];

  if (mode === "local" || mode === "both") {
    attempts.push({ endpoint: "/api/v1/auth/local", body: { email: username, password } });
  }
  if (mode === "jellyfin" || mode === "both") {
    attempts.push({ endpoint: "/api/v1/auth/jellyfin", body: { username, password } });
  }

  let lastStatus: number | null = null;

  for (const { endpoint, body } of attempts) {
    let res: Response;
    try {
      res = await postJson(`${base}${endpoint}`, body);
    } catch (err) {
      return connectionError("Seerr", base, err);
    }

    if (!res.ok) {
      lastStatus = res.status;
      continue;
    }

    const data = (await res.json()) as {
      id?: number;
      email?: string;
      avatar?: string;
    };

    const avatarUrl = data.avatar
      ? data.avatar.startsWith("http")
        ? data.avatar
        : `${base}${data.avatar}`
      : undefined;

    return {
      ok: true,
      email: data.email,
      externalId: data.id?.toString(),
      avatarUrl,
      via: "seerr",
    };
  }

  return {
    ok: false,
    error: lastStatus
      ? `Seerr rejected credentials (HTTP ${lastStatus})`
      : "Seerr authentication failed",
  };
}

type SeerrUserRow = {
  id?: number;
  email?: string;
  username?: string;
  jellyfinUsername?: string;
  jellyfinUserId?: string;
  displayName?: string;
  plexUsername?: string;
  avatar?: string;
  userType?: number;
};

/** Jellyfin / Emby-linked Seerr accounts (not Plex or local). */
const SEERR_MEDIA_USER_TYPES = new Set([3, 4]);

export type SeerrSyncLookup = {
  jellyfinUserId?: string | null;
  jellyfinUsername?: string | null;
};

function normalizeJellyfinId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

function jellyfinIdsEqual(a?: string | null, b?: string | null): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  return normalizeJellyfinId(a) === normalizeJellyfinId(b);
}

function seerrLookupNeedles(username: string, lookup?: SeerrSyncLookup): Set<string> {
  const needles = new Set<string>();
  const add = (v?: string | null) => {
    const s = v?.trim().toLowerCase();
    if (s) needles.add(s);
  };
  add(username);
  add(lookup?.jellyfinUsername);
  return needles;
}

/** Match Seerr user by linked app identity (Jellyfin/Plex/local username), not Snatcharr id. */
function seerrUserMatchesRow(
  row: SeerrUserRow,
  needles: Set<string>,
  jellyfinUserId?: string | null,
): boolean {
  if (jellyfinUserId && jellyfinIdsEqual(row.jellyfinUserId, jellyfinUserId)) return true;
  const fields = [
    row.jellyfinUsername,
    row.displayName,
    row.plexUsername,
    row.username,
    row.email,
  ];
  return fields.some((f) => {
    const v = f?.trim().toLowerCase();
    return v ? needles.has(v) : false;
  });
}

async function fetchSeerrUserPage(
  base: string,
  apiKey: string,
  opts?: { q?: string; skip?: number; take?: number },
): Promise<{ results: SeerrUserRow[]; total: number }> {
  const take = opts?.take ?? 50;
  const skip = opts?.skip ?? 0;
  const params = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (opts?.q?.trim()) params.set("q", opts.q.trim());

  const res = await fetch(`${base}/api/v1/user?${params}`, {
    headers: { "X-Api-Key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Seerr user list failed (${res.status})`);

  const data = (await res.json()) as {
    results?: SeerrUserRow[];
    pageInfo?: { results?: number };
  };
  return {
    results: data.results ?? [],
    total: data.pageInfo?.results ?? data.results?.length ?? 0,
  };
}

async function fetchSeerrUserDetail(
  base: string,
  apiKey: string,
  id: number,
): Promise<SeerrUserRow | undefined> {
  try {
    const res = await fetch(`${base}/api/v1/user/${id}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return undefined;
    return (await res.json()) as SeerrUserRow;
  } catch {
    return undefined;
  }
}

async function findSeerrUserInPages(
  base: string,
  apiKey: string,
  needles: Set<string>,
  jellyfinUserId?: string | null,
): Promise<SeerrUserRow | undefined> {
  for (const needle of needles) {
    const { results } = await fetchSeerrUserPage(base, apiKey, { q: needle, take: 50 });
    const match = results.find((u) => seerrUserMatchesRow(u, needles, jellyfinUserId));
    if (match) return match;
  }

  const take = 50;
  let skip = 0;
  let total = Infinity;
  while (skip < total) {
    const page = await fetchSeerrUserPage(base, apiKey, { take, skip });
    total = page.total;
    const match = page.results.find((u) => seerrUserMatchesRow(u, needles, jellyfinUserId));
    if (match) return match;
    if (page.results.length < take) break;
    skip += take;
  }

  return undefined;
}

/** When list rows omit jellyfin fields, check Jellyfin-linked accounts via detail API. */
async function findSeerrUserViaDetailFallback(
  base: string,
  apiKey: string,
  needles: Set<string>,
  jellyfinUserId?: string | null,
): Promise<SeerrUserRow | undefined> {
  if (!jellyfinUserId?.trim()) return undefined;

  const take = 50;
  let skip = 0;
  let total = Infinity;
  while (skip < total) {
    const page = await fetchSeerrUserPage(base, apiKey, { take, skip });
    total = page.total;

    for (const row of page.results) {
      if (row.userType !== undefined && !SEERR_MEDIA_USER_TYPES.has(row.userType)) continue;
      if (seerrUserMatchesRow(row, needles, jellyfinUserId)) return row;
      if (!row.id) continue;

      const detail = await fetchSeerrUserDetail(base, apiKey, row.id);
      if (detail && seerrUserMatchesRow(detail, needles, jellyfinUserId)) {
        return { ...row, ...detail };
      }
    }

    if (page.results.length < take) break;
    skip += take;
  }

  return undefined;
}

async function resolveSeerrUserForSync(
  base: string,
  apiKey: string,
  username: string,
  lookup?: SeerrSyncLookup,
): Promise<SeerrUserRow | undefined> {
  const needles = seerrLookupNeedles(username, lookup);
  const jellyfinUserId = lookup?.jellyfinUserId?.trim() || undefined;

  let match = await findSeerrUserInPages(base, apiKey, needles, jellyfinUserId);
  if (!match && jellyfinUserId) {
    match = await findSeerrUserViaDetailFallback(base, apiKey, needles, jellyfinUserId);
  }
  return match;
}

/** Fetch Seerr user profile by Jellyfin/username/email — never Snatcharr internal id. */
export async function authSeerrForSync(
  baseUrl: string,
  apiKey: string,
  username: string,
  lookup?: SeerrSyncLookup,
): Promise<ExternalAuthResult> {
  const base = normalizeUrl(baseUrl);
  const lookupName = username.trim();
  try {
    let match = await resolveSeerrUserForSync(base, apiKey, lookupName, lookup);
    if (!match) {
      return { ok: false, error: `Seerr user not found for username "${lookupName}"` };
    }

    let avatarUrl = resolveSeerrAvatar(base, match.avatar);
    let email = match.email?.trim() || undefined;

    if (match.id) {
      const detail = await fetchSeerrUserDetail(base, apiKey, match.id);
      if (detail) {
        match = { ...match, ...detail };
        if (!avatarUrl) avatarUrl = resolveSeerrAvatar(base, detail.avatar);
        email = detail.email?.trim() || email;
      }
    }

    return {
      ok: true,
      email,
      externalId: match.id?.toString(),
      avatarUrl,
      via: "seerr",
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Seerr user list failed")) {
      return { ok: false, error: err.message };
    }
    return connectionError("Seerr", base, err);
  }
}

/**
 * Resolve a Seerr user for sync: direct match first, then Jellyfin identity fallback
 * (Jellyfin-only Seerr accounts often have no local username).
 */
export async function authSeerrForSyncWithFallback(
  baseUrl: string,
  apiKey: string,
  user: { username: string; jellyfinUserId?: string | null },
  jellyfinApp?: { url: string; apiKey: string | null } | null,
): Promise<ExternalAuthResult> {
  const initial = await authSeerrForSync(baseUrl, apiKey, user.username, {
    jellyfinUserId: user.jellyfinUserId,
  });
  if (initial.ok) return initial;

  const jellyfinApiKey = jellyfinApp?.apiKey?.trim();
  if (!jellyfinApp || !jellyfinApiKey) return initial;

  const jellyfin = await authJellyfinForSync(jellyfinApp.url, jellyfinApiKey, {
    jellyfinUserId: user.jellyfinUserId,
    username: user.username,
  });
  if (!jellyfin.ok) return initial;

  return authSeerrForSync(baseUrl, apiKey, user.username, {
    jellyfinUserId: jellyfin.externalId,
    jellyfinUsername: user.username,
  });
}

export async function authenticateExternal(
  method: AppSettings["authMethod"],
  username: string,
  password: string,
): Promise<ExternalAuthResult> {
  if (method === "jellyfin") {
    const app = await getEnabledApp("jellyfin");
    if (!app) return missingAppError("jellyfin");
    return authJellyfin(app.url, username, password);
  }

  if (method === "seerr-local") {
    const app = await getEnabledApp("seerr");
    if (!app) return missingAppError("seerr");
    return authSeerr(app.url, username, password, "local");
  }

  if (method === "organizr") {
    const app = await getEnabledApp("organizr");
    if (!app) return missingAppError("organizr");
    return authOrganizrV2(app.url, username, password);
  }

  if (method === "organizr-sso") {
    const app = await getEnabledApp("organizr");
    if (!app) return missingAppError("organizr");
    return authOrganizrSso(app.url, password);
  }

  if (method === "jfago") {
    const app = await getEnabledApp("jfago");
    if (!app) return missingAppError("jfago");
    return authJfaGo(app.url, username, password);
  }

  if (method === "seerr-jellyfin" || method === "seerr-jellyfin-fallback") {
    const seerrApp = await getEnabledApp("seerr");
    if (!seerrApp) return missingAppError("seerr");

    const seerrResult = await authSeerr(seerrApp.url, username, password, "jellyfin");
    if (seerrResult.ok) return seerrResult;

    if (method === "seerr-jellyfin-fallback" && isAuthUnreachable(seerrResult)) {
      const jellyfinApp = await getEnabledApp("jellyfin");
      if (jellyfinApp) {
        logActionFail("AUTH", "login", "aborted", {
          username,
          details: "seerr unreachable — trying jellyfin direct",
        });
        const jellyfinResult = await authJellyfin(jellyfinApp.url, username, password);
        if (jellyfinResult.ok) return jellyfinResult;
        return {
          ok: false,
          error: `${seerrResult.error ?? "Seerr failed"}; Jellyfin fallback: ${jellyfinResult.error ?? "failed"}`,
          unreachable: isAuthUnreachable(jellyfinResult),
        };
      }
    }

    return seerrResult;
  }

  const appType = appTypeForMethod(method);
  if (!appType) return { ok: false, error: "Unknown auth method" };

  const app = await getEnabledApp(appType);
  if (!app) return missingAppError(appType);

  if (appType === "seerr") {
    return authSeerr(app.url, username, password, "both");
  }

  return { ok: false, unreachable: true, error: `${appType} authentication is not implemented` };
}

export function resolvesJellyfinUserId(
  authMethod: AppSettings["authMethod"],
  via?: string,
): boolean {
  return (
    authMethod === "jellyfin" ||
    authMethod === "jfago" ||
    via === "jellyfin" ||
    via === "jfago"
  );
}

export async function authenticateExternalWithFallback(
  primary: AppSettings["authMethod"],
  fallback: AppSettings["authFallbackMethod"],
  username: string,
  password: string,
): Promise<ExternalAuthResult> {
  const primaryResult = await authenticateExternal(primary, username, password);
  if (primaryResult.ok) return primaryResult;

  if (fallback === "none" || fallback === "local" || fallback === primary) {
    return primaryResult;
  }

  logActionFail("AUTH", "login", "aborted", {
    username,
    details: `${primary} failed — trying fallback ${fallback}`,
  });
  return authenticateExternal(fallback, username, password);
}
