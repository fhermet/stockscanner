import { ScoredStock, StrategyId, SubScore } from "../types";

/**
 * Comparison engine: analyzes 2-4 scored stocks and produces
 * highlights (best/worst per metric) and a human-readable summary.
 */

// --- Types ---

export interface ComparedMetric {
  readonly label: string;
  readonly key: string;
  readonly values: readonly { ticker: string; value: number; formatted: string }[];
  readonly bestTicker: string;
  readonly worstTicker: string;
}

export interface ComparisonResult {
  readonly stocks: readonly ScoredStock[];
  readonly strategyId: StrategyId;
  readonly winner: { ticker: string; name: string; score: number };
  readonly subScoreComparison: readonly ComparedMetric[];
  readonly metricComparison: readonly ComparedMetric[];
  readonly summary: string;
}

// --- Helpers ---

function bestAndWorst(
  items: readonly { ticker: string; value: number }[]
): { best: string; worst: string } {
  let best = items[0];
  let worst = items[0];
  for (const item of items) {
    if (item.value > best.value) best = item;
    if (item.value < worst.value) worst = item;
  }
  return { best: best.ticker, worst: worst.ticker };
}

function buildComparedMetric(
  label: string,
  key: string,
  stocks: readonly ScoredStock[],
  getValue: (s: ScoredStock) => number,
  format: (v: number) => string
): ComparedMetric {
  const values = stocks.map((s) => ({
    ticker: s.stock.ticker,
    value: getValue(s),
    formatted: format(getValue(s)),
  }));
  const { best, worst } = bestAndWorst(values);
  return { label, key, values, bestTicker: best, worstTicker: worst };
}

// --- Sub-scores comparison ---

function compareSubScores(
  stocks: readonly ScoredStock[]
): ComparedMetric[] {
  if (stocks.length === 0) return [];

  const subScoreNames = stocks[0].score.subScores.map((s) => s.name);

  return subScoreNames.map((name) => {
    const label =
      stocks[0].score.subScores.find((s) => s.name === name)?.label ?? name;

    return buildComparedMetric(
      label,
      name,
      stocks,
      (s) => s.score.subScores.find((sub) => sub.name === name)?.value ?? 0,
      (v) => `${v}`
    );
  });
}

// --- Key metrics comparison ---

function compareMetrics(
  stocks: readonly ScoredStock[]
): ComparedMetric[] {
  const metrics: {
    label: string;
    key: string;
    get: (s: ScoredStock) => number;
    format: (v: number) => string;
    inverse?: boolean;
  }[] = [
    { label: "PER", key: "per", get: (s) => s.stock.per, format: (v) => `${v}`, inverse: true },
    { label: "ROE", key: "roe", get: (s) => s.stock.roe, format: (v) => `${v}%` },
    { label: "Marge op.", key: "margin", get: (s) => s.stock.operatingMargin, format: (v) => `${v}%` },
    { label: "D/E", key: "debt", get: (s) => s.stock.debtToEquity, format: (v) => `${v}`, inverse: true },
    { label: "FCF (Mds)", key: "fcf", get: (s) => s.stock.freeCashFlow, format: (v) => `${v}` },
    { label: "Croiss. CA", key: "revGrowth", get: (s) => s.stock.revenueGrowth, format: (v) => `${v}%` },
    { label: "Croiss. BPA", key: "epsGrowth", get: (s) => s.stock.epsGrowth, format: (v) => `${v}%` },
    { label: "Div. Yield", key: "divYield", get: (s) => s.stock.dividendYield, format: (v) => `${v}%` },
  ];

  return metrics.map((m) => {
    const compared = buildComparedMetric(m.label, m.key, stocks, m.get, m.format);
    // For inverse metrics (PER, D/E), best = lowest
    if (m.inverse) {
      return { ...compared, bestTicker: compared.worstTicker, worstTicker: compared.bestTicker };
    }
    return compared;
  });
}

// --- Summary generator ---

function generateComparisonSummary(
  stocks: readonly ScoredStock[],
  subScoreComps: readonly ComparedMetric[]
): string {
  if (stocks.length < 2) return "";

  const sorted = [...stocks].sort((a, b) => b.score.total - a.score.total);
  const winner = sorted[0];
  const loser = sorted[sorted.length - 1];

  // Find which sub-scores the winner dominates
  const winnerStrengths = subScoreComps
    .filter((c) => c.bestTicker === winner.stock.ticker)
    .map((c) => c.label.toLowerCase());

  const parts: string[] = [];

  parts.push(
    `${winner.stock.ticker} domine avec un score de ${winner.score.total}/100`
  );

  if (winnerStrengths.length > 0) {
    parts[0] += `, leader en ${winnerStrengths.slice(0, 2).join(" et ")}`;
  }
  parts[0] += ".";

  // What does the runner-up have?
  if (sorted.length >= 2) {
    const runnerUp = sorted[1];
    const runnerStrengths = subScoreComps
      .filter((c) => c.bestTicker === runnerUp.stock.ticker)
      .map((c) => c.label.toLowerCase());

    if (runnerStrengths.length > 0) {
      parts.push(
        `${runnerUp.stock.ticker} se distingue en ${runnerStrengths.slice(0, 2).join(" et ")} (${runnerUp.score.total}/100).`
      );
    }
  }

  // Mention weakness of loser if gap is significant
  const gap = winner.score.total - loser.score.total;
  if (gap >= 15 && loser.stock.ticker !== winner.stock.ticker) {
    parts.push(
      `${loser.stock.ticker} est en retrait (${loser.score.total}/100).`
    );
  }

  return parts.join(" ");
}

// --- Main function ---

export function compareStocks(
  stocks: readonly ScoredStock[],
  strategyId: StrategyId
): ComparisonResult {
  const sorted = [...stocks].sort((a, b) => b.score.total - a.score.total);
  const winnerStock = sorted[0];

  const subScoreComparison = compareSubScores(stocks);
  const metricComparison = compareMetrics(stocks);
  const summary = generateComparisonSummary(stocks, subScoreComparison);

  return {
    stocks,
    strategyId,
    winner: {
      ticker: winnerStock.stock.ticker,
      name: winnerStock.stock.name,
      score: winnerStock.score.total,
    },
    subScoreComparison,
    metricComparison,
    summary,
  };
}
