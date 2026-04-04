import { US_TICKERS } from "./us";
import { EUROPE_TICKERS } from "./europe";

export { US_TICKERS } from "./us";
export { EUROPE_TICKERS } from "./europe";

/**
 * Full ticker universe — deduplicated merge of all regions.
 */
export const ALL_TICKERS: readonly string[] = [
  ...new Set([...US_TICKERS, ...EUROPE_TICKERS]),
];

export const UNIVERSE_SIZE = ALL_TICKERS.length;

export interface UniverseStats {
  readonly total: number;
  readonly us: number;
  readonly europe: number;
}

export function getUniverseStats(): UniverseStats {
  return {
    total: ALL_TICKERS.length,
    us: US_TICKERS.length,
    europe: EUROPE_TICKERS.length,
  };
}
