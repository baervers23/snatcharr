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

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Prowlarr category IDs mapped to readable names */
export const PROWLARR_CATEGORIES: Record<number, string> = {
  1000: "Console",
  1010: "Console/NDS",
  1020: "Console/PSP",
  1030: "Console/Wii",
  1040: "Console/XBox",
  1050: "Console/XBox 360",
  1060: "Console/Wii U",
  1070: "Console/Xbox One",
  1080: "Console/PS4",
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
  6030: "XXX/XViD",
  6040: "XXX/x264",
  6050: "XXX/UHD",
  6060: "XXX/Other",
  6070: "XXX/Imageset",
  6080: "XXX/Packs",
  7000: "Books",
  7010: "Books/Mags",
  7020: "Books/Ebook",
  7030: "Books/Comics",
  7040: "Books/Technical",
  7050: "Books/Other",
  7060: "Books/Foreign",
  8000: "Other",
  8010: "Other/Misc",
  8020: "Other/Hashed",
};

export const CATEGORY_GROUPS = [
  { label: "PC/Software", ids: [4000, 4010, 4020, 4030, 4050] },
  { label: "Games/Console", ids: [1000, 1010, 1020, 1030, 1040, 1050, 1060, 1070, 1080] },
  { label: "Movies", ids: [2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060, 2070, 2080] },
  { label: "TV", ids: [5000, 5020, 5030, 5040, 5045, 5050, 5060, 5070, 5080] },
  { label: "Audio", ids: [3000, 3010, 3020, 3040, 3050, 3060] },
  { label: "Audio/Lossless", ids: [3040] },
  { label: "Ebooks", ids: [7020, 7030, 7040, 7050, 7060] },
  { label: "Books/Mags", ids: [7000, 7010] },
  { label: "Other", ids: [8000, 8010, 8020] },
];
