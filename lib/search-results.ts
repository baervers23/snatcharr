import type { ProwlarrSearchResult } from "./prowlarr";

/** Strip indexer source names/ids from search payloads for non-admin users. */
export function sanitizeSearchResultForUser(
  result: ProwlarrSearchResult,
  isAdmin: boolean,
): Omit<ProwlarrSearchResult, "indexer" | "indexerId"> & Partial<Pick<ProwlarrSearchResult, "indexer" | "indexerId">> {
  const {
    guid,
    title,
    publishDate,
    size,
    grabs,
    categories,
    downloadUrl,
    commentUrl,
    posterUrl,
    description,
    tvdbId,
    imdbId,
    tmdbId,
    indexer,
    indexerId,
  } = result;

  const base = {
    guid,
    title,
    publishDate,
    size,
    grabs,
    categories,
    downloadUrl,
    commentUrl,
    posterUrl,
    description,
    tvdbId,
    imdbId,
    tmdbId,
  };

  if (isAdmin) {
    return { ...base, indexer, indexerId };
  }

  return base;
}
