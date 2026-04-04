import { Stock, StockFilters } from "../types";
import { DataProvider } from "./provider";
import { updateMeta, buildCachedMeta } from "./metadata";
import { createLogger } from "../logger";

const log = createLogger("cache");

interface CacheEntry<T> {
  readonly data: T;
  readonly cachedAt: number;
  readonly innerSource: string;
}

export interface CacheConfig {
  readonly stocksTTL: number;
  readonly stockTTL: number;
  readonly staleTolerance: number; // serve stale data up to this age (ms)
  readonly maxEntries: number; // evict oldest when exceeded
}

const DEFAULT_CONFIG: CacheConfig = {
  stocksTTL: 60 * 60 * 1000, // 1 hour
  stockTTL: 15 * 60 * 1000, // 15 minutes
  staleTolerance: 4 * 60 * 60 * 1000, // serve stale up to 4 hours
  maxEntries: 200,
};

/**
 * Cache with stale-while-revalidate (SWR) pattern.
 *
 * - Fresh (age < TTL): serve immediately
 * - Stale (TTL < age < staleTolerance): serve immediately + revalidate async
 * - Expired (age > staleTolerance): block on fresh fetch
 */
export class CachedDataProvider implements DataProvider {
  readonly name: string;
  private readonly inner: DataProvider;
  private readonly config: CacheConfig;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly revalidating = new Set<string>();

  private _hits = 0;
  private _misses = 0;
  private _staleHits = 0;

  constructor(inner: DataProvider, config?: Partial<CacheConfig>) {
    this.inner = inner;
    this.name = `cached:${inner.name}`;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get stats() {
    return {
      hits: this._hits,
      misses: this._misses,
      staleHits: this._staleHits,
      entries: this.cache.size,
      hitRate:
        this._hits + this._misses > 0
          ? Math.round((this._hits / (this._hits + this._misses)) * 100)
          : 0,
    };
  }

  private getEntry<T>(
    key: string,
    ttl: number
  ): { data: T; fresh: boolean } | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this._misses++;
      return undefined;
    }

    const age = Date.now() - entry.cachedAt;

    if (age <= ttl) {
      this._hits++;
      updateMeta(buildCachedMeta(entry.innerSource, entry.cachedAt, ttl));
      return { data: entry.data, fresh: true };
    }

    if (age <= this.config.staleTolerance) {
      this._staleHits++;
      updateMeta(buildCachedMeta(entry.innerSource, entry.cachedAt, ttl));
      log.info("serving stale cache", { key, ageMs: age, ttl });
      return { data: entry.data, fresh: false };
    }

    // Too old — evict
    this.cache.delete(key);
    this._misses++;
    return undefined;
  }

  private set<T>(key: string, data: T): void {
    // Evict oldest entries if cache is full (FIFO via Map insertion order)
    while (this.cache.size >= this.config.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
        log.info("cache evicted", { key: oldest, size: this.cache.size });
      } else {
        break;
      }
    }

    // Delete and re-insert to move to end (most recent position)
    this.cache.delete(key);
    this.cache.set(key, {
      data,
      cachedAt: Date.now(),
      innerSource: this.inner.name,
    });
  }

  private revalidateAsync<T>(
    key: string,
    fetcher: () => Promise<T>
  ): void {
    if (this.revalidating.has(key)) return;
    this.revalidating.add(key);

    fetcher()
      .then((result) => {
        if (result !== undefined) {
          this.set(key, result);
          log.info("cache revalidated", { key });
        }
      })
      .catch(() => {
        log.warn("cache revalidation failed", { key });
      })
      .finally(() => {
        this.revalidating.delete(key);
      });
  }

  async getStocks(filters?: StockFilters): Promise<readonly Stock[]> {
    const key = `stocks:${JSON.stringify(filters ?? {})}`;
    const cached = this.getEntry<readonly Stock[]>(key, this.config.stocksTTL);

    if (cached) {
      if (!cached.fresh) {
        this.revalidateAsync(key, () => this.inner.getStocks(filters));
      }
      return cached.data;
    }

    const result = await this.inner.getStocks(filters);
    this.set(key, result);
    return result;
  }

  async getStock(ticker: string): Promise<Stock | undefined> {
    const key = `stock:${ticker.toLowerCase()}`;
    const cached = this.getEntry<Stock | undefined>(key, this.config.stockTTL);

    if (cached && cached.data !== undefined) {
      if (!cached.fresh) {
        this.revalidateAsync(key, () => this.inner.getStock(ticker));
      }
      return cached.data;
    }

    const result = await this.inner.getStock(ticker);
    if (result) this.set(key, result);
    return result;
  }

  async getSectors(): Promise<readonly string[]> {
    const key = "sectors";
    const cached = this.getEntry<readonly string[]>(key, this.config.stocksTTL);
    if (cached) return cached.data;

    const result = await this.inner.getSectors();
    this.set(key, result);
    return result;
  }

  async getCountries(): Promise<readonly string[]> {
    const key = "countries";
    const cached = this.getEntry<readonly string[]>(key, this.config.stocksTTL);
    if (cached) return cached.data;

    const result = await this.inner.getCountries();
    this.set(key, result);
    return result;
  }

  clearCache(): void {
    this.cache.clear();
    this._hits = 0;
    this._misses = 0;
    this._staleHits = 0;
  }
}
