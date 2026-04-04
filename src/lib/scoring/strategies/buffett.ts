import { Stock, SubScore } from "../../types";
import { StrategyScorer, registerStrategy } from "../engine";
import { scoreMetric } from "../normalize";
import { weightedAverage } from "../utils";

/**
 * Strategie Buffett : Qualite + Solidite + Valorisation
 *
 * Ponderation :
 *   - Qualite (40%) : ROE, marge operationnelle, FCF yield
 *   - Solidite financiere (30%) : dette/equity, FCF positif
 *   - Valorisation (30%) : PER
 */
const buffettScorer: StrategyScorer = {
  id: "buffett",

  score(stock: Stock): SubScore[] {
    // Qualite
    const roeScore = scoreMetric("roe", stock.roe);
    const marginScore = scoreMetric("operatingMargin", stock.operatingMargin);
    const fcfYield = (stock.freeCashFlow / stock.marketCap) * 100;
    const fcfYieldScore = scoreMetric("fcfYield", fcfYield);

    const qualityValue = weightedAverage([
      { score: roeScore, weight: 0.4 },
      { score: marginScore, weight: 0.35 },
      { score: fcfYieldScore, weight: 0.25 },
    ]);

    // Solidite
    const debtScore = scoreMetric("debtToEquity", stock.debtToEquity);
    const fcfPosScore = stock.freeCashFlow > 0 ? 100 : 10;

    const strengthValue = weightedAverage([
      { score: debtScore, weight: 0.6 },
      { score: fcfPosScore, weight: 0.4 },
    ]);

    // Valorisation
    const valuationValue = scoreMetric("per", stock.per);

    return [
      { name: "quality", value: qualityValue, weight: 0.4, label: "Qualite" },
      {
        name: "strength",
        value: strengthValue,
        weight: 0.3,
        label: "Solidite financiere",
      },
      {
        name: "valuation",
        value: valuationValue,
        weight: 0.3,
        label: "Valorisation",
      },
    ];
  },
};

registerStrategy(buffettScorer);
