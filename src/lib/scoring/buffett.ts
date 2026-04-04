import { Stock, SubScore, Explanation } from "../types";

function scoreROE(roe: number): number {
  if (roe >= 20) return 100;
  if (roe >= 15) return 80;
  if (roe >= 10) return 60;
  if (roe >= 5) return 40;
  return 20;
}

function scoreOperatingMargin(margin: number): number {
  if (margin >= 25) return 100;
  if (margin >= 15) return 80;
  if (margin >= 10) return 60;
  if (margin >= 5) return 40;
  return 20;
}

function scoreFCFYield(fcf: number, marketCap: number): number {
  const yield_ = (fcf / marketCap) * 100;
  if (yield_ >= 8) return 100;
  if (yield_ >= 5) return 80;
  if (yield_ >= 3) return 60;
  if (yield_ >= 1) return 40;
  return 20;
}

function scoreDebtToEquity(ratio: number): number {
  if (ratio <= 0.3) return 100;
  if (ratio <= 0.5) return 90;
  if (ratio <= 1.0) return 70;
  if (ratio <= 2.0) return 40;
  return 15;
}

function scoreFCFPositive(fcf: number): number {
  return fcf > 0 ? 100 : 10;
}

function scorePER(per: number): number {
  if (per <= 0) return 10;
  if (per <= 15) return 100;
  if (per <= 20) return 80;
  if (per <= 25) return 60;
  if (per <= 35) return 40;
  return 15;
}

export function computeBuffettScore(stock: Stock): {
  subScores: SubScore[];
  explanations: Explanation[];
} {
  const roeScore = scoreROE(stock.roe);
  const marginScore = scoreOperatingMargin(stock.operatingMargin);
  const fcfYieldScore = scoreFCFYield(stock.freeCashFlow, stock.marketCap);

  const qualityValue = Math.round(
    roeScore * 0.4 + marginScore * 0.35 + fcfYieldScore * 0.25
  );

  const debtScore = scoreDebtToEquity(stock.debtToEquity);
  const fcfPosScore = scoreFCFPositive(stock.freeCashFlow);

  const strengthValue = Math.round(debtScore * 0.6 + fcfPosScore * 0.4);

  const perScore = scorePER(stock.per);
  const valuationValue = perScore;

  const subScores: SubScore[] = [
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

  const explanations: Explanation[] = [];

  // Quality explanations
  if (stock.roe >= 20) {
    explanations.push({
      text: `ROE excellent (${stock.roe}%) : forte rentabilite des capitaux propres`,
      type: "positive",
      metric: "ROE",
      value: `${stock.roe}%`,
    });
  } else if (stock.roe >= 15) {
    explanations.push({
      text: `ROE correct (${stock.roe}%)`,
      type: "neutral",
      metric: "ROE",
      value: `${stock.roe}%`,
    });
  } else {
    explanations.push({
      text: `ROE faible (${stock.roe}%) : rentabilite insuffisante`,
      type: "negative",
      metric: "ROE",
      value: `${stock.roe}%`,
    });
  }

  if (stock.operatingMargin >= 25) {
    explanations.push({
      text: `Marge operationnelle solide (${stock.operatingMargin}%) : avantage competitif probable`,
      type: "positive",
      metric: "Marge op.",
      value: `${stock.operatingMargin}%`,
    });
  } else if (stock.operatingMargin >= 15) {
    explanations.push({
      text: `Marge operationnelle correcte (${stock.operatingMargin}%)`,
      type: "neutral",
      metric: "Marge op.",
      value: `${stock.operatingMargin}%`,
    });
  } else {
    explanations.push({
      text: `Marge operationnelle faible (${stock.operatingMargin}%) : pression concurrentielle`,
      type: "negative",
      metric: "Marge op.",
      value: `${stock.operatingMargin}%`,
    });
  }

  // Strength explanations
  if (stock.debtToEquity <= 0.5) {
    explanations.push({
      text: `Endettement maitrise (D/E: ${stock.debtToEquity})`,
      type: "positive",
      metric: "Dette/Capitaux",
      value: `${stock.debtToEquity}`,
    });
  } else if (stock.debtToEquity <= 1.0) {
    explanations.push({
      text: `Endettement modere (D/E: ${stock.debtToEquity})`,
      type: "neutral",
      metric: "Dette/Capitaux",
      value: `${stock.debtToEquity}`,
    });
  } else {
    explanations.push({
      text: `Endettement eleve (D/E: ${stock.debtToEquity}) : risque financier`,
      type: "negative",
      metric: "Dette/Capitaux",
      value: `${stock.debtToEquity}`,
    });
  }

  if (stock.freeCashFlow > 0) {
    explanations.push({
      text: `Free cash flow positif (${stock.freeCashFlow} Mds$) : generation de tresorerie`,
      type: "positive",
      metric: "FCF",
      value: `${stock.freeCashFlow} Mds$`,
    });
  } else {
    explanations.push({
      text: `Free cash flow negatif : consommation de tresorerie`,
      type: "negative",
      metric: "FCF",
      value: `${stock.freeCashFlow} Mds$`,
    });
  }

  // Valuation explanations
  if (stock.per <= 20) {
    explanations.push({
      text: `Valorisation attractive (PER: ${stock.per})`,
      type: "positive",
      metric: "PER",
      value: `${stock.per}`,
    });
  } else if (stock.per <= 30) {
    explanations.push({
      text: `Valorisation raisonnable (PER: ${stock.per})`,
      type: "neutral",
      metric: "PER",
      value: `${stock.per}`,
    });
  } else {
    explanations.push({
      text: `Valorisation elevee (PER: ${stock.per}) : prix exigeant`,
      type: "negative",
      metric: "PER",
      value: `${stock.per}`,
    });
  }

  return { subScores, explanations };
}
