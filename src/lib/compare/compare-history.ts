/**
 * Compare history: aggregates historical scores from multiple tickers
 * for a single strategy, aligns years, and generates insights.
 */

import type { StrategyId } from "@/lib/types";
import type {
  HistoricalScorePoint,
  HistoricalStrategyScore,
} from "@/lib/scoring/sec-historical-score";
import { smoothScores, detectAnomalies } from "@/lib/scoring/score-smoothing";
import {
  computeVolatility,
  getStrategyNature,
  type VolatilityInfo,
  type StrategyNature,
} from "@/lib/scoring/score-volatility";

// --- Types ---

export interface TickerHistory {
  readonly ticker: string;
  readonly companyName: string;
  readonly points: readonly HistoricalScorePoint[];
  readonly source: string;
}

export interface CompareYearRow {
  readonly year: number;
  readonly scores: ReadonlyMap<string, number | null>; // ticker → raw score
  readonly smoothedScores: ReadonlyMap<string, number | null>; // ticker → smoothed
  readonly anomalies: ReadonlyMap<string, boolean>; // ticker → is anomaly
}

export interface TickerSummary {
  readonly ticker: string;
  readonly companyName: string;
  readonly latestScore: number | null;
  readonly fiveYearsAgoScore: number | null;
  readonly oldestScore: number | null;
  readonly totalDelta: number | null;
  readonly fiveYearDelta: number | null;
  readonly trend: "up" | "down" | "stable";
  readonly avgScore: number;
  readonly bestYear: number | null;
  readonly worstYear: number | null;
  readonly volatility: VolatilityInfo;
}

export interface CompareHistoryResult {
  readonly strategyId: StrategyId;
  readonly strategyLabel: string;
  readonly tickers: readonly string[];
  readonly years: readonly number[];
  readonly rows: readonly CompareYearRow[];
  readonly summaries: readonly TickerSummary[];
  readonly insights: readonly string[];
  readonly isPartial: boolean;
  readonly strategyNature: StrategyNature;
}

// --- Aggregation ---

export function aggregateCompareHistory(
  histories: readonly TickerHistory[],
  strategyId: StrategyId,
): CompareHistoryResult {
  if (histories.length === 0) {
    return emptyResult(strategyId);
  }

  // Collect all years (union)
  const yearSet = new Set<number>();
  for (const h of histories) {
    for (const p of h.points) {
      yearSet.add(p.fiscalYear);
    }
  }
  const years = [...yearSet].sort((a, b) => a - b);

  // Build score maps per ticker
  const tickerScoreMaps = new Map<string, Map<number, HistoricalStrategyScore>>();
  for (const h of histories) {
    const scoreMap = new Map<number, HistoricalStrategyScore>();
    for (const p of h.points) {
      const stratScore = p.scores.find((s) => s.strategyId === strategyId);
      if (stratScore) {
        scoreMap.set(p.fiscalYear, stratScore);
      }
    }
    tickerScoreMaps.set(h.ticker, scoreMap);
  }

  // Build raw score series per ticker, then smooth
  const rawSeriesPerTicker = new Map<string, readonly (number | null)[]>();
  const smoothedSeriesPerTicker = new Map<string, readonly (number | null)[]>();

  for (const h of histories) {
    const scoreMap = tickerScoreMaps.get(h.ticker)!;
    const rawSeries = years.map((y) => scoreMap.get(y)?.total ?? null);
    rawSeriesPerTicker.set(h.ticker, rawSeries);

    const smoothed = smoothScores(rawSeries, years);
    smoothedSeriesPerTicker.set(
      h.ticker,
      smoothed.map((s) => s.smoothed),
    );
  }

  // Build year rows with raw + smoothed + anomalies
  const rows: CompareYearRow[] = years.map((year, i) => {
    const scores = new Map<string, number | null>();
    const smoothedScores = new Map<string, number | null>();
    const anomalies = new Map<string, boolean>();

    for (const h of histories) {
      const raw = rawSeriesPerTicker.get(h.ticker)!;
      const smoothed = smoothedSeriesPerTicker.get(h.ticker)!;
      scores.set(h.ticker, raw[i]);
      smoothedScores.set(h.ticker, smoothed[i]);

      // Anomaly detection
      const prev = i > 0 ? raw[i - 1] : null;
      const curr = raw[i];
      const delta = curr !== null && prev !== null ? Math.abs(curr - prev) : 0;
      anomalies.set(h.ticker, delta > 25);
    }
    return { year, scores, smoothedScores, anomalies };
  });

  // Build summaries (with volatility)
  const tickers = histories.map((h) => h.ticker);
  const summaries = histories.map((h) =>
    buildSummary(
      h,
      tickerScoreMaps.get(h.ticker)!,
      years,
      rawSeriesPerTicker.get(h.ticker)!,
    ),
  );

  // Get strategy label from first available score
  let strategyLabel: string = strategyId;
  for (const h of histories) {
    for (const p of h.points) {
      const s = p.scores.find((sc) => sc.strategyId === strategyId);
      if (s) {
        strategyLabel = s.strategyLabel;
        break;
      }
    }
    if (strategyLabel !== strategyId) break;
  }

  const isPartial = histories.some((h) =>
    h.points.some((p) =>
      p.scores.find((s) => s.strategyId === strategyId)?.isPartial ?? false,
    ),
  );

  const insights = generateInsights(summaries, strategyLabel, years, strategyId);

  return {
    strategyId,
    strategyLabel,
    tickers,
    years,
    rows,
    summaries,
    insights,
    isPartial,
    strategyNature: getStrategyNature(strategyId),
  };
}

// --- Summary ---

function buildSummary(
  history: TickerHistory,
  scoreMap: Map<number, HistoricalStrategyScore>,
  allYears: readonly number[],
  rawSeries: readonly (number | null)[],
): TickerSummary {
  const scores: { year: number; score: number }[] = [];
  for (const [year, strat] of scoreMap) {
    scores.push({ year, score: strat.total });
  }
  scores.sort((a, b) => a.year - b.year);

  if (scores.length === 0) {
    return {
      ticker: history.ticker,
      companyName: history.companyName,
      latestScore: null,
      fiveYearsAgoScore: null,
      oldestScore: null,
      totalDelta: null,
      fiveYearDelta: null,
      trend: "stable",
      avgScore: 0,
      bestYear: null,
      worstYear: null,
      volatility: computeVolatility([]),
    };
  }

  const latest = scores[scores.length - 1];
  const oldest = scores[0];
  const latestYear = latest.year;

  const fiveYearsAgo = scores.find((s) => s.year === latestYear - 5)
    ?? scores.find((s) => s.year === latestYear - 4)
    ?? scores.find((s) => s.year === latestYear - 6);

  const totalDelta = latest.score - oldest.score;
  const fiveYearDelta = fiveYearsAgo ? latest.score - fiveYearsAgo.score : null;

  const avgScore = Math.round(
    scores.reduce((acc, s) => acc + s.score, 0) / scores.length,
  );

  const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
  const worst = scores.reduce((a, b) => (b.score < a.score ? b : a));

  // Trend: based on last 3 years if available
  const recentScores = scores.slice(-3);
  let trend: "up" | "down" | "stable" = "stable";
  if (recentScores.length >= 2) {
    const recentDelta =
      recentScores[recentScores.length - 1].score - recentScores[0].score;
    if (recentDelta > 3) trend = "up";
    else if (recentDelta < -3) trend = "down";
  }

  return {
    ticker: history.ticker,
    companyName: history.companyName,
    latestScore: latest.score,
    fiveYearsAgoScore: fiveYearsAgo?.score ?? null,
    oldestScore: oldest.score,
    totalDelta,
    fiveYearDelta,
    trend,
    avgScore,
    bestYear: best.year,
    worstYear: worst.year,
    volatility: computeVolatility(rawSeries),
  };
}

// --- Insights ---

export function generateInsights(
  summaries: readonly TickerSummary[],
  strategyLabel: string,
  years: readonly number[],
  strategyId?: StrategyId,
): string[] {
  const insights: string[] = [];
  const withScores = summaries.filter((s) => s.latestScore !== null);

  if (withScores.length < 2) return insights;

  // 1. Best performer (highest latest score)
  const sorted = [...withScores].sort(
    (a, b) => (b.latestScore ?? 0) - (a.latestScore ?? 0),
  );
  const leader = sorted[0];
  const second = sorted[1];

  if (leader.latestScore !== null && second.latestScore !== null) {
    const gap = leader.latestScore - second.latestScore;
    if (gap > 5) {
      insights.push(
        `${leader.ticker} domine sur la stratégie ${strategyLabel} avec un score de ${leader.latestScore} contre ${second.latestScore} pour ${second.ticker}.`,
      );
    } else {
      insights.push(
        `${leader.ticker} et ${second.ticker} sont proches sur la stratégie ${strategyLabel} (${leader.latestScore} vs ${second.latestScore}).`,
      );
    }
  }

  // 2. Strongest recent progression
  const withFiveYear = withScores.filter((s) => s.fiveYearDelta !== null);
  if (withFiveYear.length > 0) {
    const bestProgression = [...withFiveYear].sort(
      (a, b) => (b.fiveYearDelta ?? 0) - (a.fiveYearDelta ?? 0),
    )[0];
    if (bestProgression.fiveYearDelta !== null && bestProgression.fiveYearDelta > 5) {
      insights.push(
        `${bestProgression.ticker} montre la plus forte progression sur 5 ans (+${bestProgression.fiveYearDelta} points).`,
      );
    }
  }

  // 3. Most stable
  const withTotal = withScores.filter((s) => s.totalDelta !== null);
  if (withTotal.length >= 2) {
    const mostStable = [...withTotal].sort(
      (a, b) => Math.abs(a.totalDelta ?? 0) - Math.abs(b.totalDelta ?? 0),
    )[0];
    if (
      mostStable.totalDelta !== null &&
      Math.abs(mostStable.totalDelta) <= 5 &&
      years.length >= 5
    ) {
      insights.push(
        `${mostStable.ticker} reste le plus stable sur la période (variation de ${mostStable.totalDelta > 0 ? "+" : ""}${mostStable.totalDelta} points).`,
      );
    }
  }

  // 4. Biggest decline
  const declining = withTotal.filter(
    (s) => s.fiveYearDelta !== null && s.fiveYearDelta < -10,
  );
  if (declining.length > 0) {
    const worst = [...declining].sort(
      (a, b) => (a.fiveYearDelta ?? 0) - (b.fiveYearDelta ?? 0),
    )[0];
    insights.push(
      `${worst.ticker} accuse la plus forte baisse sur 5 ans (${worst.fiveYearDelta} points).`,
    );
  }

  // 5. Volatility warnings
  const volatileOnes = withScores.filter(
    (s) => s.volatility.level === "volatile",
  );
  if (volatileOnes.length > 0) {
    const names = volatileOnes.map((s) => s.ticker).join(", ");
    insights.push(
      `${names} ${volatileOnes.length > 1 ? "présentent" : "présente"} un profil volatil sur cette stratégie (écart-type > 12 pts).`,
    );
  }

  // 6. Steady improver (all deltas positive over last 4+ years)
  for (const s of withScores) {
    if (
      s.trend === "up" &&
      s.totalDelta !== null &&
      s.totalDelta > 10 &&
      s.volatility.level !== "volatile"
    ) {
      insights.push(
        `${s.ticker} montre une amélioration régulière (+${s.totalDelta} pts sur la période).`,
      );
      break;
    }
  }

  // 7. Progressive degradation
  for (const s of withScores) {
    if (
      s.trend === "down" &&
      s.totalDelta !== null &&
      s.totalDelta < -10 &&
      s.volatility.level !== "volatile"
    ) {
      insights.push(
        `${s.ticker} montre une dégradation progressive (${s.totalDelta} pts sur la période).`,
      );
      break;
    }
  }

  // 8. Strategy nature warning
  if (strategyId) {
    const nature = getStrategyNature(strategyId);
    if (nature.expectedVolatility === "volatile") {
      insights.push(nature.explanation);
    }
  }

  return insights;
}

// --- Helpers ---

function emptyResult(strategyId: StrategyId): CompareHistoryResult {
  return {
    strategyId,
    strategyLabel: strategyId,
    tickers: [],
    years: [],
    rows: [],
    summaries: [],
    insights: [],
    isPartial: false,
    strategyNature: getStrategyNature(strategyId),
  };
}
