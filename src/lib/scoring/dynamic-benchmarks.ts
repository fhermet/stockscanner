/**
 * Calcul dynamique des benchmarks sectoriels.
 *
 * Au lieu de medianes hardcodees, on calcule les medianes reelles
 * a partir de l'univers de stocks charge (S&P 500/400/600).
 *
 * Chaque secteur doit avoir au moins MIN_STOCKS_PER_SECTOR actions
 * pour produire un benchmark fiable. En dessous, on fallback sur
 * les benchmarks statiques.
 */

import type { Stock } from "../types";
import type { SectorBenchmark } from "./sector-benchmarks";

/** Minimum stocks in a sector to compute a dynamic benchmark */
export const MIN_STOCKS_PER_SECTOR = 5;

type MetricExtractor = (stock: Stock) => number | null | undefined;

const METRIC_EXTRACTORS: Record<keyof SectorBenchmark, MetricExtractor> = {
  operatingMargin: (s) => s.operatingMargin,
  revenueGrowth: (s) => s.revenueGrowth,
  epsGrowth: (s) => s.epsGrowth,
  per: (s) => s.per,
  dividendYield: (s) => s.dividendYield,
  evToEbit: (s) => s.evToEbit,
  priceToFcf: (s) => {
    if (s.freeCashFlow != null && s.freeCashFlow > 0 && s.marketCap > 0) {
      return s.marketCap / s.freeCashFlow;
    }
    return null;
  },
};

/**
 * Compute the median of a numeric array.
 * Returns null if the array is empty.
 */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Compute dynamic sector benchmarks from the actual stock universe.
 *
 * Returns a map of sector → SectorBenchmark with medians computed
 * from real data. Only sectors with >= MIN_STOCKS_PER_SECTOR stocks
 * are included; missing sectors will fallback to static benchmarks
 * at read time.
 */
export function computeDynamicBenchmarks(
  stocks: readonly Stock[],
): Record<string, SectorBenchmark> {
  // Group stocks by sector
  const bySector = new Map<string, Stock[]>();
  for (const stock of stocks) {
    const sector = stock.sector;
    if (!sector) continue;
    const list = bySector.get(sector);
    if (list) {
      list.push(stock);
    } else {
      bySector.set(sector, [stock]);
    }
  }

  const result: Record<string, SectorBenchmark> = {};

  for (const [sector, sectorStocks] of bySector) {
    if (sectorStocks.length < MIN_STOCKS_PER_SECTOR) continue;

    const benchmark = {} as Record<keyof SectorBenchmark, number>;
    let allMetricsComputed = true;

    for (const [metricKey, extractor] of Object.entries(METRIC_EXTRACTORS) as [keyof SectorBenchmark, MetricExtractor][]) {
      const values: number[] = [];
      for (const stock of sectorStocks) {
        const v = extractor(stock);
        if (v != null && isFinite(v)) {
          values.push(v);
        }
      }

      const med = median(values);
      if (med !== null) {
        benchmark[metricKey] = Math.round(med * 100) / 100;
      } else {
        allMetricsComputed = false;
        break;
      }
    }

    if (allMetricsComputed) {
      result[sector] = benchmark as SectorBenchmark;
    }
  }

  return result;
}
