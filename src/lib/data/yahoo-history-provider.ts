/**
 * Yahoo Finance historical price provider.
 *
 * Fetches monthly price data via yahoo-finance2 chart() method.
 * Extracts one price per fiscal year (last available close of the year).
 * Server-side only — never call from the frontend.
 */

import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
});

export interface YearlyPrice {
  readonly year: number;
  readonly close: number;
  readonly date: string; // ISO date of the price point used
}

interface CacheEntry {
  readonly data: readonly YearlyPrice[];
  readonly fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map<string, CacheEntry>();

/**
 * Fetch monthly prices for a ticker and extract one close price per year.
 * Uses the last available monthly close for each calendar year.
 */
export async function getYearlyPrices(
  ticker: string,
  yearsBack = 16,
): Promise<readonly YearlyPrice[]> {
  const key = ticker.toUpperCase();

  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - yearsBack);

    const result = await yf.chart(key, {
      period1: startDate,
      period2: endDate,
      interval: "1mo",
    });

    if (!result?.quotes || result.quotes.length === 0) {
      return [];
    }

    // Group by year, take the last available close per year
    const byYear = new Map<number, { close: number; date: Date }>();

    for (const quote of result.quotes) {
      if (quote.close === null || quote.close === undefined) continue;
      const d = new Date(quote.date);
      const year = d.getFullYear();
      const existing = byYear.get(year);
      if (!existing || d > existing.date) {
        byYear.set(year, { close: quote.close, date: d });
      }
    }

    const prices: YearlyPrice[] = [];
    for (const [year, { close, date }] of [...byYear.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      prices.push({
        year,
        close: Math.round(close * 100) / 100,
        date: date.toISOString().split("T")[0],
      });
    }

    cache.set(key, { data: prices, fetchedAt: Date.now() });
    return prices;
  } catch {
    return [];
  }
}

/** Reset cache (used in tests). */
export function resetYahooHistoryCache(): void {
  cache.clear();
}
