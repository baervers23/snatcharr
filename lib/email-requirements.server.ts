import { isMailConfigured } from "./mail";
import { getHealthySyncApps } from "./user-sync";

/** Server layout / gates — checks live SMTP + sync app config. */
export async function canEnforceRequireEmail(): Promise<{
  allowed: boolean;
  smtp: boolean;
  syncApps: boolean;
}> {
  const [smtp, sync] = await Promise.all([isMailConfigured(), getHealthySyncApps()]);
  const syncApps = !!(sync.jellyfin || sync.seerr);
  return { allowed: smtp || syncApps, smtp, syncApps };
}
