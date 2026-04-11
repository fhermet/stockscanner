import { Stock, SubScore } from "../types";
import { getSectorBenchmark, sectorAdjustmentFactor } from "./sector-benchmarks";

/**
 * Calcule le score total a partir de sous-scores ponderes.
 */
export function computeWeightedTotal(subScores: readonly SubScore[]): number | null {
  if (subScores.some((s) => s.value === null)) return null;
  return Math.round(
    subScores.reduce((acc, s) => acc + (s.value as number) * s.weight, 0)
  );
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
