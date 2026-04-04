import { DataMeta } from "../types";

/**
 * Tracks metadata about the last data fetch.
 *
 * This is a side-channel: it doesn't change the DataProvider interface.
 * The cache and composite providers update it, and the API routes read it
 * to include transparency info in responses.
 */

let lastMeta: DataMeta = {
  source: "unknown",
  fetchedAt: 0,
  isFallback: false,
  isCached: false,
  cacheAgeMs: 0,
  isStale: false,
};

export function updateMeta(partial: Partial<DataMeta>): void {
  lastMeta = { ...lastMeta, ...partial };
}

export function getMeta(): DataMeta {
  return { ...lastMeta };
}

export function buildFreshMeta(source: string, isFallback: boolean): DataMeta {
  return {
    source,
    fetchedAt: Date.now(),
    isFallback,
    isCached: false,
    cacheAgeMs: 0,
    isStale: false,
  };
}

export function buildCachedMeta(
  innerSource: string,
  cachedAt: number,
  ttl: number
): DataMeta {
  const age = Date.now() - cachedAt;
  return {
    source: `cache:${innerSource}`,
    fetchedAt: cachedAt,
    isFallback: false,
    isCached: true,
    cacheAgeMs: age,
    isStale: age > ttl,
  };
}
