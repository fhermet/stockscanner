import {
  Stock,
  StrategyId,
  StrategyScore,
  ScoredStock,
  StockFilters,
} from "../types";
import { computeBuffettScore } from "./buffett";
import { computeLynchScore } from "./lynch";
import { computeGrowthScore } from "./growth";
import { computeDividendScore } from "./dividend";

function computeTotal(
  subScores: { value: number; weight: number }[]
): number {
  return Math.round(
    subScores.reduce((acc, s) => acc + s.value * s.weight, 0)
  );
}

export function scoreStock(
  stock: Stock,
  strategyId: StrategyId
): StrategyScore {
  const scoreFn = {
    buffett: computeBuffettScore,
    lynch: computeLynchScore,
    growth: computeGrowthScore,
    dividend: computeDividendScore,
  }[strategyId];

  const { subScores, explanations } = scoreFn(stock);

  return {
    strategyId,
    total: computeTotal(subScores),
    subScores,
    explanations,
  };
}

export function scoreAndRankStocks(
  stocks: readonly Stock[],
  strategyId: StrategyId,
  filters?: StockFilters
): ScoredStock[] {
  let filtered = [...stocks];

  if (filters?.sector) {
    filtered = filtered.filter((s) => s.sector === filters.sector);
  }
  if (filters?.country) {
    filtered = filtered.filter((s) => s.country === filters.country);
  }
  if (filters?.marketCapMin !== undefined) {
    filtered = filtered.filter((s) => s.marketCap >= filters.marketCapMin!);
  }
  if (filters?.marketCapMax !== undefined) {
    filtered = filtered.filter((s) => s.marketCap <= filters.marketCapMax!);
  }

  const scored: ScoredStock[] = filtered.map((stock) => ({
    stock,
    score: scoreStock(stock, strategyId),
  }));

  return scored.sort((a, b) => b.score.total - a.score.total);
}
