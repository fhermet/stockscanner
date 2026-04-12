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
import type { MergedAnnual, MergedHistory } from "@/lib/data/merged-history";
import { scoreMetric, normalize, normalizeOptimalRange } from "./normalize";
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

// --- SEC fundamentals helpers ---

function computeRoicFromFundamentals(f: SecAnnual['fundamentals']): number | null {
  if (f.net_income === null) return null;
  const equity = f.shareholders_equity ?? 0;
  const debt = f.total_debt ?? 0;
  const investedCapital = equity + debt;
  if (investedCapital <= 0) return null;
  return f.net_income / investedCapital; // as a ratio (0.22 = 22%)
}

function computeDebtToOcfFromFundamentals(f: SecAnnual['fundamentals']): number | null {
  if (f.total_debt === null || f.operating_cash_flow === null || f.operating_cash_flow <= 0) return null;
  return f.total_debt / f.operating_cash_flow;
}

function computeRoicFromMerged(m: MergedAnnual): number | null {
  if (m.netIncome === null) return null;
  const equity = m.shareholdersEquity ?? 0;
  const debt = m.totalDebt ?? 0;
  const investedCapital = equity + debt;
  if (investedCapital <= 0) return null;
  return m.netIncome / investedCapital;
}

function computeDebtToOcfFromMerged(m: MergedAnnual): number | null {
  if (m.totalDebt === null || m.operatingCashFlow === null || m.operatingCashFlow <= 0) return null;
  return m.totalDebt / m.operatingCashFlow;
}

// --- Scoring per strategy ---

/**
 * Compute ROIC stability (std dev) over annuals up to currentYear.
 */
function computeRoicStability(
  currentYear: number,
  allAnnuals: readonly SecAnnual[],
): number | null {
  const recent = allAnnuals
    .filter((a) => a.fiscal_year <= currentYear)
    .slice(-5);
  const roicValues: number[] = [];
  for (const a of recent) {
    const r = computeRoicFromFundamentals(a.fundamentals);
    if (r !== null) roicValues.push(r * 100);
  }
  if (roicValues.length < 3) return null;
  const mean = roicValues.reduce((a, b) => a + b, 0) / roicValues.length;
  const variance = roicValues.reduce((a, v) => a + (v - mean) ** 2, 0) / roicValues.length;
  return Math.sqrt(variance);
}

/**
 * Compute revenue CAGR over annuals up to currentYear.
 */
function computeRevenueCagr(
  currentYear: number,
  allAnnuals: readonly SecAnnual[],
): number | null {
  const recent = allAnnuals
    .filter((a) => a.fiscal_year <= currentYear)
    .slice(-5);
  if (recent.length < 2) return null;
  const first = recent[0].fundamentals.revenue;
  const last = recent[recent.length - 1].fundamentals.revenue;
  if (first === null || first <= 0 || last === null || last <= 0) return null;
  const years = recent.length - 1;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

function scoreBuffettHistorical(
  annual: SecAnnual,
  allAnnuals: readonly SecAnnual[],
): HistoricalStrategyScore {
  const { ratios, fundamentals } = annual;

  // ===== Quality (35%) =====
  const roic = computeRoicFromFundamentals(fundamentals);
  const roicScore = roic !== null ? (scoreMetric("roic", roic * 100) ?? 0) : 0;
  const marginScore = ratios.operating_margin !== null
    ? (scoreMetric("operatingMargin", ratios.operating_margin * 100) ?? 0)
    : 0;

  // FCF Conversion: FCF / Net Income
  let fcfConvScore = 0;
  let fcfConvAvailable = false;
  if (fundamentals.net_income !== null && fundamentals.net_income > 0 && ratios.free_cash_flow !== null) {
    const conv = Math.min((ratios.free_cash_flow / fundamentals.net_income) * 100, 120);
    fcfConvScore = scoreMetric("fcfConversion", Math.max(0, conv)) ?? 0;
    fcfConvAvailable = true;
  } else if (fundamentals.net_income !== null && fundamentals.net_income <= 0) {
    fcfConvScore = 0;
    fcfConvAvailable = true;
  }

  // ROIC Stability
  const roicStab = computeRoicStability(annual.fiscal_year, allAnnuals);
  const roicStabScore = roicStab !== null ? (scoreMetric("roicStability", roicStab) ?? 0) : 0;

  const qualityItems: { score: number; weight: number }[] = [];
  if (roic !== null) qualityItems.push({ score: roicScore, weight: 0.3 });
  if (ratios.operating_margin !== null) qualityItems.push({ score: marginScore, weight: 0.25 });
  if (fcfConvAvailable) qualityItems.push({ score: fcfConvScore, weight: 0.2 });
  if (roicStab !== null) qualityItems.push({ score: roicStabScore, weight: 0.25 });
  const qualityAvailable = qualityItems.length > 0;
  const qualityValue = qualityAvailable ? weightedAverage(qualityItems) : 0;

  // ===== Strength (25%) =====
  const debtToOcf = computeDebtToOcfFromFundamentals(fundamentals);
  const debtScore = debtToOcf !== null ? (scoreMetric("debtToOcf", debtToOcf) ?? 0) : 0;
  // Interest coverage: not available in SEC data (no interest_expense field)
  const fcfPosScore = ratios.free_cash_flow !== null
    ? (ratios.free_cash_flow > 0 ? 100 : 10)
    : 0;

  const strengthItems: { score: number; weight: number }[] = [];
  if (debtToOcf !== null) strengthItems.push({ score: debtScore, weight: 0.5 });
  if (ratios.free_cash_flow !== null) strengthItems.push({ score: fcfPosScore, weight: 0.2 });
  const strengthAvailable = strengthItems.length > 0;
  const strengthValue = strengthAvailable ? weightedAverage(strengthItems) : 0;

  // ===== Valuation (25%): excluded without market price =====

  // ===== Durability (15%) =====
  const durRoicStabScore = roicStabScore;
  const cagr = computeRevenueCagr(annual.fiscal_year, allAnnuals);
  const cagrScore = cagr !== null ? (scoreMetric("revenueCagr", Math.max(0, cagr)) ?? 0) : 0;

  const durItems: { score: number; weight: number }[] = [];
  if (roicStab !== null) durItems.push({ score: durRoicStabScore, weight: 0.35 });
  if (cagr !== null) durItems.push({ score: cagrScore, weight: 0.65 });
  const durabilityAvailable = durItems.length > 0;
  const durabilityValue = durabilityAvailable ? weightedAverage(durItems) : 0;

  const subScores: HistoricalSubScore[] = [
    { name: "quality", label: "Qualité", value: qualityValue, weight: 0.35, available: qualityAvailable },
    { name: "strength", label: "Solidité financière", value: strengthValue, weight: 0.25, available: strengthAvailable },
    { name: "valuation", label: "Valorisation", value: 0, weight: 0.25, available: false },
    { name: "durability", label: "Durabilité", value: durabilityValue, weight: 0.15, available: durabilityAvailable },
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
    excludedSubScores: ["Valorisation (données de marché requises)"],
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

  // Stability (full): Debt/OCF + dividend growth from history
  const debtToOcf = computeDebtToOcfFromFundamentals(fundamentals);
  const debtScore = debtToOcf !== null
    ? (scoreMetric("debtToOcf", debtToOcf) ?? 0)
    : 0;

  const divGrowthScore = scoreDividendGrowthFromSec(annual.fiscal_year, allAnnuals);

  const stabilityItems: { score: number; weight: number }[] = [];
  if (debtToOcf !== null) stabilityItems.push({ score: debtScore, weight: 0.4 });
  stabilityItems.push({ score: divGrowthScore, weight: 0.6 });
  const stabilityAvailable = debtToOcf !== null;

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
  const { ratios, fundamentals } = annual;

  // Momentum (full): revenue growth + EPS growth
  const revScore = ratios.revenue_growth !== null
    ? (scoreMetric("revenueGrowth", ratios.revenue_growth * 100) ?? 0)
    : 0;
  const epsScore = ratios.eps_growth !== null
    ? (scoreMetric("epsGrowth", ratios.eps_growth * 100) ?? 0)
    : 0;
  const momentumItems: { score: number; weight: number }[] = [];
  if (ratios.revenue_growth !== null) momentumItems.push({ score: revScore, weight: 0.5 });
  if (ratios.eps_growth !== null) momentumItems.push({ score: epsScore, weight: 0.5 });
  const momentumAvailable = momentumItems.length > 0;
  const momentumValue = momentumAvailable ? weightedAverage(momentumItems) : 0;

  // Profitability (full): margin + ROIC
  const marginScore = ratios.operating_margin !== null
    ? (scoreMetric("operatingMargin", ratios.operating_margin * 100) ?? 0)
    : 0;
  const roic = computeRoicFromFundamentals(fundamentals);
  const roicScore = roic !== null ? (scoreMetric("roic", roic * 100) ?? 0) : 0;
  const profitItems: { score: number; weight: number }[] = [];
  if (ratios.operating_margin !== null) profitItems.push({ score: marginScore, weight: 0.5 });
  if (roic !== null) profitItems.push({ score: roicScore, weight: 0.5 });
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
  const { ratios, fundamentals } = annual;

  // Growth (full): EPS growth + revenue growth
  const epsScore = ratios.eps_growth !== null
    ? (scoreMetric("epsGrowth", ratios.eps_growth * 100) ?? 0)
    : 0;
  const revScore = ratios.revenue_growth !== null
    ? (scoreMetric("revenueGrowth", ratios.revenue_growth * 100) ?? 0)
    : 0;
  const growthItems: { score: number; weight: number }[] = [];
  if (ratios.eps_growth !== null) growthItems.push({ score: epsScore, weight: 0.6 });
  if (ratios.revenue_growth !== null) growthItems.push({ score: revScore, weight: 0.4 });
  const growthAvailable = growthItems.length > 0;
  const growthValue = growthAvailable ? weightedAverage(growthItems) : 0;

  // Value: excluded (PEG needs market price)

  // Quality (full): margin + Debt/OCF
  const marginScore = ratios.operating_margin !== null
    ? (scoreMetric("operatingMargin", ratios.operating_margin * 100) ?? 0)
    : 0;
  const debtToOcf = computeDebtToOcfFromFundamentals(fundamentals);
  const debtScore = debtToOcf !== null
    ? (scoreMetric("debtToOcf", debtToOcf) ?? 0)
    : 0;
  const qualityItems: { score: number; weight: number }[] = [];
  if (ratios.operating_margin !== null) qualityItems.push({ score: marginScore, weight: 0.5 });
  if (debtToOcf !== null) qualityItems.push({ score: debtScore, weight: 0.5 });
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
      scoreBuffettHistorical(annual, data.annuals),
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
      coverage: "75%",
      excluded: ["Valorisation (PER + EV/EBIT + P/FCF — données de marché requises)"],
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

// =============================================================================
// FULL HISTORICAL SCORING (SEC + Yahoo prices)
// =============================================================================

function computeRoicStabilityFromMerged(
  currentYear: number,
  allAnnuals: readonly MergedAnnual[],
): number | null {
  const recent = allAnnuals.filter((a) => a.fiscalYear <= currentYear).slice(-5);
  const roicValues: number[] = [];
  for (const a of recent) {
    const r = computeRoicFromMerged(a);
    if (r !== null) roicValues.push(r * 100);
  }
  if (roicValues.length < 3) return null;
  const mean = roicValues.reduce((a, b) => a + b, 0) / roicValues.length;
  const variance = roicValues.reduce((a, v) => a + (v - mean) ** 2, 0) / roicValues.length;
  return Math.sqrt(variance);
}

function computeRevenueCagrFromMerged(
  currentYear: number,
  allAnnuals: readonly MergedAnnual[],
): number | null {
  const recent = allAnnuals.filter((a) => a.fiscalYear <= currentYear).slice(-5);
  if (recent.length < 2) return null;
  const first = recent[0].revenue;
  const last = recent[recent.length - 1].revenue;
  if (first === null || first <= 0 || last === null || last <= 0) return null;
  const years = recent.length - 1;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

function scoreBuffettFull(m: MergedAnnual, allAnnuals: readonly MergedAnnual[]): HistoricalStrategyScore {
  // ===== Quality (35%) =====
  const roic = computeRoicFromMerged(m);
  const roicScore = roic !== null ? (scoreMetric("roic", roic * 100) ?? 0) : 0;
  const marginScore = m.operatingMargin !== null ? (scoreMetric("operatingMargin", m.operatingMargin * 100) ?? 0) : 0;

  // FCF Conversion
  let fcfConvScore = 0;
  let fcfConvAvail = false;
  if (m.netIncome !== null && m.netIncome > 0 && m.freeCashFlow !== null) {
    const conv = Math.min((m.freeCashFlow / m.netIncome) * 100, 120);
    fcfConvScore = scoreMetric("fcfConversion", Math.max(0, conv)) ?? 0;
    fcfConvAvail = true;
  } else if (m.netIncome !== null && m.netIncome <= 0) {
    fcfConvScore = 0;
    fcfConvAvail = true;
  }

  // ROIC Stability
  const roicStab = computeRoicStabilityFromMerged(m.fiscalYear, allAnnuals);
  const roicStabScore = roicStab !== null ? (scoreMetric("roicStability", roicStab) ?? 0) : 0;

  const qualityItems: { score: number; weight: number }[] = [];
  if (roic !== null) qualityItems.push({ score: roicScore, weight: 0.3 });
  if (m.operatingMargin !== null) qualityItems.push({ score: marginScore, weight: 0.25 });
  if (fcfConvAvail) qualityItems.push({ score: fcfConvScore, weight: 0.2 });
  if (roicStab !== null) qualityItems.push({ score: roicStabScore, weight: 0.25 });
  const qualityAvailable = qualityItems.length > 0;
  const qualityValue = qualityAvailable ? weightedAverage(qualityItems) : 0;

  // ===== Strength (25%) =====
  const debtToOcf = computeDebtToOcfFromMerged(m);
  const debtScore = debtToOcf !== null ? (scoreMetric("debtToOcf", debtToOcf) ?? 0) : 0;
  const fcfPosScore = m.freeCashFlow !== null ? (m.freeCashFlow > 0 ? 100 : 10) : 0;

  // Interest Coverage from merged data
  let icScore = 0;
  let icAvail = false;
  if (m.operatingIncome !== null && m.interestExpense !== null && m.interestExpense > 0) {
    const ic = m.operatingIncome / m.interestExpense;
    icScore = ic >= 20 ? 100 : ic <= 0 ? 0 : (scoreMetric("interestCoverage", ic) ?? 0);
    icAvail = true;
  } else if (m.operatingIncome !== null && m.operatingIncome > 0 &&
             (m.interestExpense === null || m.interestExpense === 0)) {
    icScore = 100; // no debt cost
    icAvail = true;
  }

  const strengthItems: { score: number; weight: number }[] = [];
  if (debtToOcf !== null) strengthItems.push({ score: debtScore, weight: 0.5 });
  if (icAvail) strengthItems.push({ score: icScore, weight: 0.3 });
  if (m.freeCashFlow !== null) strengthItems.push({ score: fcfPosScore, weight: 0.2 });
  const strengthAvailable = strengthItems.length > 0;
  const strengthValue = strengthAvailable ? weightedAverage(strengthItems) : 0;

  // ===== Valuation (25%): PER + EV/EBIT + P/FCF =====
  const perScore = m.per !== null ? (scoreMetric("per", m.per) ?? 0) : 0;
  // EV/EBIT and P/FCF: computed from merged data if available
  let evEbitScore = 0;
  let evEbitAvail = false;
  if (m.marketCap !== null && m.totalDebt !== null && m.operatingIncome !== null && m.operatingIncome > 0) {
    const ev = m.marketCap + (m.totalDebt ?? 0); // simplified EV
    const evToEbit = ev / m.operatingIncome;
    evEbitScore = scoreMetric("evToEbit", evToEbit) ?? 0;
    evEbitAvail = true;
  }
  let pFcfScore = 0;
  let pFcfAvail = false;
  if (m.marketCap !== null && m.freeCashFlow !== null && m.freeCashFlow > 0) {
    const pToFcf = m.marketCap / m.freeCashFlow;
    pFcfScore = scoreMetric("priceToFcf", pToFcf) ?? 0;
    pFcfAvail = true;
  }

  const valItems: { score: number; weight: number }[] = [];
  if (m.per !== null) valItems.push({ score: perScore, weight: 0.5 });
  if (evEbitAvail) valItems.push({ score: evEbitScore, weight: 0.3 });
  if (pFcfAvail) valItems.push({ score: pFcfScore, weight: 0.2 });
  const valuationAvailable = valItems.length > 0;
  const valuationValue = valuationAvailable ? weightedAverage(valItems) : 0;

  // ===== Durability (15%) =====
  const cagr = computeRevenueCagrFromMerged(m.fiscalYear, allAnnuals);
  const cagrScore = cagr !== null ? (scoreMetric("revenueCagr", Math.max(0, cagr)) ?? 0) : 0;
  const durItems: { score: number; weight: number }[] = [];
  if (roicStab !== null) durItems.push({ score: roicStabScore, weight: 0.35 });
  if (cagr !== null) durItems.push({ score: cagrScore, weight: 0.65 });
  const durabilityAvailable = durItems.length > 0;
  const durabilityValue = durabilityAvailable ? weightedAverage(durItems) : 0;

  const subScores: HistoricalSubScore[] = [
    { name: "quality", label: "Qualité", value: qualityValue, weight: 0.35, available: qualityAvailable },
    { name: "strength", label: "Solidité financière", value: strengthValue, weight: 0.25, available: strengthAvailable },
    { name: "valuation", label: "Valorisation", value: valuationValue, weight: 0.25, available: valuationAvailable },
    { name: "durability", label: "Durabilité", value: durabilityValue, weight: 0.15, available: durabilityAvailable },
  ];

  const available = subScores.filter((s) => s.available);
  const totalAvailableWeight = available.reduce((acc, s) => acc + s.weight, 0);
  const total = totalAvailableWeight > 0
    ? Math.round(available.reduce((acc, s) => acc + s.value * s.weight, 0) / totalAvailableWeight)
    : 0;

  const excluded = subScores.filter((s) => !s.available).map((s) => s.label);

  return {
    strategyId: "buffett",
    strategyLabel: "Warren Buffett",
    total,
    subScores,
    coverage: totalAvailableWeight,
    excludedSubScores: excluded,
    isPartial: totalAvailableWeight < 0.99,
  };
}

function scoreDividendFull(m: MergedAnnual, allAnnuals: readonly MergedAnnual[]): HistoricalStrategyScore {
  // Yield
  const yieldScore = m.dividendYield !== null ? (scoreMetric("dividendYield", m.dividendYield) ?? 0) : 0;
  const yieldAvailable = m.dividendYield !== null;

  // Sustainability: payout + FCF coverage
  const payoutScore = m.payoutRatio !== null ? normalizeOptimalRange(m.payoutRatio * 100, 30, 60, 0, 100) : 0;

  let fcfCoverageScore = 0;
  if (m.dividendYield !== null && m.dividendYield > 0 && m.marketCap !== null && m.marketCap > 0 && m.freeCashFlow !== null) {
    const dividendCost = m.marketCap * (m.dividendYield / 100);
    if (dividendCost > 0) {
      const coverage = m.freeCashFlow / dividendCost;
      if (coverage >= 2.5) fcfCoverageScore = 100;
      else if (coverage >= 1.5) fcfCoverageScore = 80;
      else if (coverage >= 1.0) fcfCoverageScore = 55;
      else if (coverage >= 0.5) fcfCoverageScore = 25;
      else fcfCoverageScore = 5;
    }
  }

  const sustainItems: { score: number; weight: number }[] = [];
  if (m.payoutRatio !== null) sustainItems.push({ score: payoutScore, weight: 0.5 });
  if (m.dividendYield !== null && m.freeCashFlow !== null && m.marketCap !== null) {
    sustainItems.push({ score: fcfCoverageScore, weight: 0.5 });
  }
  const sustainAvailable = sustainItems.length > 0;
  const sustainValue = sustainAvailable ? weightedAverage(sustainItems) : 0;

  // Stability: Debt/OCF + dividend growth
  const debtToOcf = computeDebtToOcfFromMerged(m);
  const debtScore = debtToOcf !== null ? (scoreMetric("debtToOcf", debtToOcf) ?? 0) : 0;
  const divGrowth = scoreDividendGrowthFromMerged(m.fiscalYear, allAnnuals);
  const stabilityItems: { score: number; weight: number }[] = [];
  if (debtToOcf !== null) stabilityItems.push({ score: debtScore, weight: 0.4 });
  stabilityItems.push({ score: divGrowth, weight: 0.6 });
  const stabilityAvailable = debtToOcf !== null;
  const stabilityValue = weightedAverage(stabilityItems);

  const subScores: HistoricalSubScore[] = [
    { name: "yield", label: "Rendement", value: yieldScore, weight: 0.3, available: yieldAvailable },
    { name: "sustainability", label: "Soutenabilité", value: sustainValue, weight: 0.35, available: sustainAvailable },
    { name: "stability", label: "Stabilité", value: stabilityValue, weight: 0.35, available: stabilityAvailable },
  ];

  const available = subScores.filter((s) => s.available);
  const totalAvailableWeight = available.reduce((acc, s) => acc + s.weight, 0);
  const total = totalAvailableWeight > 0
    ? Math.round(available.reduce((acc, s) => acc + s.value * s.weight, 0) / totalAvailableWeight)
    : 0;

  const excluded = subScores.filter((s) => !s.available).map((s) => s.label);

  return {
    strategyId: "dividend",
    strategyLabel: "Dividende",
    total,
    subScores,
    coverage: totalAvailableWeight,
    excludedSubScores: excluded,
    isPartial: totalAvailableWeight < 0.99,
  };
}

function scoreGrowthFull(m: MergedAnnual): HistoricalStrategyScore {
  // Momentum: revenue growth + EPS growth
  const revScore = m.revenueGrowth !== null ? (scoreMetric("revenueGrowth", m.revenueGrowth * 100) ?? 0) : 0;
  const epsScore = m.epsGrowth !== null ? (scoreMetric("epsGrowth", m.epsGrowth * 100) ?? 0) : 0;
  const momentumItems: { score: number; weight: number }[] = [];
  if (m.revenueGrowth !== null) momentumItems.push({ score: revScore, weight: 0.5 });
  if (m.epsGrowth !== null) momentumItems.push({ score: epsScore, weight: 0.5 });
  const momentumAvailable = momentumItems.length > 0;
  const momentumValue = momentumAvailable ? weightedAverage(momentumItems) : 0;

  // Profitability: margin + ROIC
  const marginScore = m.operatingMargin !== null ? (scoreMetric("operatingMargin", m.operatingMargin * 100) ?? 0) : 0;
  const roic = computeRoicFromMerged(m);
  const roicScore = roic !== null ? (scoreMetric("roic", roic * 100) ?? 0) : 0;
  const profitItems: { score: number; weight: number }[] = [];
  if (m.operatingMargin !== null) profitItems.push({ score: marginScore, weight: 0.5 });
  if (roic !== null) profitItems.push({ score: roicScore, weight: 0.5 });
  const profitAvailable = profitItems.length > 0;
  const profitValue = profitAvailable ? weightedAverage(profitItems) : 0;

  // Scalability: marketCap (inverted: small = better)
  const scaleScore = m.marketCap !== null ? normalize(m.marketCap / 1e9, { min: 3000, max: 10 }) : 0;
  const scaleAvailable = m.marketCap !== null;

  const subScores: HistoricalSubScore[] = [
    { name: "momentum", label: "Momentum de croissance", value: momentumValue, weight: 0.5, available: momentumAvailable },
    { name: "profitability", label: "Rentabilité", value: profitValue, weight: 0.25, available: profitAvailable },
    { name: "scalability", label: "Potentiel de croissance", value: scaleScore, weight: 0.25, available: scaleAvailable },
  ];

  const available = subScores.filter((s) => s.available);
  const totalAvailableWeight = available.reduce((acc, s) => acc + s.weight, 0);
  const total = totalAvailableWeight > 0
    ? Math.round(available.reduce((acc, s) => acc + s.value * s.weight, 0) / totalAvailableWeight)
    : 0;

  const excluded = subScores.filter((s) => !s.available).map((s) => s.label);

  return {
    strategyId: "growth",
    strategyLabel: "Growth",
    total,
    subScores,
    coverage: totalAvailableWeight,
    excludedSubScores: excluded,
    isPartial: totalAvailableWeight < 0.99,
  };
}

function scoreLynchFull(m: MergedAnnual): HistoricalStrategyScore {
  // Growth: EPS growth + revenue growth
  const epsScore = m.epsGrowth !== null ? (scoreMetric("epsGrowth", m.epsGrowth * 100) ?? 0) : 0;
  const revScore = m.revenueGrowth !== null ? (scoreMetric("revenueGrowth", m.revenueGrowth * 100) ?? 0) : 0;
  const growthItems: { score: number; weight: number }[] = [];
  if (m.epsGrowth !== null) growthItems.push({ score: epsScore, weight: 0.6 });
  if (m.revenueGrowth !== null) growthItems.push({ score: revScore, weight: 0.4 });
  const growthAvailable = growthItems.length > 0;
  const growthValue = growthAvailable ? weightedAverage(growthItems) : 0;

  // Value: PEG
  const pegScore = m.peg !== null ? (scoreMetric("peg", m.peg) ?? 0) : 0;
  const valueAvailable = m.peg !== null;

  // Quality: margin + Debt/OCF
  const marginScore = m.operatingMargin !== null ? (scoreMetric("operatingMargin", m.operatingMargin * 100) ?? 0) : 0;
  const debtToOcf = computeDebtToOcfFromMerged(m);
  const debtScore = debtToOcf !== null ? (scoreMetric("debtToOcf", debtToOcf) ?? 0) : 0;
  const qualityItems: { score: number; weight: number }[] = [];
  if (m.operatingMargin !== null) qualityItems.push({ score: marginScore, weight: 0.5 });
  if (debtToOcf !== null) qualityItems.push({ score: debtScore, weight: 0.5 });
  const qualityAvailable = qualityItems.length > 0;
  const qualityValue = qualityAvailable ? weightedAverage(qualityItems) : 0;

  const subScores: HistoricalSubScore[] = [
    { name: "growth", label: "Croissance", value: growthValue, weight: 0.4, available: growthAvailable },
    { name: "value", label: "Valeur (PEG)", value: pegScore, weight: 0.35, available: valueAvailable },
    { name: "quality", label: "Qualité", value: qualityValue, weight: 0.25, available: qualityAvailable },
  ];

  const available = subScores.filter((s) => s.available);
  const totalAvailableWeight = available.reduce((acc, s) => acc + s.weight, 0);
  const total = totalAvailableWeight > 0
    ? Math.round(available.reduce((acc, s) => acc + s.value * s.weight, 0) / totalAvailableWeight)
    : 0;

  const excluded = subScores.filter((s) => !s.available).map((s) => s.label);

  return {
    strategyId: "lynch",
    strategyLabel: "Peter Lynch",
    total,
    subScores,
    coverage: totalAvailableWeight,
    excludedSubScores: excluded,
    isPartial: totalAvailableWeight < 0.99,
  };
}

function scoreDividendGrowthFromMerged(
  currentYear: number,
  allAnnuals: readonly MergedAnnual[],
): number {
  const sorted = [...allAnnuals]
    .filter((a) => a.fiscalYear <= currentYear)
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  if (sorted.length < 2) return 50;

  let growingYears = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].dividendsPaid;
    const curr = sorted[i].dividendsPaid;
    if (prev !== null && curr !== null && curr > prev) {
      growingYears++;
    }
  }
  return Math.round((growingYears / (sorted.length - 1)) * 100);
}

/**
 * Compute full historical scores using merged SEC + Yahoo data.
 * Falls back to SEC-only scoring for years without price data.
 */
export function computeFullHistoricalScores(
  merged: MergedHistory,
): readonly HistoricalScorePoint[] {
  return merged.annuals.map((m) => ({
    fiscalYear: m.fiscalYear,
    scores: [
      scoreBuffettFull(m, merged.annuals),
      scoreDividendFull(m, merged.annuals),
      scoreGrowthFull(m),
      scoreLynchFull(m),
    ],
  }));
}
