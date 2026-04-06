/**
 * Score historique calculé à partir des données fondamentales SEC.
 *
 * Réutilise les primitives de scoring existantes (scoreMetric, weightedAverage)
 * mais ne calcule que les sous-scores pour lesquels les données SEC suffisent.
 *
 * Métriques INDISPONIBLES côté SEC (données de marché) :
 *   - PER, PEG → pas de cours historique
 *   - Market Cap → pas de cours historique
 *   - Dividend Yield → pas de cours historique
 *
 * Pour chaque stratégie, les sous-scores qui dépendent de ces métriques
 * sont explicitement exclus et documentés.
 */

import type { SecAnnual, SecTickerData } from "@/lib/types/sec-fundamentals";
import type { StrategyId } from "@/lib/types";
import { scoreMetric, normalizeOptimalRange } from "./normalize";
import { weightedAverage } from "./utils";

// --- Types ---

export interface HistoricalSubScore {
  readonly name: string;
  readonly label: string;
  readonly value: number;
  readonly weight: number;
  readonly available: boolean;
}

export interface HistoricalStrategyScore {
  readonly strategyId: StrategyId;
  readonly strategyLabel: string;
  readonly total: number;
  readonly subScores: readonly HistoricalSubScore[];
  readonly coverage: number; // 0-1, fraction of original score computable
  readonly excludedSubScores: readonly string[];
  readonly isPartial: boolean;
}

export interface HistoricalScorePoint {
  readonly fiscalYear: number;
  readonly scores: readonly HistoricalStrategyScore[];
}

// --- Scoring per strategy ---

function scoreBuffettHistorical(annual: SecAnnual): HistoricalStrategyScore {
  const { ratios } = annual;

  // Quality (partial): ROE + margin available, FCF yield needs marketCap
  const roeScore = ratios.roe !== null ? scoreMetric("roe", ratios.roe * 100) : 0;
  const marginScore = ratios.operating_margin !== null
    ? scoreMetric("operatingMargin", ratios.operating_margin * 100)
    : 0;
  const qualityAvailable = ratios.roe !== null || ratios.operating_margin !== null;

  const qualityItems: { score: number; weight: number }[] = [];
  if (ratios.roe !== null) qualityItems.push({ score: roeScore, weight: 0.4 });
  if (ratios.operating_margin !== null) qualityItems.push({ score: marginScore, weight: 0.35 });
  // FCF yield excluded (needs marketCap)

  const qualityValue = qualityItems.length > 0 ? weightedAverage(qualityItems) : 0;

  // Strength (full): debt/equity + FCF positive
  const debtScore = ratios.debt_to_equity !== null
    ? scoreMetric("debtToEquity", ratios.debt_to_equity)
    : 0;
  const fcfPosScore = ratios.free_cash_flow !== null
    ? (ratios.free_cash_flow > 0 ? 100 : 10)
    : 0;
  const strengthAvailable = ratios.debt_to_equity !== null || ratios.free_cash_flow !== null;

  const strengthItems: { score: number; weight: number }[] = [];
  if (ratios.debt_to_equity !== null) strengthItems.push({ score: debtScore, weight: 0.6 });
  if (ratios.free_cash_flow !== null) strengthItems.push({ score: fcfPosScore, weight: 0.4 });

  const strengthValue = strengthItems.length > 0 ? weightedAverage(strengthItems) : 0;

  // Valuation: excluded (PER needs market price)

  const subScores: HistoricalSubScore[] = [
    { name: "quality", label: "Qualité", value: qualityValue, weight: 0.4, available: qualityAvailable },
    { name: "strength", label: "Solidité financière", value: strengthValue, weight: 0.3, available: strengthAvailable },
    { name: "valuation", label: "Valorisation", value: 0, weight: 0.3, available: false },
  ];

  const available = subScores.filter((s) => s.available);
  const totalAvailableWeight = available.reduce((acc, s) => acc + s.weight, 0);
  const total = totalAvailableWeight > 0
    ? Math.round(available.reduce((acc, s) => acc + s.value * s.weight, 0) / totalAvailableWeight)
    : 0;

  return {
    strategyId: "buffett",
    strategyLabel: "Warren Buffett",
    total,
    subScores,
    coverage: totalAvailableWeight,
    excludedSubScores: ["Valorisation (PER — données de marché requises)"],
    isPartial: true,
  };
}

function scoreDividendHistorical(
  annual: SecAnnual,
  allAnnuals: readonly SecAnnual[],
): HistoricalStrategyScore {
  const { ratios, fundamentals } = annual;

  // Yield: excluded (dividend yield needs market price)

  // Sustainability (partial): payout ratio available, FCF coverage needs marketCap
  const payoutScore = ratios.payout_ratio !== null
    ? normalizeOptimalRange(ratios.payout_ratio * 100, 30, 60, 0, 100)
    : 0;
  const sustainabilityAvailable = ratios.payout_ratio !== null;
  const sustainabilityValue = sustainabilityAvailable ? payoutScore : 0;

  // Stability (full): debt/equity + dividend growth from history
  const debtScore = ratios.debt_to_equity !== null
    ? scoreMetric("debtToEquity", ratios.debt_to_equity)
    : 0;

  const divGrowthScore = scoreDividendGrowthFromSec(annual.fiscal_year, allAnnuals);

  const stabilityItems: { score: number; weight: number }[] = [];
  if (ratios.debt_to_equity !== null) stabilityItems.push({ score: debtScore, weight: 0.4 });
  stabilityItems.push({ score: divGrowthScore, weight: 0.6 });
  const stabilityAvailable = ratios.debt_to_equity !== null;

  const stabilityValue = weightedAverage(stabilityItems);

  const subScores: HistoricalSubScore[] = [
    { name: "yield", label: "Rendement", value: 0, weight: 0.3, available: false },
    { name: "sustainability", label: "Soutenabilité", value: sustainabilityValue, weight: 0.35, available: sustainabilityAvailable },
    { name: "stability", label: "Stabilité", value: stabilityValue, weight: 0.35, available: stabilityAvailable },
  ];

  const available = subScores.filter((s) => s.available);
  const totalAvailableWeight = available.reduce((acc, s) => acc + s.weight, 0);
  const total = totalAvailableWeight > 0
    ? Math.round(available.reduce((acc, s) => acc + s.value * s.weight, 0) / totalAvailableWeight)
    : 0;

  return {
    strategyId: "dividend",
    strategyLabel: "Dividende",
    total,
    subScores,
    coverage: totalAvailableWeight,
    excludedSubScores: [
      "Rendement (dividend yield — données de marché requises)",
      "FCF coverage (capitalisation boursière requise)",
    ],
    isPartial: true,
  };
}

function scoreGrowthHistorical(annual: SecAnnual): HistoricalStrategyScore {
  const { ratios } = annual;

  // Momentum (full): revenue growth + EPS growth
  const revScore = ratios.revenue_growth !== null
    ? scoreMetric("revenueGrowth", ratios.revenue_growth * 100)
    : 0;
  const epsScore = ratios.eps_growth !== null
    ? scoreMetric("epsGrowth", ratios.eps_growth * 100)
    : 0;
  const momentumItems: { score: number; weight: number }[] = [];
  if (ratios.revenue_growth !== null) momentumItems.push({ score: revScore, weight: 0.5 });
  if (ratios.eps_growth !== null) momentumItems.push({ score: epsScore, weight: 0.5 });
  const momentumAvailable = momentumItems.length > 0;
  const momentumValue = momentumAvailable ? weightedAverage(momentumItems) : 0;

  // Profitability (full): margin + ROE
  const marginScore = ratios.operating_margin !== null
    ? scoreMetric("operatingMargin", ratios.operating_margin * 100)
    : 0;
  const roeScore = ratios.roe !== null ? scoreMetric("roe", ratios.roe * 100) : 0;
  const profitItems: { score: number; weight: number }[] = [];
  if (ratios.operating_margin !== null) profitItems.push({ score: marginScore, weight: 0.5 });
  if (ratios.roe !== null) profitItems.push({ score: roeScore, weight: 0.5 });
  const profitAvailable = profitItems.length > 0;
  const profitValue = profitAvailable ? weightedAverage(profitItems) : 0;

  // Scalability: excluded (marketCap needed)

  const subScores: HistoricalSubScore[] = [
    { name: "momentum", label: "Momentum de croissance", value: momentumValue, weight: 0.5, available: momentumAvailable },
    { name: "profitability", label: "Rentabilité", value: profitValue, weight: 0.25, available: profitAvailable },
    { name: "scalability", label: "Potentiel de croissance", value: 0, weight: 0.25, available: false },
  ];

  const available = subScores.filter((s) => s.available);
  const totalAvailableWeight = available.reduce((acc, s) => acc + s.weight, 0);
  const total = totalAvailableWeight > 0
    ? Math.round(available.reduce((acc, s) => acc + s.value * s.weight, 0) / totalAvailableWeight)
    : 0;

  return {
    strategyId: "growth",
    strategyLabel: "Growth",
    total,
    subScores,
    coverage: totalAvailableWeight,
    excludedSubScores: ["Potentiel de croissance (capitalisation boursière requise)"],
    isPartial: true,
  };
}

function scoreLynchHistorical(annual: SecAnnual): HistoricalStrategyScore {
  const { ratios } = annual;

  // Growth (full): EPS growth + revenue growth
  const epsScore = ratios.eps_growth !== null
    ? scoreMetric("epsGrowth", ratios.eps_growth * 100)
    : 0;
  const revScore = ratios.revenue_growth !== null
    ? scoreMetric("revenueGrowth", ratios.revenue_growth * 100)
    : 0;
  const growthItems: { score: number; weight: number }[] = [];
  if (ratios.eps_growth !== null) growthItems.push({ score: epsScore, weight: 0.6 });
  if (ratios.revenue_growth !== null) growthItems.push({ score: revScore, weight: 0.4 });
  const growthAvailable = growthItems.length > 0;
  const growthValue = growthAvailable ? weightedAverage(growthItems) : 0;

  // Value: excluded (PEG needs market price)

  // Quality (full): margin + debt/equity
  const marginScore = ratios.operating_margin !== null
    ? scoreMetric("operatingMargin", ratios.operating_margin * 100)
    : 0;
  const debtScore = ratios.debt_to_equity !== null
    ? scoreMetric("debtToEquity", ratios.debt_to_equity)
    : 0;
  const qualityItems: { score: number; weight: number }[] = [];
  if (ratios.operating_margin !== null) qualityItems.push({ score: marginScore, weight: 0.5 });
  if (ratios.debt_to_equity !== null) qualityItems.push({ score: debtScore, weight: 0.5 });
  const qualityAvailable = qualityItems.length > 0;
  const qualityValue = qualityAvailable ? weightedAverage(qualityItems) : 0;

  const subScores: HistoricalSubScore[] = [
    { name: "growth", label: "Croissance", value: growthValue, weight: 0.4, available: growthAvailable },
    { name: "value", label: "Valeur (PEG)", value: 0, weight: 0.35, available: false },
    { name: "quality", label: "Qualité", value: qualityValue, weight: 0.25, available: qualityAvailable },
  ];

  const available = subScores.filter((s) => s.available);
  const totalAvailableWeight = available.reduce((acc, s) => acc + s.weight, 0);
  const total = totalAvailableWeight > 0
    ? Math.round(available.reduce((acc, s) => acc + s.value * s.weight, 0) / totalAvailableWeight)
    : 0;

  return {
    strategyId: "lynch",
    strategyLabel: "Peter Lynch",
    total,
    subScores,
    coverage: totalAvailableWeight,
    excludedSubScores: ["Valeur PEG (données de marché requises)"],
    isPartial: true,
  };
}

// --- Helpers ---

function scoreDividendGrowthFromSec(
  currentYear: number,
  allAnnuals: readonly SecAnnual[],
): number {
  const sorted = [...allAnnuals]
    .filter((a) => a.fiscal_year <= currentYear)
    .sort((a, b) => a.fiscal_year - b.fiscal_year);

  if (sorted.length < 2) return 50;

  let growingYears = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].fundamentals.dividends_paid;
    const curr = sorted[i].fundamentals.dividends_paid;
    if (prev !== null && curr !== null && curr > prev) {
      growingYears++;
    }
  }
  const ratio = growingYears / (sorted.length - 1);
  return Math.round(ratio * 100);
}

// --- Public API ---

export function computeHistoricalScores(
  data: SecTickerData,
): readonly HistoricalScorePoint[] {
  return data.annuals.map((annual) => ({
    fiscalYear: annual.fiscal_year,
    scores: [
      scoreBuffettHistorical(annual),
      scoreDividendHistorical(annual, data.annuals),
      scoreGrowthHistorical(annual),
      scoreLynchHistorical(annual),
    ],
  }));
}

export function getStrategyCoverage(strategyId: StrategyId): {
  label: string;
  coverage: string;
  excluded: readonly string[];
} {
  const configs: Record<StrategyId, { label: string; coverage: string; excluded: readonly string[] }> = {
    buffett: {
      label: "Historique fondamental Warren Buffett",
      coverage: "70%",
      excluded: ["Valorisation (PER — données de marché requises)"],
    },
    dividend: {
      label: "Historique fondamental Dividende",
      coverage: "52%",
      excluded: [
        "Rendement (dividend yield — données de marché requises)",
        "FCF coverage (capitalisation boursière requise)",
      ],
    },
    growth: {
      label: "Historique fondamental Growth",
      coverage: "75%",
      excluded: ["Potentiel de croissance (capitalisation boursière requise)"],
    },
    lynch: {
      label: "Historique fondamental Peter Lynch",
      coverage: "65%",
      excluded: ["Valeur PEG (données de marché requises)"],
    },
  };
  return configs[strategyId];
}
