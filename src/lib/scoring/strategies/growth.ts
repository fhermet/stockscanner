import { Stock, SubScore } from "../../types";
import { StrategyScorer, registerStrategy } from "../engine";
import { scoreMetric, normalize } from "../normalize";
import { weightedAverageSkipNull } from "../utils";

/**
 * Strategie Growth : croissance agressive
 *
 * Ponderation :
 *   - Momentum de croissance (50%) : CA growth, EPS growth
 *   - Rentabilite (25%) : marge, ROIC
 *   - Potentiel (25%) : taille (petite = plus de potentiel)
 *
 * ROIC remplace ROE car il mesure la rentabilite de tout le capital
 * investi (equity + dette). Pas de distorsion pour les entreprises
 * a equity negative (buybacks) ou tres faible.
 */
const growthScorer: StrategyScorer = {
  id: "growth",

  score(stock: Stock): SubScore[] {
    const revScore = scoreMetric("revenueGrowth", stock.revenueGrowth);
    const epsScore = scoreMetric("epsGrowth", stock.epsGrowth);
    const momentumValue = weightedAverageSkipNull([
      { score: revScore, weight: 0.5 },
      { score: epsScore, weight: 0.5 },
    ]);

    const marginScore = scoreMetric("operatingMargin", stock.operatingMargin);
    const roicScore = scoreMetric("roic", stock.roic);
    const profitValue = weightedAverageSkipNull([
      { score: marginScore, weight: 0.5 },
      { score: roicScore, weight: 0.5 },
    ]);

    // Scalabilite inversee : petite cap = plus de potentiel
    const scaleScore = normalize(stock.marketCap, { min: 3000, max: 10 });
    const scalabilityValue = scaleScore;

    return [
      { name: "momentum", value: momentumValue, weight: 0.5, label: "Momentum de croissance" },
      { name: "profitability", value: profitValue, weight: 0.25, label: "Rentabilite" },
      { name: "scalability", value: scalabilityValue, weight: 0.25, label: "Potentiel de croissance" },
    ];
  },
};

registerStrategy(growthScorer);
