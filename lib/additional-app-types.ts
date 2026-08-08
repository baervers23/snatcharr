import { defaultServiceUrl } from "@/lib/service-urls";

export type AdditionalAppType = "jellyfin" | "seerr" | "organizr" | "jfago";

export const ADDITIONAL_APP_LOGIN_NOTE =
  "On successful login the user will be imported!";

export const ADDITIONAL_APP_TYPES: Record<
  AdditionalAppType,
  { label: string; defaultUrl: string; features: string[] }
> = {
  jellyfin: {
    label: "Jellyfin",
    defaultUrl: defaultServiceUrl("jellyfin"),
    features: [
      "Authenticate via Jellyfin",
      "Import User",
      "Sync Profile Picture",
    ],
  },
  seerr: {
    label: "Seerr",
    defaultUrl: defaultServiceUrl("seerr"),
    features: [
      "Authenticate via Jellyfin from Seerr",
      "Import Jellyfin User",
      "Import Plex User",
      "Import Emby User",
      "Import Local Seerr User",
      "Sync Profile Picture",
      "Sync Email Address",
      "Sync many more useful User data",
    ],
  },
  organizr: {
    label: "Organizr",
    defaultUrl: defaultServiceUrl("organizr"),
    features: [
      "Authenticate via Organizr",
      "SSO with Organizr Token",
      "Use Mailer from Organizr to write Mails",
      "Import User Data like Email",
    ],
  },
  jfago: {
    label: "JFA-GO",
    defaultUrl: defaultServiceUrl("jfago"),
    features: [
      "Authenticate with JFA-GO API",
      "Sync User data like Email Address",
    ],
  },
};

export function additionalAppMeta(type: string) {
  return (
    ADDITIONAL_APP_TYPES[type as AdditionalAppType] ?? {
      label: type,
      defaultUrl: "",
      features: [] as string[],
    }
  );
}
