import { Stock, StrategyId, StrategyScore, SubScore, ScoredStock } from "../types";
import { computeWeightedTotal } from "./utils";
import { generateExplanations } from "./explain";
import { computeDataCompleteness, computeConfidence } from "./completeness";
import { applyBuffettPreFilters } from "./pre-filters";

/**
 * Interface que chaque strategie doit implementer.
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

// --- Scoring ---

export function scoreStock(
  stock: Stock,
  strategyId: StrategyId
): StrategyScore {
  const dataCompleteness = computeDataCompleteness(stock, strategyId);
  const confidence = computeConfidence(dataCompleteness);

  // --- Buffett v2 pre-filters: exclude before scoring ---
  if (strategyId === "buffett") {
    const preFilter = applyBuffettPreFilters(stock);
    if (!preFilter.passed) {
      const scorer = getScorer(strategyId);
      const subScores = scorer.score(stock);
      const explanations = preFilter.failedReasons.map((reason) => ({
        text: reason,
        type: "negative" as const,
        metric: "Pre-filtre",
      }));
      return { strategyId, total: null, subScores, explanations, confidence, dataCompleteness };
    }
  }

  const scorer = getScorer(strategyId);
  const subScores = scorer.score(stock);

  if (dataCompleteness.missing.length > 0) {
    return { strategyId, total: null, subScores, explanations: [], confidence, dataCompleteness };
  }

  const total = computeWeightedTotal(subScores);
  const explanations = generateExplanations(stock, subScores, strategyId);
  return { strategyId, total, subScores, explanations, confidence, dataCompleteness };
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

  return scored.sort((a, b) => {
    if (a.score.total === null && b.score.total === null) return 0;
    if (a.score.total === null) return 1;
    if (b.score.total === null) return -1;
    return b.score.total - a.score.total;
  });
}
