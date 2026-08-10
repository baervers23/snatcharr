import type { AppConfig } from "./config";
import type { AppSettings } from "./db/settings-shared";

export type SetupGeneralSettings = {
  authMethod: AppSettings["authMethod"];
  signupEnabled: boolean;
  requireEmail: boolean;
  requireAppGrant: boolean;
  maxSearchRequestsPerUserPerDay: number;
  maxGrabsPerUserPerDay: number;
  warningOnOpen: "once" | "always" | "disabled";
  importantPopupText: string;
};

export function authMethodFromConfig(config: AppConfig): AppSettings["authMethod"] {
  if (config.authMethod) return config.authMethod;
  return "local";
}

export function requireAppGrantFromConfig(config: AppConfig): boolean {
  if (config.requireAppGrant !== undefined) return config.requireAppGrant;
  return !!(config.usersNeedSearchGrant || config.usersNeedGrabGrant);
}

export function generalFromConfig(config: AppConfig): SetupGeneralSettings {
  return {
    authMethod: authMethodFromConfig(config),
    signupEnabled: config.allowGuestRegister,
    requireEmail: config.emailRequired,
    requireAppGrant: requireAppGrantFromConfig(config),
    maxSearchRequestsPerUserPerDay: config.maxSearchRequestsPerUserPerDay ?? 0,
    maxGrabsPerUserPerDay: config.maxGrabsPerUserPerDay ?? 0,
    warningOnOpen: config.warningOnOpen,
    importantPopupText: config.importantPopupText,
  };
}

export function mergeGeneralFromDb(
  config: AppConfig,
  db: Partial<AppSettings>,
): SetupGeneralSettings {
  const fromConfig = generalFromConfig(config);
  return {
    authMethod: db.authMethod ?? fromConfig.authMethod,
    signupEnabled: db.signupEnabled ?? fromConfig.signupEnabled,
    requireEmail: db.requireEmail ?? fromConfig.requireEmail,
    requireAppGrant: db.requireAppGrant ?? fromConfig.requireAppGrant,
    maxSearchRequestsPerUserPerDay:
      db.maxSearchRequestsPerUserPerDay ?? fromConfig.maxSearchRequestsPerUserPerDay,
    maxGrabsPerUserPerDay: db.maxGrabsPerUserPerDay ?? fromConfig.maxGrabsPerUserPerDay,
    warningOnOpen:
      db.infoPopupMode ??
      (db.infoPopupEnabled === false
        ? "disabled"
        : db.infoPopupEnabled === true
          ? "always"
          : fromConfig.warningOnOpen),
    importantPopupText: db.infoPopupText ?? fromConfig.importantPopupText,
  };
}

export function generalToDbSettings(gs: SetupGeneralSettings): Partial<AppSettings> {
  return {
    authMethod: gs.authMethod,
    signupEnabled: gs.signupEnabled,
    requireEmail: gs.requireEmail,
    requireAppGrant: gs.requireAppGrant,
    maxSearchRequestsPerUserPerDay: gs.maxSearchRequestsPerUserPerDay,
    maxGrabsPerUserPerDay: gs.maxGrabsPerUserPerDay,
    infoPopupEnabled: gs.warningOnOpen !== "disabled",
    infoPopupMode: gs.warningOnOpen,
    infoPopupText: gs.importantPopupText,
    setupCompleted: true,
  };
}

export function generalToConfigPatch(gs: SetupGeneralSettings): Partial<AppConfig> {
  return {
    authMethod: gs.authMethod,
    allowGuestRegister: gs.signupEnabled,
    emailRequired: gs.requireEmail,
    requireAppGrant: gs.requireAppGrant,
    maxSearchRequestsPerUserPerDay: gs.maxSearchRequestsPerUserPerDay,
    maxGrabsPerUserPerDay: gs.maxGrabsPerUserPerDay,
    warningOnOpen: gs.warningOnOpen,
    importantPopupText: gs.importantPopupText,
  };
}
