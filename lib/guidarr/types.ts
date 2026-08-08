/** Guidarr domain types — groups, slides, and app configuration. */

export interface GuidarrConfig {
  setupComplete: boolean;
  adminPasswordHash: string | null;
  backgroundColor: string;
  backgroundImage: string | null;
}

export interface GuidarrGroup {
  id: string;
  name: string;
  icon: string | null;
  order: number;
}

export interface GuidarrSlide {
  id: string;
  title: string;
  order: number;
  redirectUrl: string | null;
}

export interface GuidarrSlideWithHtml extends GuidarrSlide {
  html: string;
  markdown: string;
}

export const DEFAULT_CONFIG: GuidarrConfig = {
  setupComplete: false,
  adminPasswordHash: null,
  backgroundColor: "#0f172a",
  backgroundImage: null,
};

export const ADMIN_SESSION_COOKIE = "guidarr-admin-session";
export const LOCAL_STORAGE_ADMIN_KEY = "adminPassword";
export const LOCAL_STORAGE_SESSION_KEY = "guidarrAdminSession";
