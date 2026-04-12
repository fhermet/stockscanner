import { Stock, SubScore } from "../../types";
import { StrategyScorer, registerStrategy } from "../engine";
import { scoreMetric } from "../normalize";
import { weightedAverageSkipNull, adjustForSector } from "../utils";
import { getSectorBenchmark, sectorAdjustmentFactor } from "../sector-benchmarks";

/**
 * Strategie Buffett v2 : Qualite + Solidite + Valorisation + Durabilite
 *
 * Score = Qualite x 35% + Solidite x 25% + Valorisation x 25% + Durabilite x 15%
 *
 * Chaque sous-score est normalise 0-100 via interpolation lineaire.
 * Les metriques sectorielles sont ajustees par rapport a la mediane du secteur.
 * Les metriques de valorisation combinent ajustement sectoriel + historique 5 ans.
 *
 * Changements cles vs v1 :
 *   - Qualite : FCF Yield remplace par FCF/NI (cash conversion) + Stabilite ROIC
 *   - Solidite : ajout Interest Coverage
 *   - Valorisation : PER seul remplace par PER + EV/EBIT + Price/FCF, chacun
 *     ajuste secteur + historique propre 5 ans
 *   - Nouveau bloc Durabilite : stabilite ROIC + croissance CA
 *   - ROIC normalise 0-40% (vs 0-30% avant)
 */

// --- Helpers for valuation with sector + historical adjustment ---

/**
 * Compute a valuation score as average of:
 *  1. sector-adjusted score (relative to sector median)
 *  2. history-adjusted score (relative to own 5yr average)
 *
 * If 5yr average is unavailable, uses sector-adjusted score only.
 */
function valuationScoreWithHistory(
  rawValue: number,
  metricKey: "per" | "evToEbit" | "priceToFcf",
  rangeKey: "per" | "evToEbit" | "priceToFcf",
  stock: Stock,
  avg5y: number | null | undefined,
): number | null {
  const rawScore = scoreMetric(rangeKey, rawValue);
  if (rawScore === null) return null;

  // 1. Sector-adjusted score
  const benchmark = getSectorBenchmark(stock.sector);
  const sectorMedian = benchmark[metricKey];
  const sectorFactor = sectorAdjustmentFactor(rawValue, sectorMedian, true);
  const sectorScore = Math.round(Math.max(0, Math.min(100, rawScore * sectorFactor)));

  // 2. History-adjusted score (compare to own 5yr average)
  if (avg5y != null && avg5y > 0) {
    const histFactor = sectorAdjustmentFactor(rawValue, avg5y, true);
    const histScore = Math.round(Math.max(0, Math.min(100, rawScore * histFactor)));
    return Math.round((sectorScore + histScore) / 2);
  }

  // No historical data: use sector-adjusted only
  return sectorScore;
}

const buffettScorer: StrategyScorer = {
  id: "buffett",

  score(stock: Stock): SubScore[] {
    // =============================================
    // QUALITE (35%) — profitability & cash generation
    // =============================================
    // ROIC (30% of quality) — range 0-40%, cap at 40%
    const roicScore = scoreMetric("roic", stock.roic);

    // Operating margin (25% of quality) — sector-adjusted
    const marginRaw = scoreMetric("operatingMargin", stock.operatingMargin);
    const marginScore = marginRaw !== null
      ? adjustForSector(marginRaw, stock, "operatingMargin", stock.operatingMargin!)
      : null;

    // FCF Conversion (20% of quality) — FCF / Net Income
    let fcfConversionScore: number | null = null;
    const netIncome = stock.netIncome ?? null;
    const fcf = stock.freeCashFlow;
    if (netIncome != null && netIncome > 0 && fcf !== null) {
      const conversionPct = (fcf / netIncome) * 100;
      // Cap at 120% to avoid extreme values (e.g. large D&A generating FCF > NI)
      const capped = Math.min(conversionPct, 120);
      fcfConversionScore = scoreMetric("fcfConversion", Math.max(0, capped));
    } else if (netIncome != null && netIncome <= 0) {
      // Net income negative: conservative score of 0
      fcfConversionScore = 0;
    }

    // ROIC Stability (25% of quality) — low std dev = good
    const roicStab = stock.roicStability ?? null;
    const roicStabilityScore = roicStab !== null
      ? scoreMetric("roicStability", roicStab)
      : null;

    const qualityValue = weightedAverageSkipNull([
      { score: roicScore, weight: 0.3 },
      { score: marginScore, weight: 0.25 },
      { score: fcfConversionScore, weight: 0.2 },
      { score: roicStabilityScore, weight: 0.25 },
    ]);

    // =============================================
    // SOLIDITE FINANCIERE (25%) — ability to survive cycles
    // =============================================
    // Debt/OCF (50% of strength) — years to repay
    const debtOcfScore = scoreMetric("debtToOcf", stock.debtToOcf);

    // Interest Coverage (30% of strength) — EBIT / interest expense
    let interestCovScore: number | null = null;
    const ic = stock.interestCoverage ?? null;
    if (ic !== null) {
      if (ic >= 20) {
        interestCovScore = 100; // Cap at 20x
      } else if (ic <= 0) {
        interestCovScore = 0; // EBIT negative
      } else {
        interestCovScore = scoreMetric("interestCoverage", ic);
      }
    }

    // FCF positive (20% of strength) — binary signal
    const fcfPosScore = stock.freeCashFlow !== null
      ? (stock.freeCashFlow > 0 ? 100 : 10)
      : null;

    const strengthValue = weightedAverageSkipNull([
      { score: debtOcfScore, weight: 0.5 },
      { score: interestCovScore, weight: 0.3 },
      { score: fcfPosScore, weight: 0.2 },
    ]);

    // =============================================
    // VALORISATION (25%) — price paid for the asset
    // =============================================
    // PER (50% of valuation) — sector + historical 5yr
    const perValue = stock.per;
    const perScore = perValue !== null
      ? valuationScoreWithHistory(perValue, "per", "per", stock, stock.perAvg5y)
      : null;

    // EV/EBIT (30% of valuation) — sector + historical 5yr
    const evEbitValue = stock.evToEbit ?? null;
    const evEbitScore = evEbitValue !== null
      ? valuationScoreWithHistory(evEbitValue, "evToEbit", "evToEbit", stock, stock.evToEbitAvg5y)
      : null;

    // Price/FCF (20% of valuation) — sector + historical 5yr
    let priceToFcfValue: number | null = null;
    if (stock.freeCashFlow !== null && stock.freeCashFlow > 0 && stock.marketCap > 0) {
      priceToFcfValue = stock.marketCap / stock.freeCashFlow;
    }
    const priceToFcfScore = priceToFcfValue !== null
      ? valuationScoreWithHistory(priceToFcfValue, "priceToFcf", "priceToFcf", stock, stock.priceToFcfAvg5y)
      : null;

    const valuationValue = weightedAverageSkipNull([
      { score: perScore, weight: 0.5 },
      { score: evEbitScore, weight: 0.3 },
      { score: priceToFcfScore, weight: 0.2 },
    ]);

    // =============================================
    // DURABILITE (15%) — long-term predictability
    // =============================================
    // ROIC Stability (35% of durability) — reuse same metric from quality
    const durabilityRoicStabScore = roicStabilityScore;

    // Revenue CAGR 5yr (65% of durability)
    const cagr = stock.revenueCagr5y ?? null;
    let revenueCagrScore: number | null = null;
    if (cagr !== null) {
      revenueCagrScore = scoreMetric("revenueCagr", Math.max(0, cagr));
    }

    const durabilityValue = weightedAverageSkipNull([
      { score: durabilityRoicStabScore, weight: 0.35 },
      { score: revenueCagrScore, weight: 0.65 },
    ]);

    return [
      { name: "quality", value: qualityValue, weight: 0.35, label: "Qualite" },
      { name: "strength", value: strengthValue, weight: 0.25, label: "Solidite financiere" },
      { name: "valuation", value: valuationValue, weight: 0.25, label: "Valorisation" },
      { name: "durability", value: durabilityValue, weight: 0.15, label: "Durabilite" },
    ];
  },
};

registerStrategy(buffettScorer);
