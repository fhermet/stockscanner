import { Stock, DataCompleteness, ScoreConfidence, StrategyId } from "../types";

/**
 * Metriques essentielles par strategie.
 * Chaque metrique a un nom et un test pour verifier si la donnee est presente.
 * On considere null comme "absent" — une valeur nulle (ex: per=0) est consideree presente.
 */

interface MetricCheck {
  readonly name: string;
  readonly test: (stock: Stock) => boolean;
}

const COMMON_METRICS: MetricCheck[] = [
  { name: "prix", test: (s) => s.price > 0 },
  { name: "market cap", test: (s) => s.marketCap > 0 },
  { name: "secteur", test: (s) => s.sector.length > 0 },
];

const STRATEGY_METRICS: Record<StrategyId, MetricCheck[]> = {
  buffett: [
    { name: "PER", test: (s) => s.per !== null },
    { name: "ROE", test: (s) => s.roe !== null },
    { name: "marge operationnelle", test: (s) => s.operatingMargin !== null },
    { name: "dette/capitaux", test: (s) => s.debtToEquity !== null },
    { name: "free cash flow", test: (s) => s.freeCashFlow !== null },
  ],
  lynch: [
    { name: "PEG", test: (s) => s.peg !== null },
    { name: "croissance EPS", test: (s) => s.epsGrowth !== null },
    { name: "croissance CA", test: (s) => s.revenueGrowth !== null },
    { name: "marge operationnelle", test: (s) => s.operatingMargin !== null },
    { name: "dette/capitaux", test: (s) => s.debtToEquity !== null },
  ],
  growth: [
    { name: "croissance CA", test: (s) => s.revenueGrowth !== null },
    { name: "croissance EPS", test: (s) => s.epsGrowth !== null },
    { name: "marge operationnelle", test: (s) => s.operatingMargin !== null },
    { name: "ROE", test: (s) => s.roe !== null },
  ],
  dividend: [
    { name: "rendement dividende", test: (s) => s.dividendYield !== null },
    { name: "payout ratio", test: (s) => s.payoutRatio !== null },
    { name: "free cash flow", test: (s) => s.freeCashFlow !== null },
    { name: "dette/capitaux", test: (s) => s.debtToEquity !== null },
    { name: "historique dividende", test: (s) => s.history.length >= 2 },
  ],
};

export function computeDataCompleteness(
  stock: Stock,
  strategyId: StrategyId
): DataCompleteness {
  const checks = [...COMMON_METRICS, ...(STRATEGY_METRICS[strategyId] ?? [])];

  const available: string[] = [];
  const missing: string[] = [];

  for (const check of checks) {
    if (check.test(stock)) {
      available.push(check.name);
    } else {
      missing.push(check.name);
    }
  }

  const score = checks.length > 0
    ? Math.round((available.length / checks.length) * 100)
    : 0;

  return { score, available, missing };
}

export function computeConfidence(completeness: DataCompleteness): ScoreConfidence {
  if (completeness.score >= 85) return "high";
  if (completeness.score >= 60) return "medium";
  return "low";
}
