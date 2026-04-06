/**
 * Score volatility: measures variability and classifies stability.
 *
 * Uses standard deviation of year-over-year deltas to classify
 * a score series as Stable, Moderate, or Volatile.
 */

import type { StrategyId } from "@/lib/types";

export type VolatilityLevel = "stable" | "moderate" | "volatile";

export interface VolatilityInfo {
  readonly level: VolatilityLevel;
  readonly label: string;
  readonly stdDev: number;
  readonly avgAbsDelta: number;
  readonly description: string;
}

const VOLATILITY_THRESHOLDS = {
  stable: 5,
  moderate: 12,
} as const;

/**
 * Compute volatility from a series of scores (some may be null).
 */
export function computeVolatility(
  scores: readonly (number | null)[],
): VolatilityInfo {
  const deltas: number[] = [];
  for (let i = 1; i < scores.length; i++) {
    const prev = scores[i - 1];
    const curr = scores[i];
    if (prev !== null && curr !== null) {
      deltas.push(curr - prev);
    }
  }

  if (deltas.length === 0) {
    return {
      level: "stable",
      label: "Stable",
      stdDev: 0,
      avgAbsDelta: 0,
      description: "Données insuffisantes pour évaluer la volatilité.",
    };
  }

  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance =
    deltas.reduce((acc, d) => acc + (d - mean) ** 2, 0) / deltas.length;
  const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;
  const avgAbsDelta =
    Math.round(
      (deltas.reduce((a, d) => a + Math.abs(d), 0) / deltas.length) * 100,
    ) / 100;

  const level = classify(stdDev);

  return {
    level,
    label: VOLATILITY_LABELS[level],
    stdDev,
    avgAbsDelta,
    description: VOLATILITY_DESCRIPTIONS[level],
  };
}

function classify(stdDev: number): VolatilityLevel {
  if (stdDev < VOLATILITY_THRESHOLDS.stable) return "stable";
  if (stdDev < VOLATILITY_THRESHOLDS.moderate) return "moderate";
  return "volatile";
}

// --- Labels ---

const VOLATILITY_LABELS: Record<VolatilityLevel, string> = {
  stable: "Stable",
  moderate: "Modéré",
  volatile: "Volatil",
};

const VOLATILITY_DESCRIPTIONS: Record<VolatilityLevel, string> = {
  stable: "Score régulier, faible variation d'une année à l'autre.",
  moderate: "Variations modérées, sensible aux cycles économiques.",
  volatile:
    "Peut fluctuer fortement d'une année à l'autre. Sensible à la croissance et à la valorisation.",
};

// --- Strategy nature (static mapping) ---

export interface StrategyNature {
  readonly expectedVolatility: VolatilityLevel;
  readonly label: string;
  readonly explanation: string;
}

const STRATEGY_NATURES: Record<StrategyId, StrategyNature> = {
  buffett: {
    expectedVolatility: "stable",
    label: "Stratégie fondamentale stable",
    explanation:
      "Basée sur la qualité et la solidité financière. Scores généralement réguliers.",
  },
  dividend: {
    expectedVolatility: "stable",
    label: "Stratégie de rendement stable",
    explanation:
      "Basée sur le rendement et la soutenabilité du dividende. Peu volatile par nature.",
  },
  growth: {
    expectedVolatility: "moderate",
    label: "Stratégie de croissance",
    explanation:
      "Sensible aux cycles de croissance. Peut varier avec les résultats trimestriels.",
  },
  lynch: {
    expectedVolatility: "volatile",
    label: "Stratégie GARP (croissance à prix raisonnable)",
    explanation:
      "Combine croissance et valorisation (PEG). Sensible aux variations de prix et de croissance.",
  },
};

export function getStrategyNature(strategyId: StrategyId): StrategyNature {
  return STRATEGY_NATURES[strategyId];
}

// --- Badge colors ---

export const VOLATILITY_COLORS: Record<
  VolatilityLevel,
  { bg: string; text: string; dot: string }
> = {
  stable: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  moderate: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  volatile: {
    bg: "bg-red-50",
    text: "text-red-600",
    dot: "bg-red-500",
  },
};
