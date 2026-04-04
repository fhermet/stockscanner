import { Stock, StockFilters } from "../types";
import { DataProvider } from "./provider";
import { updateMeta, buildFreshMeta } from "./metadata";
import { createLogger } from "../logger";

const log = createLogger("composite");

/**
 * Composite data provider avec fallback automatique et metadata tracking.
 */
export class CompositeDataProvider implements DataProvider {
  readonly name: string;
  private readonly providers: readonly DataProvider[];

  constructor(providers: readonly DataProvider[]) {
    if (providers.length === 0) {
      throw new Error("CompositeDataProvider requires at least one provider");
    }
    this.providers = providers;
    this.name = `composite:[${providers.map((p) => p.name).join(">")}]`;
  }

  async getStocks(filters?: StockFilters): Promise<readonly Stock[]> {
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      try {
        const result = await provider.getStocks(filters);
        if (result.length > 0) {
          if (i > 0) log.warn("fallback used for getStocks", { provider: provider.name, index: i });
          updateMeta(buildFreshMeta(provider.name, i > 0));
          return result;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "unknown";
        log.error("provider failed on getStocks", { provider: provider.name, error: msg });
      }
    }
    return [];
  }

  async getStock(ticker: string): Promise<Stock | undefined> {
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      try {
        const result = await provider.getStock(ticker);
        if (result) {
          if (i > 0) log.warn("fallback used for getStock", { provider: provider.name, ticker });
          updateMeta(buildFreshMeta(provider.name, i > 0));
          return result;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "unknown";
        log.error("provider failed on getStock", { provider: provider.name, ticker, error: msg });
      }
    }
    return undefined;
  }

  async getSectors(): Promise<readonly string[]> {
    for (const provider of this.providers) {
      try {
        const result = await provider.getSectors();
        if (result.length > 0) return result;
      } catch {
        // Fall through
      }
    }
    return [];
  }

  async getCountries(): Promise<readonly string[]> {
    for (const provider of this.providers) {
      try {
        const result = await provider.getCountries();
        if (result.length > 0) return result;
      } catch {
        // Fall through
      }
    }
    return [];
  }
}
