import type { AppSettings } from "./db/settings-shared";

export const AUTH_METHOD_INFO: Record<
  AppSettings["authMethod"],
  { label: string; description: string; features: string[] }
> = {
  local: {
    label: "Local (Username / Password)",
    description: "Snatcharr manages accounts locally.",
    features: ["Local username/password login", "Admin creates users or enables public signup"],
  },
  jellyfin: {
    label: "Jellyfin",
    description: "Users log in with Jellyfin credentials.",
    features: ["Authenticate login via Jellyfin user", "Manual sync user information (admin)"],
  },
  "seerr-jellyfin": {
    label: "Seerr — via Jellyfin",
    description: "Jellyfin credentials verified through Seerr.",
    features: ["Authenticate login via Jellyfin user (from Seerr)", "Manual sync user list (admin)"],
  },
  "seerr-jellyfin-fallback": {
    label: "Seerr Jellyfin + Jellyfin fallback",
    description: "Try Seerr first, then direct Jellyfin if Seerr fails.",
    features: ["Seerr Jellyfin auth with Jellyfin fallback", "Manual sync user list (admin)"],
  },
  "seerr-local": {
    label: "Seerr — local account",
    description: "Users log in with Seerr email and password.",
    features: ["Authenticate login via Seerr user", "Manual sync user list (admin)"],
  },
  seerr: {
    label: "Seerr (legacy)",
    description: "Same as Seerr local account.",
    features: ["Authenticate login via Seerr user", "Manual sync user list (admin)"],
  },
  organizr: {
    label: "Organizr v2 Auth",
    description: "Login with Organizr user via API.",
    features: ["Organizr API login", "Manual sync user data (admin)"],
  },
  "organizr-sso": {
    label: "Organizr as SSO",
    description: "Validate Organizr session cookie via /api/v2/auth.",
    features: ["Auto-login with Organizr token", "Manual sync user data (admin)"],
  },
  jfago: {
    label: "JFA-GO Auth",
    description: "Login via JFA-GO API (Jellyfin credentials).",
    features: ["Authenticate via JFA-GO", "Sync Jellyfin user data (admin)"],
  },
};

export type AuthAppLike = { type: string; enabled?: boolean };

export const AUTH_METHOD_HELP = `Local
Snatcharr manages accounts locally (username / password).

Jellyfin Auth
Login with Jellyfin user via API. Sync user data.

Seerr Auth
Jellyfin user per API. Sync user data, email address, Plex data.

Organizr v2 Auth
Login with Organizr user per API, then store token.

Organizr as SSO
Check Organizr token or call /api/v2/auth — if valid, auto-login user. Sync user data possible.

JFA-GO Auth
Login via JFA-GO API. Sync user data.`;

export function authMethodOptions(apps: AuthAppLike[]) {
  const hasJellyfin = apps.some((a) => a.type === "jellyfin" && a.enabled !== false);
  const hasOrganizr = apps.some((a) => a.type === "organizr" && a.enabled !== false);
  const hasSeerr = apps.some((a) => a.type === "seerr" && a.enabled !== false);
  const hasJfago = apps.some((a) => a.type === "jfago" && a.enabled !== false);
  return { hasJellyfin, hasOrganizr, hasSeerr, hasJfago };
}
