import type { Indexer } from "./db/schema";
import {
  effectiveProwlarrSearchTags,
  tagNamesMatch,
} from "./prowlarr-tags";
import { searchTorznabIndexer } from "./torznab";

export interface ProwlarrSearchResult {
  guid: string;
  title: string;
  publishDate: string;
  size: number;
  grabs: number;
  categories: Array<{ id: number; name: string }>;
  indexer: string;
  indexerId: number;
  downloadUrl: string;
  commentUrl?: string;
  posterUrl?: string;
  description?: string;
  tvdbId?: number;
  imdbId?: string;
  tmdbId?: number;
}

export interface ProwlarrIndexerStatus {
  id: number;
  name: string;
  enabled: boolean;
  hasError: boolean;
  message?: string;
  lastRssSync?: string;
}

interface ProwlarrIndexerEntry {
  id: number;
  name: string;
  tags?: number[];
  enable?: boolean;
  enabled?: boolean;
}

interface ProwlarrTagEntry {
  id: number;
  label: string;
}

async function fetchProwlarrTagMap(
  baseUrl: string,
  apiKey: string,
): Promise<Map<number, string>> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/tag`;
  const response = await fetch(url, {
    headers: { "X-Api-Key": apiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return new Map();

  const raw = (await response.json()) as ProwlarrTagEntry[];
  return new Map(raw.map((t) => [t.id, t.label]));
}

async function fetchProwlarrIndexerEntries(
  baseUrl: string,
  apiKey: string,
): Promise<ProwlarrIndexerEntry[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/indexer`;
  const response = await fetch(url, {
    headers: { "X-Api-Key": apiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Prowlarr indexers: ${response.status}`);
  }
  return (await response.json()) as ProwlarrIndexerEntry[];
}

/** Resolve Prowlarr indexer IDs whose tags intersect includeTags. Empty includeTags = all enabled. */
export async function resolveProwlarrIndexerIds(
  baseUrl: string,
  apiKey: string,
  includeTags: string[],
): Promise<number[]> {
  const raw = await fetchProwlarrIndexerEntries(baseUrl, apiKey);
  const enabled = raw.filter((i) => i.enable ?? i.enabled ?? true);
  if (includeTags.length === 0) return enabled.map((i) => i.id);

  const tagMap = await fetchProwlarrTagMap(baseUrl, apiKey);
  return enabled
    .filter((row) => {
      const labels = (row.tags ?? [])
        .map((id) => tagMap.get(id))
        .filter((label): label is string => !!label?.trim());
      return tagNamesMatch(includeTags, labels);
    })
    .map((i) => i.id);
}

function normalizeKey(title: string, size: number): string {
  return `${title.toLowerCase().trim()}|${size}`;
}

function parseGrabsFromJson(item: Record<string, unknown>): number {
  for (const key of ["grabs", "Grabs", "downloadVolume", "seeders"]) {
    const n = Number(item[key]);
    if (!Number.isNaN(n) && n > 0) return n;
  }

  const attrSources = [item.attributes, item.customAttributes, item.indexerFlags];
  for (const attrs of attrSources) {
    if (!Array.isArray(attrs)) continue;
    for (const attr of attrs as Array<{ name?: string; value?: unknown }>) {
      if (attr.name?.toLowerCase() === "grabs" && attr.value != null) {
        const n = Number(attr.value);
        if (!Number.isNaN(n)) return n;
      }
    }
  }

  return Number(item.grabs ?? 0) || 0;
}

function mapJsonItem(item: Record<string, unknown>): ProwlarrSearchResult {
  const downloadUrl = String(item.downloadUrl ?? item.DownloadUrl ?? "");
  const guid = String(item.guid ?? item.Guid ?? "");
  return {
    guid,
    title: String(item.title ?? item.Title ?? ""),
    publishDate: String(item.publishDate ?? item.PublishDate ?? ""),
    size: Number(item.size ?? item.Size ?? 0),
    grabs: parseGrabsFromJson(item),
    categories: (item.categories as ProwlarrSearchResult["categories"]) ?? [],
    indexer: String(item.indexer ?? item.Indexer ?? ""),
    indexerId: Number(item.indexerId ?? item.IndexerId ?? 0),
    downloadUrl: downloadUrl || guid,
    commentUrl: (item.commentUrl ?? item.CommentUrl) as string | undefined,
    posterUrl: (item.posterUrl ?? item.imageUrl) as string | undefined,
    description: item.description as string | undefined,
  };
}

async function searchProwlarrJson(
  baseUrl: string,
  apiKey: string,
  query: string,
  categories: number[],
  limit: number,
  indexerIds: number[],
): Promise<ProwlarrSearchResult[]> {
  const params = new URLSearchParams({
    apikey: apiKey,
    query,
    type: "search",
    limit: String(limit),
    offset: "0",
  });
  categories.forEach((c) => params.append("categories", String(c)));
  for (const id of indexerIds) {
    params.append("indexerIds", String(id));
  }

  const url = `${baseUrl}/api/v1/search?${params.toString()}`;
  const response = await fetch(url, {
    headers: { "X-Api-Key": apiKey },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Prowlarr search failed: ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as Array<Record<string, unknown>>;
  return raw.map(mapJsonItem);
}

async function searchProwlarrTorznab(
  baseUrl: string,
  apiKey: string,
  query: string,
  categories: number[],
  limit: number,
  indexerIds?: number[],
): Promise<ProwlarrSearchResult[]> {
  const indexers = await getProwlarrIndexers(baseUrl, apiKey);
  const allowed = indexerIds ? new Set(indexerIds) : null;
  const enabled = indexers.filter((i) => i.enabled && (!allowed || allowed.has(i.id)));

  const batches = await Promise.allSettled(
    enabled.map((idx) =>
      searchTorznabIndexer(baseUrl, apiKey, idx.id, idx.name, query, categories, limit),
    ),
  );

  const results: ProwlarrSearchResult[] = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    if (!batch || batch.status !== "fulfilled") continue;
    const indexerId = enabled[i]!.id;
    for (const item of batch.value) {
      results.push({
        guid: item.guid,
        title: item.title,
        publishDate: item.publishDate,
        size: item.size,
        grabs: item.grabs,
        categories: item.categories,
        indexer: item.indexer,
        indexerId,
        downloadUrl: item.downloadUrl,
        commentUrl: item.commentUrl,
      });
    }
  }
  return results;
}

export async function searchProwlarr(
  indexer: Indexer,
  query: string,
  categories: number[] = [],
  limit = 100,
): Promise<ProwlarrSearchResult[]> {
  const baseUrl = indexer.url.replace(/\/$/, "");
  const includeTags = effectiveProwlarrSearchTags(indexer.prowlarrTags);
  const indexerIds = await resolveProwlarrIndexerIds(baseUrl, indexer.apiKey, includeTags);
  if (includeTags.length > 0 && indexerIds.length === 0) return [];

  const jsonResults = await searchProwlarrJson(
    baseUrl,
    indexer.apiKey,
    query,
    categories,
    limit,
    indexerIds,
  );

  // Unified /api/v1/search respects indexerIds — skip per-indexer torznab when JSON returned hits
  // (torznab re-queries each indexer and duplicates Prowlarr load/log noise).
  if (jsonResults.length > 0) {
    return jsonResults;
  }

  const torznabResults = await searchProwlarrTorznab(
    baseUrl,
    indexer.apiKey,
    query,
    categories,
    limit,
    indexerIds,
  ).catch(() => [] as ProwlarrSearchResult[]);

  if (torznabResults.length === 0) return [];

  const seen = new Set<string>();
  const deduped: ProwlarrSearchResult[] = [];
  for (const r of torznabResults.sort((a, b) => b.grabs - a.grabs)) {
    const key = normalizeKey(r.title, r.size);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }
  return deduped.slice(0, limit);
}

export async function getProwlarrIndexers(
  baseUrl: string,
  apiKey: string,
): Promise<ProwlarrIndexerStatus[]> {
  const raw = await fetchProwlarrIndexerEntries(baseUrl, apiKey);
  return raw.map((i) => ({
    id: i.id,
    name: i.name,
    enabled: i.enable ?? i.enabled ?? true,
    hasError: false,
  }));
}

export async function testProwlarrConnection(
  baseUrl: string,
  apiKey: string,
): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const url = `${baseUrl.replace(/\/$/, "")}/api/v1/system/status`;
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as { version?: string };
    return { ok: true, version: data.version };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

function prowlarrBaseUrl(base: string): URL {
  const root = base.replace(/\/$/, "");
  return new URL(root.includes("://") ? root : `http://${root}`);
}

/** Rewrite Prowlarr proxy URLs to use the configured host (search often returns localhost). */
function rewriteProwlarrDownloadUrl(base: string, downloadUrl: string, apiKey: string): string | null {
  const trimmed = downloadUrl?.trim();
  if (!trimmed) return null;

  const root = base.replace(/\/$/, "");
  const absolute = trimmed.startsWith("http")
    ? trimmed
    : `${root}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;

  try {
    const u = new URL(absolute);
    const configured = prowlarrBaseUrl(base);
    const isProxy =
      /\/api\/v1\/indexer\/\d+\/download/i.test(u.pathname) || /\/\d+\/download/i.test(u.pathname);
    if (isProxy) {
      u.protocol = configured.protocol;
      u.hostname = configured.hostname;
      u.port = configured.port;
    }
    if (!u.searchParams.has("apikey")) u.searchParams.set("apikey", apiKey);
    return u.toString();
  } catch {
    return null;
  }
}

function parseIndexerIdFromDownloadUrl(downloadUrl: string): number | undefined {
  if (!downloadUrl?.trim()) return undefined;
  try {
    const path = new URL(
      downloadUrl.startsWith("http") ? downloadUrl : `http://local${downloadUrl.startsWith("/") ? "" : "/"}${downloadUrl}`,
    ).pathname;
    const apiMatch = path.match(/\/api\/v1\/indexer\/(\d+)\/download/i);
    if (apiMatch) return Number(apiMatch[1]);
    const shortMatch = path.match(/\/(\d+)\/download/i);
    if (shortMatch) return Number(shortMatch[1]);
  } catch {
    // ignore
  }
  return undefined;
}

function parseDownloadQueryParams(
  downloadUrl: string,
): { link?: string; file?: string } {
  if (!downloadUrl?.trim()) return {};
  try {
    const u = new URL(
      downloadUrl.startsWith("http") ? downloadUrl : `http://local${downloadUrl.startsWith("/") ? "" : "/"}${downloadUrl}`,
    );
    return {
      link: u.searchParams.get("link") ?? undefined,
      file: u.searchParams.get("file") ?? undefined,
    };
  } catch {
    return {};
  }
}

function buildIndexerDownloadUrl(
  base: string,
  apiKey: string,
  indexerId: number,
  params: { link?: string; file?: string },
): string | null {
  if (!params.link && !params.file) return null;
  const qs = new URLSearchParams({ apikey: apiKey });
  if (params.link) qs.set("link", params.link);
  if (params.file) qs.set("file", params.file);
  return `${base}/api/v1/indexer/${indexerId}/download?${qs.toString()}`;
}

function isNzbBuffer(buffer: Buffer, contentType: string): boolean {
  if (buffer.length === 0) return false;
  if (contentType.includes("json")) {
    try {
      const err = JSON.parse(buffer.toString("utf-8")) as { message?: string };
      if (err.message) return false;
    } catch {
      // not a json error payload
    }
  }
  const head = buffer.subarray(0, 256).toString("utf-8").trimStart();
  return head.startsWith("<?xml") || head.includes("<nzb") || contentType.includes("xml");
}

function downloadUrlHasParams(url: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `http://local${url.startsWith("/") ? "" : "/"}${url}`);
    return u.searchParams.has("link") || u.searchParams.has("file");
  } catch {
    return false;
  }
}

function resolveProwlarrDownloadLink(guid: string, downloadUrl: string): string | undefined {
  const { link } = parseDownloadQueryParams(downloadUrl);
  if (link?.trim()) return link.trim();

  if (guid.startsWith("http://") || guid.startsWith("https://")) return guid;

  try {
    if (guid.includes("%")) {
      const decoded = decodeURIComponent(guid);
      if (decoded.startsWith("http://") || decoded.startsWith("https://")) return decoded;
    }
  } catch {
    // ignore
  }

  return undefined;
}

export async function downloadNzb(
  indexer: Indexer,
  guid: string,
  downloadUrl: string,
  indexerId?: number,
): Promise<Buffer> {
  const base = indexer.url.replace(/\/$/, "");
  const headers = { "X-Api-Key": indexer.apiKey };
  const { link: linkFromUrl, file: fileFromUrl } = parseDownloadQueryParams(downloadUrl);
  const effectiveIndexerId = indexerId || parseIndexerIdFromDownloadUrl(downloadUrl);
  const link = resolveProwlarrDownloadLink(guid, downloadUrl) ?? linkFromUrl;

  const candidates: string[] = [];
  const push = (url: string | null | undefined) => {
    if (!url || candidates.includes(url)) return;
    if (url.includes("/download") && !downloadUrlHasParams(url)) return;
    candidates.push(url);
  };

  push(rewriteProwlarrDownloadUrl(base, downloadUrl, indexer.apiKey));

  if (effectiveIndexerId && (link || fileFromUrl)) {
    push(buildIndexerDownloadUrl(base, indexer.apiKey, effectiveIndexerId, {
      link,
      file: fileFromUrl,
    }));
    if (link) {
      push(
        `${base}/${effectiveIndexerId}/download?link=${encodeURIComponent(link)}&apikey=${indexer.apiKey}${fileFromUrl ? `&file=${encodeURIComponent(fileFromUrl)}` : ""}`,
      );
    }
  }

  let lastStatus = 0;
  let lastUrl = "";
  for (const url of candidates) {
    lastUrl = url;
    const response = await fetch(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    lastStatus = response.status;
    if (!response.ok) continue;
    const contentType = response.headers.get("content-type") ?? "";
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!isNzbBuffer(buffer, contentType)) continue;
    return buffer;
  }

  throw new Error(
    `Failed to download NZB: ${lastStatus}${effectiveIndexerId ? "" : " (missing indexerId)"}${lastUrl ? ` — tried ${lastUrl}` : ""}`,
  );
}
