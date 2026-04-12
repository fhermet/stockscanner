/**
 * Generate human-readable explanations for N/A scores.
 *
 * When a stock's score is null, the dataCompleteness.missing array
 * tells us WHICH metrics are absent. This module translates those
 * raw field names into contextual messages explaining WHY and WHAT
 * it means for the investor.
 */

import type { Stock, StrategyId, DataCompleteness } from "../types";

export interface NaReason {
  readonly summary: string;
  readonly detail: string;
}

/**
 * Returns a human-readable explanation of why a score is N/A.
 * Returns null if the score is not N/A (missing is empty).
 */
export function explainNa(
  stock: Stock,
  strategyId: StrategyId,
  completeness: DataCompleteness,
): NaReason | null {
  if (completeness.missing.length === 0) return null;

  const missing = new Set(completeness.missing);

  // --- Most common: PER null because EPS <= 0 (company in loss) ---
  if (missing.has("PER")) {
    if (stock.per === null) {
      return {
        summary: "Entreprise en perte ou EPS indisponible",
        detail:
          "Le PER (Price/Earnings Ratio) n'est pas calculable car le benefice par action (EPS) est negatif ou absent. " +
          "Une entreprise qui perd de l'argent ne peut pas etre evaluee sur sa valorisation.",
      };
    }
  }

  // --- ROIC null (invested capital <= 0) ---
  if (missing.has("ROIC")) {
    return {
      summary: "Rentabilite du capital non calculable",
      detail:
        "Le ROIC (Return on Invested Capital) n'est pas calculable car le capital investi " +
        "(fonds propres + dette) est negatif ou nul. Cas rare, souvent lie a une restructuration majeure.",
    };
  }

  // --- Debt/OCF for non-finance ---
  if (missing.has("dette/cash-flow")) {
    return {
      summary: "Ratio d'endettement non calculable",
      detail:
        "Le ratio Dette/Cash-flow operationnel n'est pas disponible. " +
        "Le cash-flow operationnel est negatif ou la donnee de dette est absente dans les filings SEC.",
    };
  }

  // --- Growth metrics missing ---
  if (missing.has("PEG")) {
    return {
      summary: "PEG non calculable",
      detail:
        "Le ratio PEG (Price/Earnings-to-Growth) necessite un PER valide et une croissance des benefices positive. " +
        "L'un ou l'autre est absent ou negatif.",
    };
  }

  if (missing.has("croissance EPS") || missing.has("croissance CA")) {
    return {
      summary: "Donnees de croissance insuffisantes",
      detail:
        "La croissance du chiffre d'affaires ou des benefices n'est pas disponible. " +
        "Cela peut arriver pour les entreprises recemment introduites en bourse ou dont les filings SEC sont incomplets.",
    };
  }

  // --- Dividend metrics ---
  if (missing.has("rendement dividende")) {
    return {
      summary: "Pas de dividende verse",
      detail:
        "Cette entreprise ne verse pas de dividende ou le rendement n'est pas disponible. " +
        "La strategie Dividende ne peut pas evaluer une action sans historique de distribution.",
    };
  }

  if (missing.has("historique dividende")) {
    return {
      summary: "Historique de dividende insuffisant",
      detail:
        "Moins de 2 annees d'historique de dividende sont disponibles dans les donnees SEC. " +
        "La croissance du dividende ne peut pas etre evaluee.",
    };
  }

  // --- Operating margin ---
  if (missing.has("marge operationnelle")) {
    return {
      summary: "Marge operationnelle indisponible",
      detail:
        "Le resultat operationnel ou le chiffre d'affaires n'est pas disponible dans les filings SEC. " +
        "Frequent pour les REITs, banques et certains conglomerats dont la structure de reporting est atypique.",
    };
  }

  // --- Interest coverage ---
  if (missing.has("interest coverage")) {
    return {
      summary: "Couverture des interets non calculable",
      detail:
        "Le ratio de couverture des interets (EBIT / charges d'interets) n'est pas disponible. " +
        "Les charges d'interets ne sont pas presentes dans les donnees SEC actuelles.",
    };
  }

  // --- EV/EBIT ---
  if (missing.has("EV/EBIT")) {
    return {
      summary: "EV/EBIT non calculable",
      detail:
        "Le ratio Enterprise Value / EBIT n'est pas calculable. " +
        "La valeur d'entreprise ou le resultat operationnel est absent.",
    };
  }

  // --- Generic fallback ---
  const missingList = completeness.missing.join(", ");
  return {
    summary: `${completeness.missing.length} metrique(s) manquante(s)`,
    detail: `Les donnees suivantes sont absentes : ${missingList}. Le score ne peut pas etre calcule de maniere fiable.`,
  };
}
