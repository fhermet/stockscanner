/**
 * Portfolio construction rules for Buffett v2 strategy.
 *
 * This is an optional, modular layer on top of the scoring engine.
 * It does NOT modify scoring — it applies portfolio-level rules
 * after stocks have been scored.
 *
 * Rules:
 *   A. Selection: top 20% of scores, min 3 sectors, min score 40/100
 *   B. Position sizing: weighted by score, cap per position 8-10%
 *   C. Sector cap: no sector > 35% of portfolio
 *   D. Cash management: if < 10 qualified stocks, proportional cash allocation
 *   E. Rebalancing triggers (data only — no execution):
 *      - Position drops > 30%
 *      - Score falls below 40/100
 */

import type { ScoredStock } from "../types";

export interface PortfolioConfig {
  /** Fraction of top scores to select (0-1). Default: 0.20 */
  readonly topFraction: number;
  /** Minimum score to be eligible. Default: 40 */
  readonly minScore: number;
  /** Minimum number of distinct sectors. Default: 3 */
  readonly minSectors: number;
  /** Max weight per position (0-1). Default: 0.10 */
  readonly maxPositionWeight: number;
  /** Max weight per sector (0-1). Default: 0.35 */
  readonly maxSectorWeight: number;
  /** Target number of stocks for full allocation. Default: 10 */
  readonly fullAllocationCount: number;
}

export const DEFAULT_PORTFOLIO_CONFIG: PortfolioConfig = {
  topFraction: 0.20,
  minScore: 40,
  minSectors: 3,
  maxPositionWeight: 0.10,
  maxSectorWeight: 0.35,
  fullAllocationCount: 10,
};

export interface PortfolioPosition {
  readonly ticker: string;
  readonly name: string;
  readonly sector: string;
  readonly score: number;
  readonly weight: number; // 0-1, fraction of invested capital
}

export interface PortfolioResult {
  readonly positions: readonly PortfolioPosition[];
  readonly cashWeight: number; // 0-1
  readonly sectorWeights: Readonly<Record<string, number>>;
  readonly totalPositions: number;
  readonly warnings: readonly string[];
}

/**
 * Build a portfolio from scored stocks.
 *
 * Steps:
 * 1. Filter: min score, top fraction
 * 2. Ensure sector diversification (min sectors)
 * 3. Weight by score with caps
 * 4. Apply sector caps, redistribute excess
 * 5. Compute cash allocation if too few stocks
 */
export function buildPortfolio(
  scoredStocks: readonly ScoredStock[],
  config: PortfolioConfig = DEFAULT_PORTFOLIO_CONFIG,
): PortfolioResult {
  const warnings: string[] = [];

  // 1. Filter eligible stocks (non-null score >= minScore)
  const eligible = scoredStocks
    .filter((s) => s.score.total !== null && s.score.total >= config.minScore)
    .sort((a, b) => b.score.total! - a.score.total!);

  if (eligible.length === 0) {
    return {
      positions: [],
      cashWeight: 1,
      sectorWeights: {},
      totalPositions: 0,
      warnings: ["Aucune action ne passe le seuil minimum de score"],
    };
  }

  // 2. Select top fraction
  const topCount = Math.max(1, Math.ceil(scoredStocks.length * config.topFraction));
  let selected = eligible.slice(0, topCount);

  // 3. Ensure minimum sector diversification
  const sectors = new Set(selected.map((s) => s.stock.sector));
  if (sectors.size < config.minSectors && eligible.length > selected.length) {
    // Add stocks from underrepresented sectors
    for (const stock of eligible.slice(topCount)) {
      if (sectors.size >= config.minSectors) break;
      if (!sectors.has(stock.stock.sector)) {
        selected = [...selected, stock];
        sectors.add(stock.stock.sector);
      }
    }
    if (sectors.size < config.minSectors) {
      warnings.push(
        `Diversification limitee : ${sectors.size} secteur(s) represente(s) (minimum souhaite : ${config.minSectors})`,
      );
    }
  }

  // 4. Score-weighted allocation
  const totalScore = selected.reduce((acc, s) => acc + s.score.total!, 0);
  let positions: PortfolioPosition[] = selected.map((s) => ({
    ticker: s.stock.ticker,
    name: s.stock.name,
    sector: s.stock.sector,
    score: s.score.total!,
    weight: totalScore > 0 ? s.score.total! / totalScore : 1 / selected.length,
  }));

  // 5. Apply position cap
  positions = applyPositionCap(positions, config.maxPositionWeight);

  // 6. Apply sector cap
  positions = applySectorCap(positions, config.maxSectorWeight);

  // 7. Cash management: if fewer than fullAllocationCount, proportional cash
  let cashWeight = 0;
  if (selected.length < config.fullAllocationCount) {
    cashWeight = 1 - (selected.length / config.fullAllocationCount);
    const investedFraction = 1 - cashWeight;
    positions = positions.map((p) => ({ ...p, weight: p.weight * investedFraction }));
    warnings.push(
      `${selected.length} actions qualifiees (< ${config.fullAllocationCount}) : ${Math.round(cashWeight * 100)}% cash`,
    );
  }

  // Compute sector weights
  const sectorWeights: Record<string, number> = {};
  for (const p of positions) {
    sectorWeights[p.sector] = (sectorWeights[p.sector] ?? 0) + p.weight;
  }

  return {
    positions,
    cashWeight,
    sectorWeights,
    totalPositions: positions.length,
    warnings,
  };
}

function applyPositionCap(
  positions: PortfolioPosition[],
  maxWeight: number,
): PortfolioPosition[] {
  let excess = 0;
  const capped = positions.map((p) => {
    if (p.weight > maxWeight) {
      excess += p.weight - maxWeight;
      return { ...p, weight: maxWeight };
    }
    return p;
  });

  if (excess <= 0) return capped;

  // Redistribute excess proportionally to uncapped positions
  const uncapped = capped.filter((p) => p.weight < maxWeight);
  const uncappedTotal = uncapped.reduce((a, p) => a + p.weight, 0);

  return capped.map((p) => {
    if (p.weight < maxWeight && uncappedTotal > 0) {
      const bonus = (p.weight / uncappedTotal) * excess;
      return { ...p, weight: Math.min(p.weight + bonus, maxWeight) };
    }
    return p;
  });
}

function applySectorCap(
  positions: PortfolioPosition[],
  maxSectorWeight: number,
): PortfolioPosition[] {
  const sectorWeights: Record<string, number> = {};
  for (const p of positions) {
    sectorWeights[p.sector] = (sectorWeights[p.sector] ?? 0) + p.weight;
  }

  const overweight = Object.entries(sectorWeights).filter(
    ([, w]) => w > maxSectorWeight,
  );

  if (overweight.length === 0) return positions;

  let totalExcess = 0;

  // Scale down overweight sectors
  const adjusted = positions.map((p) => {
    const sectorW = sectorWeights[p.sector];
    if (sectorW > maxSectorWeight) {
      const ratio = maxSectorWeight / sectorW;
      const newWeight = p.weight * ratio;
      totalExcess += p.weight - newWeight;
      return { ...p, weight: newWeight };
    }
    return p;
  });

  if (totalExcess <= 0) return adjusted;

  // Redistribute to non-overweight positions
  const nonOverweight = adjusted.filter(
    (p) => (sectorWeights[p.sector] ?? 0) <= maxSectorWeight,
  );
  const nonOverTotal = nonOverweight.reduce((a, p) => a + p.weight, 0);

  return adjusted.map((p) => {
    if ((sectorWeights[p.sector] ?? 0) <= maxSectorWeight && nonOverTotal > 0) {
      return { ...p, weight: p.weight + (p.weight / nonOverTotal) * totalExcess };
    }
    return p;
  });
}

// --- Rebalancing triggers (data-only, no execution) ---

export interface RebalanceTrigger {
  readonly ticker: string;
  readonly reason: string;
  readonly type: "score_drop" | "price_drop";
}

/**
 * Check for rebalancing triggers on existing positions.
 * Returns a list of positions that should be reviewed.
 *
 * @param currentScores Current scored stocks
 * @param positions Current portfolio positions
 * @param priceChanges Map of ticker -> price change percentage (negative = drop)
 */
export function checkRebalanceTriggers(
  currentScores: readonly ScoredStock[],
  positions: readonly PortfolioPosition[],
  priceChanges?: Readonly<Record<string, number>>,
): readonly RebalanceTrigger[] {
  const triggers: RebalanceTrigger[] = [];
  const scoreMap = new Map(
    currentScores.map((s) => [s.stock.ticker, s.score.total]),
  );

  for (const pos of positions) {
    const score = scoreMap.get(pos.ticker) ?? null;
    if (score !== null && score < 40) {
      triggers.push({
        ticker: pos.ticker,
        reason: `Score tombe a ${score}/100 (seuil : 40)`,
        type: "score_drop",
      });
    }

    if (priceChanges) {
      const change = priceChanges[pos.ticker];
      if (change !== undefined && change <= -30) {
        triggers.push({
          ticker: pos.ticker,
          reason: `Chute de prix de ${Math.abs(change).toFixed(0)}% (seuil : -30%)`,
          type: "price_drop",
        });
      }
    }
  }

  return triggers;
}
