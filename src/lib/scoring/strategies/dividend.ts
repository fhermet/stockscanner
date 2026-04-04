import { Stock, SubScore } from "../../types";
import { StrategyScorer, registerStrategy } from "../engine";
import { scoreMetric, normalizeOptimalRange } from "../normalize";
import { weightedAverage } from "../utils";

/**
 * Strategie Dividende : rendement + soutenabilite + stabilite
 *
 * Ponderation :
 *   - Rendement (30%) : dividend yield
 *   - Soutenabilite (35%) : payout ratio (zone optimale), FCF coverage
 *   - Stabilite (35%) : dette, croissance historique du dividende
 */

function scoreDividendGrowth(history: Stock["history"]): number {
  if (history.length < 2) return 50;
  let growingYears = 0;
  for (let i = 1; i < history.length; i++) {
    if (history[i].dividendPerShare > history[i - 1].dividendPerShare) {
      growingYears++;
    }
  }
  const ratio = growingYears / (history.length - 1);
  return Math.round(ratio * 100);
}

function scoreFCFCoverage(
  fcf: number,
  marketCap: number,
  divYield: number
): number {
  if (divYield <= 0) return 5;
  const dividendCost = marketCap * (divYield / 100);
  if (dividendCost <= 0) return 5;
  const coverage = fcf / dividendCost;
  if (coverage >= 2.5) return 100;
  if (coverage >= 1.5) return 80;
  if (coverage >= 1.0) return 55;
  if (coverage >= 0.5) return 25;
  return 5;
}

const dividendScorer: StrategyScorer = {
  id: "dividend",

  score(stock: Stock): SubScore[] {
    const yieldValue = scoreMetric("dividendYield", stock.dividendYield);

    const payoutScore = normalizeOptimalRange(
      stock.payoutRatio,
      30,
      60,
      0,
      100
    );
    const fcfScore = scoreFCFCoverage(
      stock.freeCashFlow,
      stock.marketCap,
      stock.dividendYield
    );
    const sustainabilityValue = weightedAverage([
      { score: payoutScore, weight: 0.5 },
      { score: fcfScore, weight: 0.5 },
    ]);

    const debtScore = scoreMetric("debtToEquity", stock.debtToEquity);
    const divGrowthScore = scoreDividendGrowth(stock.history);
    const stabilityValue = weightedAverage([
      { score: debtScore, weight: 0.4 },
      { score: divGrowthScore, weight: 0.6 },
    ]);

    return [
      { name: "yield", value: yieldValue, weight: 0.3, label: "Rendement" },
      {
        name: "sustainability",
        value: sustainabilityValue,
        weight: 0.35,
        label: "Soutenabilite",
      },
      {
        name: "stability",
        value: stabilityValue,
        weight: 0.35,
        label: "Stabilite",
      },
    ];
  },
};

registerStrategy(dividendScorer);
