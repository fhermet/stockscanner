import { Stock, StockFilters } from "../types";
import { DataProvider } from "./provider";

interface CacheEntry<T> {
  readonly data: T;
  readonly expiresAt: number;
}

/**
 * Cache decorator pour un DataProvider.
 *
 * Wrap un provider existant et met en cache les resultats
 * avec un TTL configurable.
 *
 * Usage :
 *   const provider = new CachedDataProvider(new FMPDataProvider(key), {
 *     stocksTTL: 60 * 60 * 1000,    // 1h
 *     stockTTL: 15 * 60 * 1000,     // 15min
 *   });
 */
export interface CacheConfig {
  readonly stocksTTL: number; // TTL pour getStocks (ms)
  readonly stockTTL: number; // TTL pour getStock (ms)
}

const DEFAULT_CONFIG: CacheConfig = {
  stocksTTL: 60 * 60 * 1000, // 1 heure
  stockTTL: 15 * 60 * 1000, // 15 minutes
};

export class CachedDataProvider implements DataProvider {
  readonly name: string;
  private readonly inner: DataProvider;
  private readonly config: CacheConfig;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(inner: DataProvider, config?: Partial<CacheConfig>) {
    this.inner = inner;
    this.name = `cached:${inner.name}`;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  private set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttl });
  }

  async getStocks(filters?: StockFilters): Promise<readonly Stock[]> {
    const key = `stocks:${JSON.stringify(filters ?? {})}`;
    const cached = this.get<readonly Stock[]>(key);
    if (cached) return cached;

    const result = await this.inner.getStocks(filters);
    this.set(key, result, this.config.stocksTTL);
    return result;
  }

  async getStock(ticker: string): Promise<Stock | undefined> {
    const key = `stock:${ticker.toLowerCase()}`;
    const cached = this.get<Stock | undefined>(key);
    if (cached !== undefined) return cached;

    const result = await this.inner.getStock(ticker);
    if (result) {
      this.set(key, result, this.config.stockTTL);
    }
    return result;
  }

  async getSectors(): Promise<readonly string[]> {
    const key = "sectors";
    const cached = this.get<readonly string[]>(key);
    if (cached) return cached;

    const result = await this.inner.getSectors();
    this.set(key, result, this.config.stocksTTL);
    return result;
  }

  async getCountries(): Promise<readonly string[]> {
    const key = "countries";
    const cached = this.get<readonly string[]>(key);
    if (cached) return cached;

    const result = await this.inner.getCountries();
    this.set(key, result, this.config.stocksTTL);
    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
