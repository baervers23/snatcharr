export const DEFAULT_PROWLARR_SEARCH_TAGS = ["snatcharr-only"] as const;

/** Use `*` in settings to search all enabled Prowlarr indexers (no tag filter). */
export const PROWLARR_TAGS_ALL = "*";

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function parseProwlarrTagsJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => String(t).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Tags used for search — empty DB value falls back to snatcharr-only, not “all indexers”. */
export function effectiveProwlarrSearchTags(raw: string | null | undefined): string[] {
  const parsed = parseProwlarrTagsJson(raw);
  if (parsed.length === 0) return [...DEFAULT_PROWLARR_SEARCH_TAGS];
  if (parsed.length === 1 && parsed[0] === PROWLARR_TAGS_ALL) return [];
  return parsed;
}

export function parseProwlarrTagsInput(input: string): string[] {
  if (!input.trim()) return [];
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function formatProwlarrTagsInput(tags: string[]): string {
  return tags.join(", ");
}

export function serializeProwlarrTags(tags: string[]): string {
  const cleaned = tags.map((t) => t.trim()).filter(Boolean);
  return JSON.stringify(cleaned);
}

export function tagNamesMatch(includeTags: string[], indexerTagLabels: string[]): boolean {
  if (includeTags.length === 0) return true;
  const wanted = new Set(includeTags.map(normalizeTag));
  return indexerTagLabels.some((label) => wanted.has(normalizeTag(label)));
}
