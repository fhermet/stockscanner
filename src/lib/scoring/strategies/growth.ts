import { Stock, SubScore } from "../../types";
import { StrategyScorer, registerStrategy } from "../engine";
import { scoreMetric, normalize } from "../normalize";
import { weightedAverage } from "../utils";

/**
 * Strategie Growth : croissance agressive
 *
 * Ponderation :
 *   - Momentum de croissance (50%) : CA growth, EPS growth
 *   - Rentabilite (25%) : marge, ROE
 *   - Potentiel (25%) : taille (petite = plus de potentiel)
 */
const growthScorer: StrategyScorer = {
  id: "growth",

  score(stock: Stock): SubScore[] {
    const revScore = scoreMetric("revenueGrowth", stock.revenueGrowth);
    const epsScore = scoreMetric("epsGrowth", stock.epsGrowth);
    const momentumValue = weightedAverage([
      { score: revScore, weight: 0.5 },
      { score: epsScore, weight: 0.5 },
    ]);

    const marginScore = scoreMetric("operatingMargin", stock.operatingMargin);
    const roeScore = scoreMetric("roe", stock.roe);
    const profitValue = weightedAverage([
      { score: marginScore, weight: 0.5 },
      { score: roeScore, weight: 0.5 },
    ]);

    // Scalabilite inversee : petite cap = plus de potentiel
    const scaleScore = normalize(stock.marketCap, {
      min: 3000,
      max: 10,
    });
    const scalabilityValue = scaleScore;

    return [
      {
        name: "momentum",
        value: momentumValue,
        weight: 0.5,
        label: "Momentum de croissance",
      },
      {
        name: "profitability",
        value: profitValue,
        weight: 0.25,
        label: "Rentabilite",
      },
      {
        name: "scalability",
        value: scalabilityValue,
        weight: 0.25,
        label: "Potentiel de croissance",
      },
    ];
  },
};

registerStrategy(growthScorer);
