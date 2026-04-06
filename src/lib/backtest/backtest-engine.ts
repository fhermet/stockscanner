/**
 * Mini-backtesting engine.
 *
 * Simulates "if you had followed strategy X in year Y, buying the top N
 * stocks, what would your return have been vs the S&P 500?"
 *
 * Approach:
 * 1. Read all SEC JSON files (local, fast)
 * 2. Compute SEC-only scores for the start year (fundamental ranking)
 * 3. Rank by strategy, pick top N
 * 4. Fetch Yahoo yearly prices for those N tickers + ^GSPC (S&P 500)
 * 5. Compute equal-weighted portfolio return from startYear to latest
 */

import type { StrategyId } from "@/lib/types";
import type { SecAnnual, SecTickerData } from "@/lib/types/sec-fundamentals";
import { getAvailableTickers, getSecHistory } from "@/lib/data/sec-history-provider";
import { getYearlyPrices, type YearlyPrice } from "@/lib/data/yahoo-history-provider";
import { computeHistoricalScores } from "@/lib/scoring/sec-historical-score";

// --- Types ---

export interface BacktestStock {
  readonly ticker: string;
  readonly companyName: string;
  readonly scoreAtStart: number;
  readonly priceAtStart: number;
  readonly priceAtEnd: number;
  readonly returnPct: number;
}

export interface BacktestResult {
  readonly strategyId: StrategyId;
  readonly strategyLabel: string;
  readonly startYear: number;
  readonly endYear: number;
  readonly topN: number;
  readonly stocks: readonly BacktestStock[];
  readonly portfolioReturnPct: number;
  readonly benchmarkReturnPct: number | null;
  readonly outperformance: number | null;
  readonly summary: string;
  readonly disclaimer: string;
}

// --- Cache for all-ticker ranking (expensive to compute) ---

interface RankingCacheEntry {
  readonly data: ReadonlyMap<number, readonly RankedTicker[]>;
  readonly computedAt: number;
}

interface RankedTicker {
  readonly ticker: string;
  readonly companyName: string;
  readonly scores: ReadonlyMap<StrategyId, number>;
}

const RANKING_CACHE_TTL = 60 * 60 * 1000; // 1 hour
let rankingCache: Map<string, RankingCacheEntry> = new Map();

const STRATEGY_LABELS: Record<StrategyId, string> = {
  buffett: "Warren Buffett",
  lynch: "Peter Lynch",
  growth: "Growth",
  dividend: "Dividende",
};

// --- Core engine ---

/**
 * Build a ranking of all tickers by strategy for each available year.
 * Uses SEC-only scores (no market prices) for fundamental ranking.
 * Cached for 1 hour.
 */
async function getRankingsByYear(): Promise<ReadonlyMap<number, readonly RankedTicker[]>> {
  const cacheKey = "all";
  const cached = rankingCache.get(cacheKey);
  if (cached && Date.now() - cached.computedAt < RANKING_CACHE_TTL) {
    return cached.data;
  }

  const allTickers = await getAvailableTickers();
  const byYear = new Map<number, RankedTicker[]>();

  for (const ticker of allTickers) {
    const secData = await getSecHistory(ticker);
    if (!secData || secData.annuals.length === 0) continue;

    const points = computeHistoricalScores(secData);

    for (const point of points) {
      const scoresMap = new Map<StrategyId, number>();
      for (const s of point.scores) {
        scoresMap.set(s.strategyId, s.total);
      }

      const entry: RankedTicker = {
        ticker: secData.ticker,
        companyName: secData.company_name,
        scores: scoresMap,
      };

      const yearList = byYear.get(point.fiscalYear);
      if (yearList) {
        yearList.push(entry);
      } else {
        byYear.set(point.fiscalYear, [entry]);
      }
    }
  }

  rankingCache.set(cacheKey, { data: byYear, computedAt: Date.now() });
  return byYear;
}

/**
 * Get the top N tickers for a strategy in a given year.
 */
async function getTopTickers(
  strategyId: StrategyId,
  year: number,
  topN: number,
): Promise<readonly RankedTicker[]> {
  const byYear = await getRankingsByYear();
  const yearData = byYear.get(year);
  if (!yearData) return [];

  return [...yearData]
    .filter((t) => (t.scores.get(strategyId) ?? 0) > 0)
    .sort((a, b) => (b.scores.get(strategyId) ?? 0) - (a.scores.get(strategyId) ?? 0))
    .slice(0, topN);
}

/**
 * Run a backtest simulation.
 */
export async function runBacktest(
  strategyId: StrategyId,
  startYear: number,
  topN: number = 5,
): Promise<BacktestResult> {
  const topTickers = await getTopTickers(strategyId, startYear, topN);

  if (topTickers.length === 0) {
    return emptyResult(strategyId, startYear, topN, "Aucune donnée disponible pour cette année.");
  }

  // Fetch prices for winners + benchmark in parallel
  const pricePromises = topTickers.map((t) => getYearlyPrices(t.ticker));
  const benchmarkPromise = getYearlyPrices("^GSPC");
  const [tickerPrices, benchmarkPrices] = await Promise.all([
    Promise.all(pricePromises),
    benchmarkPromise,
  ]);

  // Find the latest common year
  const allEndYears = tickerPrices
    .map((prices) => prices.length > 0 ? prices[prices.length - 1].year : 0)
    .filter((y) => y > startYear);

  if (allEndYears.length === 0) {
    return emptyResult(strategyId, startYear, topN, "Prix historiques indisponibles pour les actions sélectionnées.");
  }

  const endYear = Math.min(...allEndYears);

  // Build stock results
  const stocks: BacktestStock[] = [];
  for (let i = 0; i < topTickers.length; i++) {
    const t = topTickers[i];
    const prices = tickerPrices[i];
    const startPrice = findPrice(prices, startYear);
    const endPrice = findPrice(prices, endYear);

    if (startPrice === null || endPrice === null) continue;

    const returnPct = round2((endPrice / startPrice - 1) * 100);

    stocks.push({
      ticker: t.ticker,
      companyName: t.companyName,
      scoreAtStart: t.scores.get(strategyId) ?? 0,
      priceAtStart: startPrice,
      priceAtEnd: endPrice,
      returnPct,
    });
  }

  if (stocks.length === 0) {
    return emptyResult(strategyId, startYear, topN, "Impossible de calculer les rendements (prix manquants).");
  }

  // Portfolio return (equal-weighted)
  const portfolioReturnPct = round2(
    stocks.reduce((acc, s) => acc + s.returnPct, 0) / stocks.length,
  );

  // Benchmark return
  const benchStart = findPrice(benchmarkPrices, startYear);
  const benchEnd = findPrice(benchmarkPrices, endYear);
  const benchmarkReturnPct =
    benchStart !== null && benchEnd !== null
      ? round2((benchEnd / benchStart - 1) * 100)
      : null;

  const outperformance =
    benchmarkReturnPct !== null
      ? round2(portfolioReturnPct - benchmarkReturnPct)
      : null;

  const summary = buildSummary(
    strategyId,
    startYear,
    endYear,
    stocks,
    portfolioReturnPct,
    benchmarkReturnPct,
    outperformance,
  );

  return {
    strategyId,
    strategyLabel: STRATEGY_LABELS[strategyId],
    startYear,
    endYear,
    topN,
    stocks: stocks.sort((a, b) => b.returnPct - a.returnPct),
    portfolioReturnPct,
    benchmarkReturnPct,
    outperformance,
    summary,
    disclaimer:
      "Simulation basée sur des données historiques. Les performances passées ne préjugent pas des performances futures. " +
      "Le classement utilise les scores fondamentaux SEC (sans données de marché). Les rendements sont calculés sur les prix Yahoo Finance, " +
      "sans tenir compte des dividendes réinvestis, des frais de transaction ni de la fiscalité.",
  };
}

// --- Helpers ---

function findPrice(
  prices: readonly YearlyPrice[],
  year: number,
): number | null {
  const match = prices.find((p) => p.year === year);
  return match?.close ?? null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildSummary(
  strategyId: StrategyId,
  startYear: number,
  endYear: number,
  stocks: readonly BacktestStock[],
  portfolioReturnPct: number,
  benchmarkReturnPct: number | null,
  outperformance: number | null,
): string {
  const label = STRATEGY_LABELS[strategyId];
  const years = endYear - startYear;
  const tickerList = stocks.map((s) => s.ticker).join(", ");

  let text = `Si vous aviez suivi la stratégie ${label} en ${startYear} en achetant les ${stocks.length} actions les mieux classées (${tickerList}), votre portefeuille aurait `;

  if (portfolioReturnPct >= 0) {
    text += `progressé de +${portfolioReturnPct}%`;
  } else {
    text += `reculé de ${portfolioReturnPct}%`;
  }

  text += ` sur ${years} an${years > 1 ? "s" : ""}`;

  if (benchmarkReturnPct !== null) {
    text += ` contre ${benchmarkReturnPct >= 0 ? "+" : ""}${benchmarkReturnPct}% pour le S&P 500`;

    if (outperformance !== null) {
      if (outperformance > 0) {
        text += ` (surperformance de +${outperformance} points)`;
      } else if (outperformance < 0) {
        text += ` (sous-performance de ${outperformance} points)`;
      } else {
        text += ` (performance identique)`;
      }
    }
  }

  text += ".";
  return text;
}

function emptyResult(
  strategyId: StrategyId,
  startYear: number,
  topN: number,
  message: string,
): BacktestResult {
  return {
    strategyId,
    strategyLabel: STRATEGY_LABELS[strategyId],
    startYear,
    endYear: startYear,
    topN,
    stocks: [],
    portfolioReturnPct: 0,
    benchmarkReturnPct: null,
    outperformance: null,
    summary: message,
    disclaimer: "",
  };
}

/** Available start years for backtesting. */
export async function getAvailableYears(): Promise<readonly number[]> {
  const byYear = await getRankingsByYear();
  const currentYear = new Date().getFullYear();
  return [...byYear.keys()]
    .filter((y) => y >= 2010 && y <= currentYear - 2)
    .sort((a, b) => a - b);
}

export function resetBacktestCache(): void {
  rankingCache = new Map();
}
