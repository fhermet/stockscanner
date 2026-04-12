import { Stock, DataCompleteness, ScoreConfidence, StrategyId } from "../types";

/**
 * Metriques essentielles par strategie.
 * Chaque metrique a un nom et un test pour verifier si la donnee est presente.
 * On considere null comme "absent" — une valeur nulle (ex: per=0) est consideree presente.
 *
 * Certaines metriques ne s'appliquent pas a certains secteurs (ex: FCF
 * n'a pas de sens pour les banques dont l'operating cash flow inclut les
 * mouvements de depots et prets).
 */

const FINANCE_SECTORS = new Set(["Finance"]);

interface MetricCheck {
  readonly name: string;
  readonly test: (stock: Stock) => boolean;
  /** If set, this metric is skipped for stocks in these sectors */
  readonly skipSectors?: ReadonlySet<string>;
}

const COMMON_METRICS: MetricCheck[] = [
  { name: "prix", test: (s) => s.price > 0 },
  { name: "market cap", test: (s) => s.marketCap > 0 },
  { name: "secteur", test: (s) => s.sector.length > 0 },
];

const STRATEGY_METRICS: Record<StrategyId, MetricCheck[]> = {
  buffett: [
    { name: "PER", test: (s) => s.per !== null },
    { name: "ROIC", test: (s) => s.roic !== null },
    { name: "marge operationnelle", test: (s) => s.operatingMargin !== null },
    { name: "dette/cash-flow", test: (s) => s.debtToOcf !== null, skipSectors: FINANCE_SECTORS },
    { name: "free cash flow", test: (s) => s.freeCashFlow !== null, skipSectors: FINANCE_SECTORS },
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
    { name: "free cash flow", test: (s) => s.freeCashFlow !== null, skipSectors: FINANCE_SECTORS },
    { name: "dette/capitaux", test: (s) => s.debtToEquity !== null },
    { name: "historique dividende", test: (s) => s.history.length >= 2 },
  ],
};

export function computeDataCompleteness(
  stock: Stock,
  strategyId: StrategyId
): DataCompleteness {
  const allChecks = [...COMMON_METRICS, ...(STRATEGY_METRICS[strategyId] ?? [])];
  // Filter out metrics that don't apply to this stock's sector
  const checks = allChecks.filter(
    (check) => !check.skipSectors || !check.skipSectors.has(stock.sector),
  );

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
