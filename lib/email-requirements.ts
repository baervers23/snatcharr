/** Client-safe helpers — no Node/fs/db imports (used by SettingsView). */

export const REQUIRE_EMAIL_DESCRIPTION =
  "Only enforced when SMTP is configured (Settings → Email) or a Jellyfin/Seerr app is enabled with an API key. Sync/auth imports email and auto-verifies; local users need SMTP or admin approval.";

type SyncAppRow = {
  type: string;
  enabled?: boolean | null;
  apiKeySet?: boolean;
  apiKey?: string | null;
};

export function isSmtpConfiguredFromSettings(settings: { smtpHost?: string }): boolean {
  return !!settings.smtpHost?.trim();
}

export function hasSyncAppForEmail(apps: SyncAppRow[]): boolean {
  return apps.some(
    (a) =>
      !!a.enabled &&
      (a.type === "jellyfin" || a.type === "seerr") &&
      (a.apiKeySet ?? !!a.apiKey?.trim()),
  );
}

/** Settings UI — can require-email actually be enforced? */
export function canEnforceRequireEmailFromConfig(
  settings: { smtpHost?: string },
  apps: SyncAppRow[],
): { allowed: boolean; smtp: boolean; syncApps: boolean } {
  const smtp = isSmtpConfiguredFromSettings(settings);
  const syncApps = hasSyncAppForEmail(apps);
  return { allowed: smtp || syncApps, smtp, syncApps };
}
