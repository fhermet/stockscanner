/**
 * Benchmarks sectoriels pour la comparabilite.
 *
 * Pour chaque secteur, on definit les medianes de metriques cles.
 * Le scoring peut ajuster un score brut en tenant compte de la
 * position relative d'une action dans son secteur.
 *
 * Approche : si la marge op. d'une banque est 35%, c'est bon pour une banque
 * mais mediocre pour du tech. Les benchmarks permettent cette nuance.
 */

export interface SectorBenchmark {
  readonly operatingMargin: number;
  readonly revenueGrowth: number;
  readonly epsGrowth: number;
  readonly per: number;
  readonly dividendYield: number;
}

export const SECTOR_BENCHMARKS: Record<string, SectorBenchmark> = {
  Technologie: {
    operatingMargin: 25,
    revenueGrowth: 12,
    epsGrowth: 15,
    per: 30,
    dividendYield: 0.8,
  },
  Sante: {
    operatingMargin: 20,
    revenueGrowth: 6,
    epsGrowth: 8,
    per: 18,
    dividendYield: 2.0,
  },
  Finance: {
    operatingMargin: 35,
    revenueGrowth: 7,
    epsGrowth: 8,
    per: 14,
    dividendYield: 2.5,
  },
  "Consommation de base": {
    operatingMargin: 15,
    revenueGrowth: 4,
    epsGrowth: 6,
    per: 24,
    dividendYield: 2.8,
  },
  "Consommation cyclique": {
    operatingMargin: 18,
    revenueGrowth: 5,
    epsGrowth: 8,
    per: 22,
    dividendYield: 2.0,
  },
  Telecom: {
    operatingMargin: 20,
    revenueGrowth: 2,
    epsGrowth: 3,
    per: 12,
    dividendYield: 4.5,
  },
  Immobilier: {
    operatingMargin: 30,
    revenueGrowth: 10,
    epsGrowth: 5,
    per: 40,
    dividendYield: 4.0,
  },
  Automobile: {
    operatingMargin: 10,
    revenueGrowth: 10,
    epsGrowth: 15,
    per: 25,
    dividendYield: 0.5,
  },
  Industrie: {
    operatingMargin: 14,
    revenueGrowth: 6,
    epsGrowth: 10,
    per: 22,
    dividendYield: 1.5,
  },
  Energie: {
    operatingMargin: 15,
    revenueGrowth: 3,
    epsGrowth: 5,
    per: 12,
    dividendYield: 3.5,
  },
  "Services publics": {
    operatingMargin: 20,
    revenueGrowth: 3,
    epsGrowth: 4,
    per: 18,
    dividendYield: 3.5,
  },
  Materiaux: {
    operatingMargin: 12,
    revenueGrowth: 4,
    epsGrowth: 6,
    per: 16,
    dividendYield: 2.5,
  },
};

const DEFAULT_BENCHMARK: SectorBenchmark = {
  operatingMargin: 15,
  revenueGrowth: 8,
  epsGrowth: 10,
  per: 20,
  dividendYield: 2.0,
};

export function getSectorBenchmark(sector: string): SectorBenchmark {
  return SECTOR_BENCHMARKS[sector] ?? DEFAULT_BENCHMARK;
}

/**
 * Compare une valeur a la mediane sectorielle.
 *
 * Retourne un facteur d'ajustement :
 * - > 1.0 si la valeur est au-dessus de la mediane (bonus)
 * - < 1.0 si en dessous (malus)
 * - 1.0 si pile sur la mediane
 *
 * Le facteur est borne entre 0.7 et 1.3 pour eviter les
 * ajustements excessifs.
 *
 * @param isInverse true pour les metriques ou bas = bon (PER, dette)
 */
export function sectorAdjustmentFactor(
  value: number,
  sectorMedian: number,
  isInverse = false
): number {
  if (sectorMedian === 0) return 1.0;

  const ratio = isInverse
    ? sectorMedian / Math.max(value, 0.01)
    : value / sectorMedian;

  // Transformer en facteur d'ajustement borne
  const factor = 0.5 + 0.5 * Math.min(ratio, 2);
  return Math.max(0.7, Math.min(1.3, factor));
}
