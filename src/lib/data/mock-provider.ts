import { Stock, StockFilters } from "../types";
import { DataProvider } from "./provider";
import { STOCKS, getAvailableSectors, getAvailableCountries } from "../mock-data";

/**
 * Implementation mock du DataProvider.
 * Utilise les donnees statiques de mock-data.ts.
 */
export class MockDataProvider implements DataProvider {
  readonly name = "mock";

  async getStocks(filters?: StockFilters): Promise<readonly Stock[]> {
    let result = [...STOCKS];

    if (filters?.sector) {
      result = result.filter((s) => s.sector === filters.sector);
    }
    if (filters?.country) {
      result = result.filter((s) => s.country === filters.country);
    }
    if (filters?.marketCapMin !== undefined) {
      result = result.filter((s) => s.marketCap >= filters.marketCapMin!);
    }
    if (filters?.marketCapMax !== undefined) {
      result = result.filter((s) => s.marketCap <= filters.marketCapMax!);
    }

    return result;
  }

  async getStock(ticker: string): Promise<Stock | undefined> {
    return STOCKS.find(
      (s) => s.ticker.toLowerCase() === ticker.toLowerCase()
    );
  }

  async getSectors(): Promise<readonly string[]> {
    return getAvailableSectors();
  }

  async getCountries(): Promise<readonly string[]> {
    return getAvailableCountries();
  }
}
