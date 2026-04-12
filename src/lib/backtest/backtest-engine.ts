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
 * 4. Fetch Yahoo yearly prices for those N tickers + ^SP500TR (S&P 500 Total Return)
 * 5. Compute equal-weighted total return (price + dividends) from startYear to latest
 *
 * Total return: dividends per share are extracted from SEC data
 * (dividends_paid / shares_outstanding) and added to the price return.
 * Benchmark uses ^SP500TR (S&P 500 Total Return index, dividends reinvested).
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

/** S&P 500 Total Return index (dividends reinvested) */
const BENCHMARK_TICKER = "^SP500TR";

// --- Dividend helpers ---

/**
 * Extract cumulative dividends per share from SEC data for a range of years.
 * Returns the sum of DPS for each fiscal year in [startYear, endYear).
 * DPS = |dividends_paid| / shares_outstanding.
 */
export function getCumulativeDps(
  secData: SecTickerData | null,
  startYear: number,
  endYear: number,
): number {
  if (!secData) return 0;
  let total = 0;
  for (const annual of secData.annuals) {
    if (annual.fiscal_year >= startYear && annual.fiscal_year < endYear) {
      const divPaid = annual.fundamentals.dividends_paid;
      const shares = annual.fundamentals.shares_outstanding;
      if (divPaid != null && shares != null && shares > 0) {
        // dividends_paid is typically negative in SEC filings (cash outflow)
        total += Math.abs(divPaid) / shares;
      }
    }
  }
  return total;
}

/**
 * Get DPS for a single fiscal year from SEC data.
 */
function getAnnualDps(secData: SecTickerData | null, year: number): number {
  return getCumulativeDps(secData, year, year + 1);
}

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

  // Fetch prices + SEC data for winners + benchmark in parallel
  const pricePromises = topTickers.map((t) => getYearlyPrices(t.ticker));
  const secPromises = topTickers.map((t) => getSecHistory(t.ticker));
  const benchmarkPromise = getYearlyPrices(BENCHMARK_TICKER);
  const [tickerPrices, tickerSecData, benchmarkPrices] = await Promise.all([
    Promise.all(pricePromises),
    Promise.all(secPromises),
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

  // Build stock results (total return = price return + dividends)
  const stocks: BacktestStock[] = [];
  for (let i = 0; i < topTickers.length; i++) {
    const t = topTickers[i];
    const prices = tickerPrices[i];
    const secData = tickerSecData[i];
    const startPrice = findPrice(prices, startYear);
    const endPrice = findPrice(prices, endYear);

    if (startPrice === null || endPrice === null || startPrice === 0) continue;

    // Total return: price appreciation + cumulative dividends per share
    const cumDps = getCumulativeDps(secData, startYear, endYear);
    const returnPct = round2(((endPrice + cumDps) / startPrice - 1) * 100);

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
      "Le classement utilise les scores fondamentaux SEC (sans données de marché). Les rendements incluent les dividendes (total return). " +
      "Le benchmark est le S&P 500 Total Return (dividendes réinvestis). Sans frais de transaction ni fiscalité.",
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

// ============================================================
// Rolling backtest with annual rebalancing
// ============================================================

export interface AnnualHolding {
  readonly ticker: string;
  readonly companyName: string;
  readonly score: number;
  readonly returnPct: number;
}

export interface AnnualSlice {
  readonly year: number;
  readonly holdings: readonly AnnualHolding[];
  readonly portfolioReturnPct: number;
  readonly benchmarkReturnPct: number | null;
  readonly turnover: number; // 0-1, fraction of positions changed vs previous year
}

export interface RiskMetrics {
  readonly cagr: number;
  readonly benchmarkCagr: number | null;
  readonly volatility: number;
  readonly sharpeRatio: number | null;
  readonly maxDrawdown: number;
  readonly winRate: number; // fraction of years beating benchmark
  readonly bestYear: { readonly year: number; readonly returnPct: number };
  readonly worstYear: { readonly year: number; readonly returnPct: number };
}

export interface RollingBacktestResult {
  readonly strategyId: StrategyId;
  readonly strategyLabel: string;
  readonly startYear: number;
  readonly endYear: number;
  readonly topN: number;
  readonly slices: readonly AnnualSlice[];
  readonly cumulativeReturnPct: number;
  readonly cumulativeBenchmarkPct: number | null;
  readonly outperformance: number | null;
  readonly risk: RiskMetrics;
  readonly summary: string;
  readonly disclaimer: string;
}

/**
 * Compute risk metrics from a series of annual slices.
 * Exported for testing.
 */
export function computeRiskMetrics(slices: readonly AnnualSlice[]): RiskMetrics {
  const returns = slices.map((s) => s.portfolioReturnPct);
  const benchReturns = slices
    .map((s) => s.benchmarkReturnPct)
    .filter((r): r is number => r !== null);

  // CAGR: compound annual growth rate
  const years = returns.length;
  let cumulative = 1;
  for (const r of returns) cumulative *= 1 + r / 100;
  const cagr = years > 0 ? (Math.pow(cumulative, 1 / years) - 1) * 100 : 0;

  // Benchmark CAGR
  let benchmarkCagr: number | null = null;
  if (benchReturns.length > 0) {
    let benchCum = 1;
    for (const r of benchReturns) benchCum *= 1 + r / 100;
    benchmarkCagr = (Math.pow(benchCum, 1 / benchReturns.length) - 1) * 100;
  }

  // Volatility: std dev of annual returns
  const mean = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 1
    ? returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (returns.length - 1)
    : 0;
  const volatility = Math.sqrt(variance);

  // Sharpe ratio (risk-free ≈ 0 for simplicity)
  const sharpeRatio = volatility > 0 ? cagr / volatility : null;

  // Max drawdown from cumulative equity curve
  let peak = 1;
  let maxDrawdown = 0;
  let equity = 1;
  for (const r of returns) {
    equity *= 1 + r / 100;
    if (equity > peak) peak = equity;
    const drawdown = ((peak - equity) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Win rate vs benchmark
  const comparableSlices = slices.filter((s) => s.benchmarkReturnPct !== null);
  const wins = comparableSlices.filter(
    (s) => s.portfolioReturnPct > s.benchmarkReturnPct!,
  ).length;
  const winRate = comparableSlices.length > 0 ? wins / comparableSlices.length : 0;

  // Best / worst year
  let bestYear = { year: 0, returnPct: -Infinity };
  let worstYear = { year: 0, returnPct: Infinity };
  for (const s of slices) {
    if (s.portfolioReturnPct > bestYear.returnPct) {
      bestYear = { year: s.year, returnPct: s.portfolioReturnPct };
    }
    if (s.portfolioReturnPct < worstYear.returnPct) {
      worstYear = { year: s.year, returnPct: s.portfolioReturnPct };
    }
  }
  if (bestYear.year === 0) bestYear = { year: 0, returnPct: 0 };
  if (worstYear.year === 0) worstYear = { year: 0, returnPct: 0 };

  return {
    cagr: round2(cagr),
    benchmarkCagr: benchmarkCagr !== null ? round2(benchmarkCagr) : null,
    volatility: round2(volatility),
    sharpeRatio: sharpeRatio !== null ? round2(sharpeRatio) : null,
    maxDrawdown: round2(maxDrawdown),
    winRate: round2(winRate * 100),
    bestYear: { year: bestYear.year, returnPct: round2(bestYear.returnPct) },
    worstYear: { year: worstYear.year, returnPct: round2(worstYear.returnPct) },
  };
}

/**
 * Compute turnover between two sets of tickers.
 * Returns a fraction 0-1: how many positions changed.
 */
function computeTurnover(
  prev: readonly string[],
  curr: readonly string[],
): number {
  if (prev.length === 0) return 0;
  const prevSet = new Set(prev);
  const kept = curr.filter((t) => prevSet.has(t)).length;
  const maxLen = Math.max(prev.length, curr.length);
  return maxLen > 0 ? round2((maxLen - kept) / maxLen) : 0;
}

/**
 * Run a rolling backtest with annual rebalancing.
 *
 * Each year, the portfolio is re-scored and rebalanced to the top N stocks.
 * Returns are compounded year over year.
 */
export async function runRollingBacktest(
  strategyId: StrategyId,
  topN: number = 5,
): Promise<RollingBacktestResult> {
  const availableYears = await getAvailableYears();
  if (availableYears.length < 2) {
    return emptyRollingResult(strategyId, 0, 0, topN, "Pas assez d'années disponibles pour un backtest rolling.");
  }

  const startYear = availableYears[0];
  const lastYear = availableYears[availableYears.length - 1];

  // Pre-fetch benchmark prices (S&P 500 Total Return)
  const benchmarkPrices = await getYearlyPrices(BENCHMARK_TICKER);

  // We need prices for year Y and Y+1 to compute the return for year Y.
  // So the last scoreable year is lastYear (return = price at lastYear+1 / price at lastYear).
  const slices: AnnualSlice[] = [];
  let prevTickers: string[] = [];

  // Cache of ticker → yearly prices to avoid redundant fetches
  const priceCache = new Map<string, readonly YearlyPrice[]>();
  // Cache of ticker → SEC data for dividend extraction
  const secCache = new Map<string, SecTickerData | null>();

  async function getCachedPrices(ticker: string): Promise<readonly YearlyPrice[]> {
    const cached = priceCache.get(ticker);
    if (cached) return cached;
    const prices = await getYearlyPrices(ticker);
    priceCache.set(ticker, prices);
    return prices;
  }

  async function getCachedSec(ticker: string): Promise<SecTickerData | null> {
    if (secCache.has(ticker)) return secCache.get(ticker)!;
    const data = await getSecHistory(ticker);
    secCache.set(ticker, data);
    return data;
  }

  for (const year of availableYears) {
    // Get top tickers for this year
    const topTickers = await getTopTickers(strategyId, year, topN);
    if (topTickers.length === 0) continue;

    // Fetch prices + SEC data for all holdings in parallel
    const [holdingPrices, holdingSecData] = await Promise.all([
      Promise.all(topTickers.map((t) => getCachedPrices(t.ticker))),
      Promise.all(topTickers.map((t) => getCachedSec(t.ticker))),
    ]);

    // Compute per-holding total return (year → year+1), including dividends
    const holdings: AnnualHolding[] = [];
    for (let i = 0; i < topTickers.length; i++) {
      const t = topTickers[i];
      const prices = holdingPrices[i];
      const secData = holdingSecData[i];
      const priceStart = findPrice(prices, year);
      const priceEnd = findPrice(prices, year + 1);

      if (priceStart === null || priceEnd === null || priceStart === 0) continue;

      const dps = getAnnualDps(secData, year);
      holdings.push({
        ticker: t.ticker,
        companyName: t.companyName,
        score: t.scores.get(strategyId) ?? 0,
        returnPct: round2(((priceEnd + dps) / priceStart - 1) * 100),
      });
    }

    if (holdings.length === 0) continue;

    // Equal-weighted portfolio return for this year
    const portfolioReturnPct = round2(
      holdings.reduce((acc, h) => acc + h.returnPct, 0) / holdings.length,
    );

    // Benchmark return for this year
    const benchStart = findPrice(benchmarkPrices, year);
    const benchEnd = findPrice(benchmarkPrices, year + 1);
    const benchmarkReturnPct =
      benchStart !== null && benchEnd !== null && benchStart > 0
        ? round2((benchEnd / benchStart - 1) * 100)
        : null;

    // Turnover
    const currTickers = holdings.map((h) => h.ticker);
    const turnover = computeTurnover(prevTickers, currTickers);
    prevTickers = currTickers;

    slices.push({
      year,
      holdings,
      portfolioReturnPct,
      benchmarkReturnPct,
      turnover,
    });
  }

  if (slices.length === 0) {
    return emptyRollingResult(strategyId, startYear, lastYear, topN, "Aucune donnée de prix disponible pour la simulation.");
  }

  const actualStart = slices[0].year;
  const actualEnd = slices[slices.length - 1].year + 1; // return goes into next year

  // Cumulative returns
  let cumPortfolio = 1;
  for (const s of slices) cumPortfolio *= 1 + s.portfolioReturnPct / 100;
  const cumulativeReturnPct = round2((cumPortfolio - 1) * 100);

  let cumulativeBenchmarkPct: number | null = null;
  const benchSlices = slices.filter((s) => s.benchmarkReturnPct !== null);
  if (benchSlices.length > 0) {
    let cumBench = 1;
    for (const s of benchSlices) cumBench *= 1 + s.benchmarkReturnPct! / 100;
    cumulativeBenchmarkPct = round2((cumBench - 1) * 100);
  }

  const outperformance = cumulativeBenchmarkPct !== null
    ? round2(cumulativeReturnPct - cumulativeBenchmarkPct)
    : null;

  const risk = computeRiskMetrics(slices);

  const summary = buildRollingSummary(
    strategyId, actualStart, actualEnd, slices.length, topN,
    cumulativeReturnPct, cumulativeBenchmarkPct, risk,
  );

  return {
    strategyId,
    strategyLabel: STRATEGY_LABELS[strategyId],
    startYear: actualStart,
    endYear: actualEnd,
    topN,
    slices,
    cumulativeReturnPct,
    cumulativeBenchmarkPct,
    outperformance,
    risk,
    summary,
    disclaimer:
      "Simulation basée sur des données historiques avec rebalancement annuel. " +
      "Les performances passées ne préjugent pas des performances futures. " +
      "Portefeuille equal-weighted, rendements total return (dividendes inclus). " +
      "Le benchmark est le S&P 500 Total Return (dividendes réinvestis). Sans frais de transaction ni fiscalité. " +
      "Le classement utilise les scores fondamentaux SEC (sans données de marché pour le ranking).",
  };
}

function buildRollingSummary(
  strategyId: StrategyId,
  startYear: number,
  endYear: number,
  numYears: number,
  topN: number,
  cumulativeReturnPct: number,
  cumulativeBenchmarkPct: number | null,
  risk: RiskMetrics,
): string {
  const label = STRATEGY_LABELS[strategyId];
  let text = `Stratégie ${label} avec rebalancement annuel (top ${topN}), de ${startYear} à ${endYear} (${numYears} ans). `;

  text += `Rendement cumulé : ${cumulativeReturnPct >= 0 ? "+" : ""}${cumulativeReturnPct}%`;

  if (cumulativeBenchmarkPct !== null) {
    text += ` vs ${cumulativeBenchmarkPct >= 0 ? "+" : ""}${cumulativeBenchmarkPct}% pour le S&P 500`;
  }

  text += `. CAGR : ${risk.cagr >= 0 ? "+" : ""}${risk.cagr}%`;

  if (risk.benchmarkCagr !== null) {
    text += ` vs ${risk.benchmarkCagr >= 0 ? "+" : ""}${risk.benchmarkCagr}% (S&P 500)`;
  }

  text += `. La stratégie a battu le benchmark ${risk.winRate}% des années.`;

  return text;
}

function emptyRollingResult(
  strategyId: StrategyId,
  startYear: number,
  endYear: number,
  topN: number,
  message: string,
): RollingBacktestResult {
  return {
    strategyId,
    strategyLabel: STRATEGY_LABELS[strategyId],
    startYear,
    endYear,
    topN,
    slices: [],
    cumulativeReturnPct: 0,
    cumulativeBenchmarkPct: null,
    outperformance: null,
    risk: {
      cagr: 0, benchmarkCagr: null, volatility: 0, sharpeRatio: null,
      maxDrawdown: 0, winRate: 0,
      bestYear: { year: 0, returnPct: 0 },
      worstYear: { year: 0, returnPct: 0 },
    },
    summary: message,
    disclaimer: "",
  };
}
