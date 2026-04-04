import { Stock, StockFilters } from "../types";
import { DataProvider } from "./provider";

/**
 * Composite data provider avec fallback automatique.
 *
 * Essaie les providers dans l'ordre. Si le premier echoue ou
 * retourne un resultat vide, passe au suivant.
 *
 * Usage typique : CompositeProvider([yahooProvider, mockProvider])
 * → essaie Yahoo d'abord, fallback sur les donnees locales.
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
    for (const provider of this.providers) {
      try {
        const result = await provider.getStocks(filters);
        if (result.length > 0) return result;
      } catch {
        // Silently fall through to next provider
      }
    }
    return [];
  }

  async getStock(ticker: string): Promise<Stock | undefined> {
    for (const provider of this.providers) {
      try {
        const result = await provider.getStock(ticker);
        if (result) return result;
      } catch {
        // Silently fall through to next provider
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
