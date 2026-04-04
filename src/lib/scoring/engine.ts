import { Stock, StrategyId, StrategyScore, SubScore, ScoredStock, StockFilters } from "../types";
import { computeWeightedTotal } from "./utils";
import { generateExplanations } from "./explain";

/**
 * Interface que chaque strategie doit implementer.
 *
 * Ajouter une strategie = creer une classe qui implemente
 * StrategyScorer, puis l'enregistrer via registerStrategy().
 */
export interface StrategyScorer {
  readonly id: StrategyId;
  score(stock: Stock): SubScore[];
}

// --- Registry ---

const registry = new Map<StrategyId, StrategyScorer>();

export function registerStrategy(scorer: StrategyScorer): void {
  registry.set(scorer.id, scorer);
}

export function getScorer(id: StrategyId): StrategyScorer {
  const scorer = registry.get(id);
  if (!scorer) {
    throw new Error(`No scorer registered for strategy: ${id}`);
  }
  return scorer;
}

export function getAllScorerIds(): StrategyId[] {
  return [...registry.keys()];
}

// --- Scoring functions ---

export function scoreStock(
  stock: Stock,
  strategyId: StrategyId
): StrategyScore {
  const scorer = getScorer(strategyId);
  const subScores = scorer.score(stock);
  const total = computeWeightedTotal(subScores);
  const explanations = generateExplanations(stock, subScores, strategyId);

  return { strategyId, total, subScores, explanations };
}

export function scoreStockAllStrategies(
  stock: Stock
): Record<StrategyId, StrategyScore> {
  const result = {} as Record<StrategyId, StrategyScore>;
  for (const id of getAllScorerIds()) {
    result[id] = scoreStock(stock, id);
  }
  return result;
}

export async function scoreAndRankStocks(
  stocks: readonly Stock[],
  strategyId: StrategyId
): Promise<ScoredStock[]> {
  const scored: ScoredStock[] = stocks.map((stock) => ({
    stock,
    score: scoreStock(stock, strategyId),
  }));

  return scored.sort((a, b) => b.score.total - a.score.total);
}
