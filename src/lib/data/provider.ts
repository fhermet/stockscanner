import { Stock, StockFilters } from "../types";

/**
 * Interface abstraite pour l'acces aux donnees financieres.
 *
 * Chaque implementation (mock, FMP, Yahoo, etc.) doit
 * respecter ce contrat. Le reste de l'application ne
 * depend que de cette interface.
 */
export interface DataProvider {
  /**
   * Recupere toutes les actions, avec filtres optionnels.
   */
  getStocks(filters?: StockFilters): Promise<readonly Stock[]>;

  /**
   * Recupere une action par son ticker.
   * Retourne undefined si non trouvee.
   */
  getStock(ticker: string): Promise<Stock | undefined>;

  /**
   * Retourne les secteurs disponibles.
   */
  getSectors(): Promise<readonly string[]>;

  /**
   * Retourne les pays disponibles.
   */
  getCountries(): Promise<readonly string[]>;

  /**
   * Nom du provider (pour debug/logging).
   */
  readonly name: string;
}
