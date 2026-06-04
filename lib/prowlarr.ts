import type { Indexer } from "./db/schema";

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

export async function searchProwlarr(
  indexer: Indexer,
  query: string,
  categories: number[] = [],
  limit = 100,
): Promise<ProwlarrSearchResult[]> {
  const baseUrl = indexer.prowlarrUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    apikey: indexer.apiKey,
    Query: query,
    limit: String(limit),
    offset: "0",
  });

  if (categories.length > 0) {
    categories.forEach((c) => params.append("categories", String(c)));
  }

  const url = `${baseUrl}/api/v1/search?${params.toString()}`;

  const response = await fetch(url, {
    headers: { "X-Api-Key": indexer.apiKey },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Prowlarr search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ProwlarrSearchResult[];
  return data;
}

export async function getProwlarrIndexers(
  baseUrl: string,
  apiKey: string,
): Promise<ProwlarrIndexerStatus[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/indexer`;
  const response = await fetch(url, {
    headers: { "X-Api-Key": apiKey },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Prowlarr indexers: ${response.status}`);
  }

  return response.json() as Promise<ProwlarrIndexerStatus[]>;
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

export async function downloadNzb(
  indexer: Indexer,
  guid: string,
  downloadUrl: string,
): Promise<Buffer> {
  const url = downloadUrl.includes("?")
    ? `${downloadUrl}&apikey=${indexer.apiKey}`
    : `${downloadUrl}?apikey=${indexer.apiKey}`;

  const response = await fetch(url, {
    headers: { "X-Api-Key": indexer.apiKey },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Failed to download NZB: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}
