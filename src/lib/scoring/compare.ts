import { ScoredStock, StrategyId } from "../types";

/**
 * Comparison engine v2: handles N/A values, near-ties, and
 * confidence/completeness awareness in summaries.
 */

// --- Types ---

export interface ComparedValue {
  readonly ticker: string;
  readonly value: number | null; // null = data unavailable
  readonly formatted: string;
}

export interface ComparedMetric {
  readonly label: string;
  readonly key: string;
  readonly values: readonly ComparedValue[];
  readonly bestTicker: string | null; // null if all N/A
  readonly worstTicker: string | null;
  readonly isPartial: boolean; // true if some values are N/A
}

export interface ComparisonResult {
  readonly stocks: readonly ScoredStock[];
  readonly strategyId: StrategyId;
  readonly winner: { ticker: string; name: string; score: number } | null;
  readonly isTie: boolean; // true if top 2 scores differ by < TIE_THRESHOLD
  readonly subScoreComparison: readonly ComparedMetric[];
  readonly metricComparison: readonly ComparedMetric[];
  readonly summary: string;
  readonly warnings: readonly string[];
}

const TIE_THRESHOLD = 3; // points
const NA_MARKER = 0; // values at or below this for key metrics are treated as missing

// --- Helpers ---

function isAvailable(value: number | null): value is number {
  return value !== null;
}

function bestAndWorst(
  items: readonly ComparedValue[]
): { best: string | null; worst: string | null } {
  const valid = items.filter((i) => isAvailable(i.value));
  if (valid.length === 0) return { best: null, worst: null };
  if (valid.length === 1) return { best: valid[0].ticker, worst: null };

  let best = valid[0];
  let worst = valid[0];
  for (const item of valid) {
    if (item.value! > best.value!) best = item;
    if (item.value! < worst.value!) worst = item;
  }
  return {
    best: best.ticker,
    worst: best.ticker === worst.ticker ? null : worst.ticker,
  };
}

function buildComparedMetric(
  label: string,
  key: string,
  stocks: readonly ScoredStock[],
  getValue: (s: ScoredStock) => number | null,
  format: (v: number | null) => string,
  inverse = false
): ComparedMetric {
  const values: ComparedValue[] = stocks.map((s) => {
    const raw = getValue(s);
    return { ticker: s.stock.ticker, value: raw, formatted: format(raw) };
  });

  const { best, worst } = bestAndWorst(values);
  const isPartial = values.some((v) => !isAvailable(v.value));

  if (inverse && best && worst) {
    return { label, key, values, bestTicker: worst, worstTicker: best, isPartial };
  }

  return { label, key, values, bestTicker: best, worstTicker: worst, isPartial };
}

// --- Sub-scores ---

function compareSubScores(stocks: readonly ScoredStock[]): ComparedMetric[] {
  if (stocks.length === 0) return [];
  const names = stocks[0].score.subScores.map((s) => s.name);

  return names.map((name) => {
    const label = stocks[0].score.subScores.find((s) => s.name === name)?.label ?? name;
    return buildComparedMetric(
      label, name, stocks,
      (s) => s.score.subScores.find((sub) => sub.name === name)?.value ?? null,
      (v) => (v !== null ? `${v}` : "N/A")
    );
  });
}

// --- Key metrics ---

function metricOrNull(value: number | null, zeroIsNA = false): number | null {
  if (value === null) return null;
  if (!isFinite(value)) return null;
  if (zeroIsNA && value === 0) return null;
  return value;
}

function compareMetrics(stocks: readonly ScoredStock[]): ComparedMetric[] {
  const defs: {
    label: string; key: string;
    get: (s: ScoredStock) => number | null;
    format: (v: number | null) => string;
    inverse?: boolean;
  }[] = [
    { label: "PER", key: "per", get: (s) => metricOrNull(s.stock.per, true), format: (v) => v !== null ? `${v}` : "N/A", inverse: true },
    { label: "ROE", key: "roe", get: (s) => metricOrNull(s.stock.roe, true), format: (v) => v !== null ? `${v}%` : "N/A" },
    { label: "Marge op.", key: "margin", get: (s) => metricOrNull(s.stock.operatingMargin), format: (v) => v !== null ? `${v}%` : "N/A" },
    { label: "D/E", key: "debt", get: (s) => metricOrNull(s.stock.debtToEquity), format: (v) => v !== null ? `${v}` : "N/A", inverse: true },
    { label: "PEG", key: "peg", get: (s) => metricOrNull(s.stock.peg, true), format: (v) => v !== null ? `${v}` : "N/A", inverse: true },
    { label: "FCF (Mds)", key: "fcf", get: (s) => metricOrNull(s.stock.freeCashFlow), format: (v) => v !== null ? `${v}` : "N/A" },
    { label: "Croiss. CA", key: "revGrowth", get: (s) => metricOrNull(s.stock.revenueGrowth), format: (v) => v !== null ? `${v}%` : "N/A" },
    { label: "Croiss. BPA", key: "epsGrowth", get: (s) => metricOrNull(s.stock.epsGrowth), format: (v) => v !== null ? `${v}%` : "N/A" },
    { label: "Div. Yield", key: "divYield", get: (s) => metricOrNull(s.stock.dividendYield), format: (v) => v !== null ? `${v}%` : "N/A" },
  ];

  return defs.map((m) =>
    buildComparedMetric(m.label, m.key, stocks, m.get, m.format, m.inverse)
  );
}

// --- Summary ---

function generateSummary(
  stocks: readonly ScoredStock[],
  subScoreComps: readonly ComparedMetric[],
  isTie: boolean,
  warnings: readonly string[]
): string {
  if (stocks.length < 2) return "";

  const sorted = [...stocks].sort((a, b) => (b.score.total ?? 0) - (a.score.total ?? 0));
  const first = sorted[0];
  const second = sorted[1];
  const loser = sorted[sorted.length - 1];

  const firstStrengths = subScoreComps
    .filter((c) => c.bestTicker === first.stock.ticker)
    .map((c) => c.label.toLowerCase());

  const parts: string[] = [];

  if (isTie) {
    // Near-tie wording
    parts.push(
      `${first.stock.ticker} et ${second.stock.ticker} sont tres proches (${first.score.total} vs ${second.score.total}/100)`
    );
    if (firstStrengths.length > 0) {
      parts[0] += `. ${first.stock.ticker} garde un leger avantage en ${firstStrengths.slice(0, 2).join(" et ")}`;
    }
    parts[0] += ".";
  } else {
    parts.push(
      `${first.stock.ticker} domine avec ${first.score.total}/100`
    );
    if (firstStrengths.length > 0) {
      parts[0] += `, leader en ${firstStrengths.slice(0, 2).join(" et ")}`;
    }
    parts[0] += ".";
  }

  // Runner-up strengths
  const secondStrengths = subScoreComps
    .filter((c) => c.bestTicker === second.stock.ticker)
    .map((c) => c.label.toLowerCase());

  if (secondStrengths.length > 0) {
    parts.push(
      `${second.stock.ticker} se distingue en ${secondStrengths.slice(0, 2).join(" et ")} (${second.score.total}/100).`
    );
  }

  // Laggard
  const gap = (first.score.total ?? 0) - (loser.score.total ?? 0);
  if (gap >= 15 && loser.stock.ticker !== first.stock.ticker) {
    parts.push(`${loser.stock.ticker} est en retrait (${loser.score.total}/100).`);
  }

  // Confidence warning
  const lowConfidence = stocks.filter((s) => s.score.confidence === "low");
  if (lowConfidence.length > 0) {
    const tickers = lowConfidence.map((s) => s.stock.ticker).join(", ");
    parts.push(`Attention : donnees incompletes pour ${tickers}.`);
  }

  if (warnings.length > 0) {
    parts.push(warnings[0]);
  }

  return parts.join(" ");
}

// --- Main ---

export function compareStocks(
  stocks: readonly ScoredStock[],
  strategyId: StrategyId
): ComparisonResult {
  const sorted = [...stocks].sort((a, b) => (b.score.total ?? 0) - (a.score.total ?? 0));

  const isTie =
    sorted.length >= 2 &&
    Math.abs((sorted[0].score.total ?? 0) - (sorted[1].score.total ?? 0)) < TIE_THRESHOLD;

  const winner = sorted.length > 0
    ? { ticker: sorted[0].stock.ticker, name: sorted[0].stock.name, score: sorted[0].score.total ?? 0 }
    : null;

  const subScoreComparison = compareSubScores(stocks);
  const metricComparison = compareMetrics(stocks);

  // Build warnings
  const warnings: string[] = [];
  const partialMetrics = metricComparison.filter((m) => m.isPartial);
  if (partialMetrics.length >= 3) {
    warnings.push("Comparaison partielle : certaines metriques manquent pour une ou plusieurs actions.");
  }

  const summary = generateSummary(stocks, subScoreComparison, isTie, warnings);

  return {
    stocks,
    strategyId,
    winner,
    isTie,
    subScoreComparison,
    metricComparison,
    summary,
    warnings,
  };
}
