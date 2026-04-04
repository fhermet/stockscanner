import { Stock, StockFilters } from "../types";
import { DataProvider } from "./provider";
import { updateMeta, buildCachedMeta } from "./metadata";

interface CacheEntry<T> {
  readonly data: T;
  readonly cachedAt: number;
  readonly innerSource: string;
}

export interface CacheConfig {
  readonly stocksTTL: number;
  readonly stockTTL: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  stocksTTL: 60 * 60 * 1000, // 1 hour
  stockTTL: 15 * 60 * 1000, // 15 minutes
};

export class CachedDataProvider implements DataProvider {
  readonly name: string;
  private readonly inner: DataProvider;
  private readonly config: CacheConfig;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  // Observable stats
  private _hits = 0;
  private _misses = 0;

  constructor(inner: DataProvider, config?: Partial<CacheConfig>) {
    this.inner = inner;
    this.name = `cached:${inner.name}`;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get stats() {
    return {
      hits: this._hits,
      misses: this._misses,
      entries: this.cache.size,
      hitRate: this._hits + this._misses > 0
        ? Math.round((this._hits / (this._hits + this._misses)) * 100)
        : 0,
    };
  }

  private get<T>(key: string, ttl: number): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this._misses++;
      return undefined;
    }
    this._hits++;
    updateMeta(buildCachedMeta(entry.innerSource, entry.cachedAt, ttl));
    return entry.data;
  }

  private set<T>(key: string, data: T): void {
    // Extract inner source name from composite provider name
    const innerSource = this.inner.name.includes("composite")
      ? this.inner.name
      : this.inner.name;

    this.cache.set(key, {
      data,
      cachedAt: Date.now(),
      innerSource,
    });
  }

  async getStocks(filters?: StockFilters): Promise<readonly Stock[]> {
    const key = `stocks:${JSON.stringify(filters ?? {})}`;
    const cached = this.get<readonly Stock[]>(key, this.config.stocksTTL);
    if (cached) return cached;

    const result = await this.inner.getStocks(filters);
    this.set(key, result);
    return result;
  }

  async getStock(ticker: string): Promise<Stock | undefined> {
    const key = `stock:${ticker.toLowerCase()}`;
    const cached = this.get<Stock | undefined>(key, this.config.stockTTL);
    if (cached !== undefined) return cached;

    const result = await this.inner.getStock(ticker);
    if (result) {
      this.set(key, result);
    }
    return result;
  }

  async getSectors(): Promise<readonly string[]> {
    const key = "sectors";
    const cached = this.get<readonly string[]>(key, this.config.stocksTTL);
    if (cached) return cached;

    const result = await this.inner.getSectors();
    this.set(key, result);
    return result;
  }

  async getCountries(): Promise<readonly string[]> {
    const key = "countries";
    const cached = this.get<readonly string[]>(key, this.config.stocksTTL);
    if (cached) return cached;

    const result = await this.inner.getCountries();
    this.set(key, result);
    return result;
  }

  clearCache(): void {
    this.cache.clear();
    this._hits = 0;
    this._misses = 0;
  }
}
