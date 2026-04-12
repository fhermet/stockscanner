import { Stock, SubScore } from "../types";
import { getSectorBenchmark, sectorAdjustmentFactor } from "./sector-benchmarks";

/**
 * Calcule le score total a partir de sous-scores ponderes.
 * Les sous-scores null sont ignores et leurs poids redistribues
 * proportionnellement aux sous-scores disponibles (ex: banques sans
 * FCF/Debt-OCF dans la strategie Buffett). Retourne null seulement
 * si tous les sous-scores sont null.
 */
export function computeWeightedTotal(subScores: readonly SubScore[]): number | null {
  const available = subScores.filter((s): s is SubScore & { value: number } => s.value !== null);
  if (available.length === 0) return null;
  const totalWeight = available.reduce((acc, s) => acc + s.weight, 0);
  if (totalWeight === 0) return null;
  const raw = available.reduce((acc, s) => acc + s.value * s.weight, 0);
  return Math.round(raw / totalWeight);
}

/**
 * Combine plusieurs scores unitaires avec des poids donnes.
 * Usage interne pour calculer un sous-score a partir de metriques.
 */
export function weightedAverage(
  items: readonly { score: number; weight: number }[]
): number {
  const totalWeight = items.reduce((acc, i) => acc + i.weight, 0);
  if (totalWeight === 0) return 0;
  const raw = items.reduce((acc, i) => acc + i.score * i.weight, 0);
  return Math.round(raw / totalWeight);
}

/**
 * Applique un ajustement sectoriel a un score brut.
 * Le score est multiplie par un facteur qui reflete la position
 * relative de la metrique dans le secteur de l'action.
 */
export function adjustForSector(
  rawScore: number,
  stock: Stock,
  metricKey: keyof ReturnType<typeof getSectorBenchmark>,
  metricValue: number,
  isInverse = false
): number {
  const benchmark = getSectorBenchmark(stock.sector);
  const median = benchmark[metricKey];
  const factor = sectorAdjustmentFactor(metricValue, median, isInverse);
  return Math.round(Math.max(0, Math.min(100, rawScore * factor)));
}

/**
 * Weighted average that excludes null scores and redistributes their
 * weight to the remaining items. Returns null only if ALL scores are null.
 */
export function weightedAverageSkipNull(
  items: readonly { score: number | null; weight: number }[]
): number | null {
  const available = items.filter((i): i is { score: number; weight: number } => i.score !== null);
  if (available.length === 0) return null;
  return weightedAverage(available);
}

/**
 * Redistribue les poids quand certaines metriques sont absentes.
 * Prend un tableau d'items avec un flag `available`.
 * Les poids des items indisponibles sont redistribues proportionnellement.
 */
export function redistributeWeights<T extends { weight: number }>(
  items: readonly (T & { available: boolean })[]
): (T & { adjustedWeight: number })[] {
  const available = items.filter((i) => i.available);
  const totalAvailableWeight = available.reduce(
    (acc, i) => acc + i.weight,
    0
  );

  return items.map((item) => ({
    ...item,
    adjustedWeight: item.available
      ? totalAvailableWeight > 0
        ? item.weight / totalAvailableWeight
        : 0
      : 0,
  }));
}
