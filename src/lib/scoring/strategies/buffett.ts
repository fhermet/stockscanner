import { Stock, SubScore } from "../../types";
import { StrategyScorer, registerStrategy } from "../engine";
import { scoreMetric } from "../normalize";
import { weightedAverage, adjustForSector } from "../utils";

/**
 * Strategie Buffett : Qualite + Solidite + Valorisation
 *
 * Ponderation :
 *   - Qualite (40%) : ROE, marge operationnelle, FCF yield
 *   - Solidite financiere (30%) : dette/equity, FCF positif
 *   - Valorisation (30%) : PER
 *
 * Ajustement sectoriel : ROE, marge et PER sont compares aux
 * medianes du secteur pour eviter de penaliser des secteurs
 * structurellement differents (ex: banque vs tech).
 */
const buffettScorer: StrategyScorer = {
  id: "buffett",

  score(stock: Stock): SubScore[] {
    // Qualite
    const roeRaw = scoreMetric("roe", stock.roe);
    const roeScore = adjustForSector(roeRaw, stock, "roe", stock.roe);

    const marginRaw = scoreMetric("operatingMargin", stock.operatingMargin);
    const marginScore = adjustForSector(
      marginRaw, stock, "operatingMargin", stock.operatingMargin
    );

    const fcfYield = stock.marketCap > 0
      ? (stock.freeCashFlow / stock.marketCap) * 100
      : 0;
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
    const perRaw = scoreMetric("per", stock.per);
    const valuationValue = adjustForSector(
      perRaw, stock, "per", stock.per, true
    );

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
