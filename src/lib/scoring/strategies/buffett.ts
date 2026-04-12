import { Stock, SubScore } from "../../types";
import { StrategyScorer, registerStrategy } from "../engine";
import { scoreMetric } from "../normalize";
import { weightedAverageSkipNull, adjustForSector } from "../utils";

/**
 * Strategie Buffett : Qualite + Solidite + Valorisation
 *
 * Alignee sur la methode reelle de Warren Buffett :
 *   - ROIC (Return on Invested Capital) au lieu de ROE — mesure la
 *     rentabilite de tout le capital investi (equity + dette), pas juste
 *     l'equity. Fonctionne meme quand l'equity est negative (MCD, SBUX, HD).
 *   - Debt/OCF (Dette / Cash-flow operationnel) au lieu de D/E — mesure
 *     combien d'annees de cash-flow pour rembourser la dette. Plus fiable
 *     que D/E qui explose quand l'equity est faible ou negative.
 *
 * Ponderation :
 *   - Qualite (40%) : ROIC, marge operationnelle, FCF yield
 *   - Solidite financiere (30%) : dette/cash-flow, FCF positif
 *   - Valorisation (30%) : PER
 *
 * Ajustement sectoriel : marge et PER sont compares aux medianes du
 * secteur pour eviter de penaliser des secteurs structurellement
 * differents (ex: banque vs tech).
 *
 * FCF metrics are skipped (null) for financial sector stocks
 * where operating cash flow includes deposit/lending movements.
 */
const buffettScorer: StrategyScorer = {
  id: "buffett",

  score(stock: Stock): SubScore[] {
    // Qualite — ROIC is the primary profitability measure
    const roicScore = scoreMetric("roic", stock.roic);

    const marginRaw = scoreMetric("operatingMargin", stock.operatingMargin);
    const marginScore = marginRaw !== null
      ? adjustForSector(marginRaw, stock, "operatingMargin", stock.operatingMargin!)
      : null;

    const fcfYield = stock.marketCap > 0 && stock.freeCashFlow !== null
      ? (stock.freeCashFlow / stock.marketCap) * 100
      : null;
    const fcfYieldScore = fcfYield !== null ? scoreMetric("fcfYield", fcfYield) : null;

    const qualityValue = weightedAverageSkipNull([
      { score: roicScore, weight: 0.4 },
      { score: marginScore, weight: 0.35 },
      { score: fcfYieldScore, weight: 0.25 },
    ]);

    // Solidite — Debt/OCF measures repayment capacity in years
    const debtOcfScore = scoreMetric("debtToOcf", stock.debtToOcf);
    const fcfPosScore = stock.freeCashFlow !== null
      ? (stock.freeCashFlow > 0 ? 100 : 10)
      : null;

    const strengthValue = weightedAverageSkipNull([
      { score: debtOcfScore, weight: 0.6 },
      { score: fcfPosScore, weight: 0.4 },
    ]);

    // Valorisation
    const perRaw = scoreMetric("per", stock.per);
    const valuationValue = perRaw !== null
      ? adjustForSector(perRaw, stock, "per", stock.per!, true)
      : null;

    return [
      { name: "quality", value: qualityValue, weight: 0.4, label: "Qualite" },
      { name: "strength", value: strengthValue, weight: 0.3, label: "Solidite financiere" },
      { name: "valuation", value: valuationValue, weight: 0.3, label: "Valorisation" },
    ];
  },
};

registerStrategy(buffettScorer);
