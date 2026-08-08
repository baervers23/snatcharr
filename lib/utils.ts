import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatAge(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  if (days > 365) return `${Math.floor(days / 365)}y`;
  if (days > 30) return `${Math.floor(days / 30)}mo`;
  if (days > 0) return `${days}d`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function generateToken(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  for (const byte of randomArray) {
    token += chars[byte % chars.length];
  }
  return token;
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "***";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

/** Resolve a human-readable category label from indexer metadata. */
export function resolveCategoryLabel(
  categories?: Array<{ id: number; name?: string }>,
): string {
  const cat = categories?.[0];
  if (!cat) return "—";
  const name = cat.name?.trim();
  if (name && !/^\d+$/.test(name)) return name;
  return PROWLARR_CATEGORIES[cat.id] ?? name ?? String(cat.id);
}

/** Resolve category label from a stored grab record. */
export function resolveGrabCategoryLabel(grab: {
  categoryId?: number | null;
  category?: string | null;
}): string {
  if (grab.categoryId != null && PROWLARR_CATEGORIES[grab.categoryId]) {
    return PROWLARR_CATEGORIES[grab.categoryId];
  }
  if (grab.category?.trim()) return grab.category.trim();
  if (grab.categoryId != null) return String(grab.categoryId);
  return "Unknown";
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Prowlarr / Newznab category IDs mapped to readable names */
export const PROWLARR_CATEGORIES: Record<number, string> = {
  1000: "Console",
  1010: "Console/NDS",
  1020: "Console/PSP",
  1030: "Console/Wii",
  1040: "Console/XBox",
  1050: "Console/XBox 360",
  1060: "Console/Wiiware",
  1070: "Console/XBox 360 DLC",
  1080: "Console/PS3",
  1090: "Console/Other",
  1110: "Console/3DS",
  1120: "Console/PS Vita",
  1130: "Console/WiiU",
  1140: "Console/XBox One",
  1180: "Console/PS4",
  2000: "Movies",
  2010: "Movies/Foreign",
  2020: "Movies/Other",
  2030: "Movies/SD",
  2040: "Movies/HD",
  2045: "Movies/UHD",
  2050: "Movies/BluRay",
  2060: "Movies/3D",
  2070: "Movies/DVD",
  2080: "Movies/WEB-DL",
  3000: "Audio",
  3010: "Audio/MP3",
  3020: "Audio/Video",
  3030: "Audio/Audiobook",
  3040: "Audio/Lossless",
  3050: "Audio/Other",
  3060: "Audio/Foreign",
  4000: "PC",
  4010: "PC/0day",
  4020: "PC/ISO",
  4030: "PC/Mac",
  4040: "PC/Mobile-Other",
  4050: "PC/Games",
  4060: "PC/Mobile-iOS",
  4070: "PC/Mobile-Android",
  5000: "TV",
  5010: "TV/WEB-DL",
  5020: "TV/Foreign",
  5030: "TV/SD",
  5040: "TV/HD",
  5045: "TV/UHD",
  5050: "TV/Other",
  5060: "TV/Sport",
  5070: "TV/Anime",
  5080: "TV/Documentary",
  6000: "XXX",
  6010: "XXX/DVD",
  6020: "XXX/WMV",
  6030: "XXX/XviD",
  6040: "XXX/x264",
  6045: "XXX/UHD",
  6050: "XXX/Pack",
  6060: "XXX/ImageSet",
  6070: "XXX/Other",
  6080: "XXX/SD",
  6090: "XXX/WEB-DL",
  7000: "Books",
  7010: "Books/Mags",
  7020: "Books/EBook",
  7030: "Books/Comics",
  7040: "Books/Technical",
  7050: "Books/Other",
  7060: "Books/Foreign",
  8000: "Other",
  8010: "Other/Misc",
  8020: "Other/Hashed",
  100000: "Custom",
};

export interface CategorySub {
  label: string;
  ids: number[];
}
export interface CategoryGroup {
  label: string;
  ids: number[]; // all ids in the group (used when no subcategory is chosen)
  subcategories: CategorySub[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: "Console",
    ids: [1000, 1010, 1020, 1030, 1040, 1050, 1060, 1070, 1080, 1090, 1110, 1120, 1130, 1140, 1180],
    subcategories: [
      { label: "NDS", ids: [1010] },
      { label: "PSP", ids: [1020] },
      { label: "Wii", ids: [1030] },
      { label: "XBox", ids: [1040] },
      { label: "XBox 360", ids: [1050] },
      { label: "Wiiware", ids: [1060] },
      { label: "XBox 360 DLC", ids: [1070] },
      { label: "PS3", ids: [1080] },
      { label: "Other", ids: [1090] },
      { label: "3DS", ids: [1110] },
      { label: "PS Vita", ids: [1120] },
      { label: "WiiU", ids: [1130] },
      { label: "XBox One", ids: [1140] },
      { label: "PS4", ids: [1180] },
    ],
  },
  {
    label: "Movies",
    ids: [2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060, 2070, 2080],
    subcategories: [
      { label: "Foreign", ids: [2010] },
      { label: "Other", ids: [2020] },
      { label: "SD", ids: [2030] },
      { label: "HD", ids: [2040] },
      { label: "UHD", ids: [2045] },
      { label: "BluRay", ids: [2050] },
      { label: "3D", ids: [2060] },
      { label: "DVD", ids: [2070] },
      { label: "WEB-DL", ids: [2080] },
    ],
  },
  {
    label: "TV",
    ids: [5000, 5010, 5020, 5030, 5040, 5045, 5050, 5060, 5070, 5080],
    subcategories: [
      { label: "WEB-DL", ids: [5010] },
      { label: "Foreign", ids: [5020] },
      { label: "SD", ids: [5030] },
      { label: "HD", ids: [5040] },
      { label: "UHD", ids: [5045] },
      { label: "Other", ids: [5050] },
      { label: "Sport", ids: [5060] },
      { label: "Anime", ids: [5070] },
      { label: "Documentary", ids: [5080] },
    ],
  },
  {
    label: "Audio",
    ids: [3000, 3010, 3020, 3030, 3040, 3050, 3060],
    subcategories: [
      { label: "MP3", ids: [3010] },
      { label: "Video", ids: [3020] },
      { label: "Audiobook", ids: [3030] },
      { label: "Lossless", ids: [3040] },
      { label: "Other", ids: [3050] },
      { label: "Foreign", ids: [3060] },
    ],
  },
  {
    label: "PC",
    ids: [4000, 4010, 4020, 4030, 4040, 4050, 4060, 4070],
    subcategories: [
      { label: "0day", ids: [4010] },
      { label: "ISO", ids: [4020] },
      { label: "Mac", ids: [4030] },
      { label: "Mobile-Other", ids: [4040] },
      { label: "Games", ids: [4050] },
      { label: "Mobile-iOS", ids: [4060] },
      { label: "Mobile-Android", ids: [4070] },
    ],
  },
  {
    label: "XXX",
    ids: [6000, 6010, 6020, 6030, 6040, 6045, 6050, 6060, 6070, 6080, 6090],
    subcategories: [
      { label: "DVD", ids: [6010] },
      { label: "WMV", ids: [6020] },
      { label: "XviD", ids: [6030] },
      { label: "x264", ids: [6040] },
      { label: "UHD", ids: [6045] },
      { label: "Pack", ids: [6050] },
      { label: "ImageSet", ids: [6060] },
      { label: "Other", ids: [6070] },
      { label: "SD", ids: [6080] },
      { label: "WEB-DL", ids: [6090] },
    ],
  },
  {
    label: "Books",
    ids: [7000, 7010, 7020, 7030, 7040, 7050, 7060],
    subcategories: [
      { label: "Mags", ids: [7010] },
      { label: "EBook", ids: [7020] },
      { label: "Comics", ids: [7030] },
      { label: "Technical", ids: [7040] },
      { label: "Other", ids: [7050] },
      { label: "Foreign", ids: [7060] },
    ],
  },
  {
    label: "Other",
    ids: [8000, 8010, 8020, 100000],
    subcategories: [
      { label: "Misc", ids: [8010] },
      { label: "Hashed", ids: [8020] },
      { label: "Custom", ids: [100000] },
    ],
  },
];
