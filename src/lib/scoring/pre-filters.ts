/**
 * Pre-filtres pour la strategie Buffett v2.
 *
 * Toute action qui echoue a un pre-filtre est exclue avant scoring.
 * Le score total est mis a null avec une explication claire.
 *
 * Pre-filtres :
 *   A. Croissance minimale — CA non-decroissant sur 5 ans
 *      Tolerance si FCF en forte amelioration
 *   B. Rentabilite minimale — ROIC moyen 5 ans > seuil (defaut 6%)
 *      + marge operationnelle positive
 *   C. Cash flow — FCF positif sur au moins 3 des 5 dernieres annees
 *   D. Dette — Debt/OCF <= seuil (defaut 10x), au-dela l'entreprise
 *      est un zombie financier
 */

import type { Stock } from "../types";

export interface PreFilterConfig {
  /** Minimum average ROIC over 5 years (percentage). Default: 6 */
  readonly minRoicAvg5y: number;
  /** Minimum positive FCF years out of available (0-5). Default: 3 */
  readonly minFcfPositiveYears: number;
  /** Maximum Debt/OCF ratio (years to repay). Default: 10 */
  readonly maxDebtToOcf: number;
}

export const DEFAULT_PRE_FILTER_CONFIG: PreFilterConfig = {
  minRoicAvg5y: 6,
  minFcfPositiveYears: 3,
  maxDebtToOcf: 10,
};

export interface PreFilterResult {
  readonly passed: boolean;
  readonly failedReasons: readonly string[];
}

/**
 * Check if revenue is non-declining over the available history (up to 5 years).
 * Tolerance: if FCF positive years >= 4 (strong FCF improvement), allow minor decline.
 */
function checkRevenueNonDeclining(stock: Stock): string | null {
  const hist = stock.history;
  if (hist.length < 2) return null; // Insufficient data: pass (don't penalize)

  const recent = hist.slice(-5); // last 5 years
  let declined = false;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].revenue < recent[i - 1].revenue * 0.95) {
      // Allow 5% tolerance for rounding/FX, but flag real decline
      declined = true;
      break;
    }
  }

  if (!declined) return null;

  // Tolerance: FCF in strong improvement (>= 4 positive years)
  const fcfYears = stock.fcfPositiveYears ?? 0;
  if (fcfYears >= 4) return null;

  return "Chiffre d'affaires en declin sur 5 ans (sans amelioration FCF compensatoire)";
}

/**
 * Check minimum average ROIC over 5 years.
 */
function checkMinRoicAvg(stock: Stock, config: PreFilterConfig): string | null {
  const roicAvg = stock.roicAvg5y ?? null;
  if (roicAvg === null) return null; // No data: pass (don't exclude for missing data)
  if (roicAvg >= config.minRoicAvg5y) return null;
  return `ROIC moyen 5 ans trop faible (${roicAvg.toFixed(1)}% < ${config.minRoicAvg5y}%)`;
}

/**
 * Check operating margin is positive.
 */
function checkMarginPositive(stock: Stock): string | null {
  if (stock.operatingMargin === null) return null; // No data: pass
  if (stock.operatingMargin > 0) return null;
  return `Marge operationnelle negative (${stock.operatingMargin}%)`;
}

/**
 * Check FCF positive on at least N of the last 5 years.
 */
function checkFcfPositiveYears(stock: Stock, config: PreFilterConfig): string | null {
  const years = stock.fcfPositiveYears ?? 0;
  // If we have no historical data, only check current FCF
  if (stock.fcfPositiveYears === undefined) {
    if (stock.freeCashFlow === null) return null; // No data: pass
    if (stock.freeCashFlow > 0) return null;
    return "Free Cash Flow negatif (donnees historiques indisponibles)";
  }
  if (years >= config.minFcfPositiveYears) return null;
  return `FCF positif ${years}/5 ans (minimum requis : ${config.minFcfPositiveYears}/5)`;
}

/**
 * Check Debt/OCF is not excessively high (zombie filter).
 * Negative Debt/OCF (negative OCF) also fails.
 */
function checkDebtToOcf(stock: Stock, config: PreFilterConfig): string | null {
  const ratio = stock.debtToOcf;
  if (ratio === null) return null; // No data: pass
  if (ratio < 0) {
    return "Flux operationnel negatif (Debt/OCF negatif)";
  }
  if (ratio > config.maxDebtToOcf) {
    return `Endettement excessif : Debt/OCF ${ratio.toFixed(1)}x (max ${config.maxDebtToOcf}x)`;
  }
  return null;
}

/**
 * Run all pre-filters for Buffett strategy.
 * Returns passed=true if the stock qualifies, or a list of failure reasons.
 */
export function applyBuffettPreFilters(
  stock: Stock,
  config: PreFilterConfig = DEFAULT_PRE_FILTER_CONFIG,
): PreFilterResult {
  const checks = [
    checkRevenueNonDeclining(stock),
    checkMinRoicAvg(stock, config),
    checkMarginPositive(stock),
    checkFcfPositiveYears(stock, config),
    checkDebtToOcf(stock, config),
  ];

  const failedReasons = checks.filter((r): r is string => r !== null);

  return {
    passed: failedReasons.length === 0,
    failedReasons,
  };
}
