import type { ProwlarrSearchResult } from "./prowlarr";
import { getSetting } from "./db/settings";
import { isDebugEnabled } from "./debug-mode";

export async function isDebugMockExternal(): Promise<boolean> {
  if (!isDebugEnabled()) return false;
  return (await getSetting("debugMockExternal")) === true;
}

export function mockSearchResults(query: string, limit = 20): ProwlarrSearchResult[] {
  const q = query.trim() || "sample";
  const now = Date.now();
  const count = Math.min(Math.max(limit, 1), 25);
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const size = (50 + n * 17) * 1024 * 1024;
    return {
      guid: `debug-mock://${q}/${n}`,
      title: `[DEBUG] ${q} Sample.Release.S01E${String(n).padStart(2, "0")}.1080p.WEB-DL`,
      publishDate: new Date(now - n * 86_400_000).toISOString(),
      size,
      grabs: 10 + n * 3,
      categories: [{ id: 5040, name: "TV/HD" }],
      indexer: "Debug Mock Indexer",
      indexerId: 9000 + n,
      downloadUrl: `https://debug.local/nzb/${encodeURIComponent(q)}-${n}.nzb`,
      description: "Mock result — no external indexer contacted.",
    };
  });
}

export function mockSabJobId(): string {
  return `DEBUG-MOCK-${Date.now().toString(36)}`;
}
