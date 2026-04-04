/**
 * Normalisation des metriques pour le scoring.
 *
 * Remplace les seuils absolus par une interpolation lineaire
 * entre un min (score 0) et un max (score 100), avec clamp.
 *
 * Pour les metriques inversees (dette, PER) ou l'on veut
 * qu'une valeur basse = bon score, on inverse min/max.
 */

interface NormalizeConfig {
  readonly min: number; // valeur qui donne score 0
  readonly max: number; // valeur qui donne score 100
}

export function normalize(value: number, config: NormalizeConfig): number {
  const { min, max } = config;
  if (min === max) return 50;
  const raw = ((value - min) / (max - min)) * 100;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

/**
 * Normalisation inversee : plus la valeur est basse, meilleur est le score.
 * Utile pour PER, dette/equity, PEG.
 */
export function normalizeInverse(
  value: number,
  config: NormalizeConfig
): number {
  return normalize(value, { min: config.max, max: config.min });
}

/**
 * Normalisation avec zone optimale (pour payout ratio par exemple).
 * Score 100 dans la zone [optMin, optMax], decroissant en dehors.
 */
export function normalizeOptimalRange(
  value: number,
  optMin: number,
  optMax: number,
  absMin: number,
  absMax: number
): number {
  if (value >= optMin && value <= optMax) return 100;
  if (value < optMin) {
    return normalize(value, { min: absMin, max: optMin });
  }
  return normalizeInverse(value, { min: optMax, max: absMax });
}

// --- Presets de normalisation par metrique ---

export const METRIC_RANGES = {
  roe: { min: 0, max: 40 },
  operatingMargin: { min: 0, max: 40 },
  fcfYield: { min: 0, max: 10 },
  debtToEquity: { min: 3, max: 0 }, // inverse: bas = bon
  per: { min: 50, max: 10 }, // inverse: bas = bon
  peg: { min: 4, max: 0.5 }, // inverse: bas = bon
  revenueGrowth: { min: -5, max: 35 },
  epsGrowth: { min: -5, max: 40 },
  dividendYield: { min: 0, max: 6 },
  payoutOptimal: { optMin: 30, optMax: 60, absMin: 0, absMax: 100 },
} as const;

export function scoreMetric(
  metric: keyof typeof METRIC_RANGES,
  value: number
): number {
  const config = METRIC_RANGES[metric];
  if ("optMin" in config) {
    return normalizeOptimalRange(
      value,
      config.optMin,
      config.optMax,
      config.absMin,
      config.absMax
    );
  }
  return normalize(value, config as NormalizeConfig);
}
