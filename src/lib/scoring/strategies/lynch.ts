import { Stock, SubScore } from "../../types";
import { StrategyScorer, registerStrategy } from "../engine";
import { scoreMetric } from "../normalize";
import { weightedAverageSkipNull } from "../utils";

/**
 * Strategie Peter Lynch : Growth At Reasonable Price (GARP)
 *
 * Ponderation :
 *   - Croissance (40%) : EPS growth, revenue growth
 *   - Valeur (35%) : PEG ratio
 *   - Qualite (25%) : marge, Debt/OCF
 *
 * Debt/OCF (dette / cash-flow operationnel) remplace D/E car il
 * fonctionne meme quand les capitaux propres sont negatifs (buybacks).
 */
const lynchScorer: StrategyScorer = {
  id: "lynch",

  score(stock: Stock): SubScore[] {
    const epsScore = scoreMetric("epsGrowth", stock.epsGrowth);
    const revScore = scoreMetric("revenueGrowth", stock.revenueGrowth);
    const growthValue = weightedAverageSkipNull([
      { score: epsScore, weight: 0.6 },
      { score: revScore, weight: 0.4 },
    ]);

    const valueValue = scoreMetric("peg", stock.peg);

    const marginScore = scoreMetric("operatingMargin", stock.operatingMargin);
    const debtOcfScore = scoreMetric("debtToOcf", stock.debtToOcf);
    const qualityValue = weightedAverageSkipNull([
      { score: marginScore, weight: 0.5 },
      { score: debtOcfScore, weight: 0.5 },
    ]);

    return [
      { name: "growth", value: growthValue, weight: 0.4, label: "Croissance" },
      { name: "value", value: valueValue, weight: 0.35, label: "Valeur (PEG)" },
      { name: "quality", value: qualityValue, weight: 0.25, label: "Qualite" },
    ];
  },
};

registerStrategy(lynchScorer);
