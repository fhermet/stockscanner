import { Stock, DataCompleteness, ScoreConfidence, StrategyId } from "../types";

/**
 * Metriques essentielles par strategie.
 * Chaque metrique a un nom et un test pour verifier si la donnee est presente.
 * On considere 0 comme "present mais nul", et NaN/undefined comme "absent".
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
    { name: "PER", test: (s) => s.per > 0 },
    { name: "ROE", test: (s) => isFinite(s.roe) && s.roe !== 0 },
    { name: "marge operationnelle", test: (s) => isFinite(s.operatingMargin) },
    { name: "dette/capitaux", test: (s) => isFinite(s.debtToEquity) && s.debtToEquity >= 0 },
    { name: "free cash flow", test: (s) => isFinite(s.freeCashFlow) },
  ],
  lynch: [
    { name: "PEG", test: (s) => s.peg > 0 },
    { name: "croissance EPS", test: (s) => isFinite(s.epsGrowth) },
    { name: "croissance CA", test: (s) => isFinite(s.revenueGrowth) },
    { name: "marge operationnelle", test: (s) => isFinite(s.operatingMargin) },
    { name: "dette/capitaux", test: (s) => isFinite(s.debtToEquity) && s.debtToEquity >= 0 },
  ],
  growth: [
    { name: "croissance CA", test: (s) => isFinite(s.revenueGrowth) },
    { name: "croissance EPS", test: (s) => isFinite(s.epsGrowth) },
    { name: "marge operationnelle", test: (s) => isFinite(s.operatingMargin) },
    { name: "ROE", test: (s) => isFinite(s.roe) && s.roe !== 0 },
  ],
  dividend: [
    { name: "rendement dividende", test: (s) => s.dividendYield > 0 },
    { name: "payout ratio", test: (s) => s.payoutRatio > 0 },
    { name: "free cash flow", test: (s) => isFinite(s.freeCashFlow) },
    { name: "dette/capitaux", test: (s) => isFinite(s.debtToEquity) && s.debtToEquity >= 0 },
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
