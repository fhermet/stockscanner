import { Stock, SubScore, Explanation } from "../types";

function scoreEPSGrowth(growth: number): number {
  if (growth >= 25) return 100;
  if (growth >= 15) return 80;
  if (growth >= 10) return 60;
  if (growth >= 5) return 40;
  return 20;
}

function scoreRevenueGrowth(growth: number): number {
  if (growth >= 20) return 100;
  if (growth >= 10) return 80;
  if (growth >= 5) return 60;
  if (growth > 0) return 40;
  return 15;
}

function scorePEG(peg: number): number {
  if (peg <= 0) return 10;
  if (peg <= 1.0) return 100;
  if (peg <= 1.5) return 85;
  if (peg <= 2.0) return 65;
  if (peg <= 3.0) return 40;
  return 15;
}

function scoreMargin(margin: number): number {
  if (margin >= 20) return 100;
  if (margin >= 10) return 75;
  if (margin >= 5) return 50;
  return 30;
}

function scoreDebt(ratio: number): number {
  if (ratio <= 0.5) return 100;
  if (ratio <= 1.0) return 75;
  if (ratio <= 2.0) return 50;
  return 25;
}

export function computeLynchScore(stock: Stock): {
  subScores: SubScore[];
  explanations: Explanation[];
} {
  const epsScore = scoreEPSGrowth(stock.epsGrowth);
  const revScore = scoreRevenueGrowth(stock.revenueGrowth);
  const growthValue = Math.round(epsScore * 0.6 + revScore * 0.4);

  const pegScore = scorePEG(stock.peg);
  const valueValue = pegScore;

  const marginScore = scoreMargin(stock.operatingMargin);
  const debtScore = scoreDebt(stock.debtToEquity);
  const qualityValue = Math.round(marginScore * 0.5 + debtScore * 0.5);

  const subScores: SubScore[] = [
    {
      name: "growth",
      value: growthValue,
      weight: 0.4,
      label: "Croissance",
    },
    {
      name: "value",
      value: valueValue,
      weight: 0.35,
      label: "Valeur (PEG)",
    },
    { name: "quality", value: qualityValue, weight: 0.25, label: "Qualite" },
  ];

  const explanations: Explanation[] = [];

  // PEG - the key Lynch metric
  if (stock.peg <= 1.0) {
    explanations.push({
      text: `PEG excellent (${stock.peg}) : croissance sous-evaluee par le marche`,
      type: "positive",
      metric: "PEG",
      value: `${stock.peg}`,
    });
  } else if (stock.peg <= 1.5) {
    explanations.push({
      text: `PEG raisonnable (${stock.peg}) : prix correct pour la croissance`,
      type: "positive",
      metric: "PEG",
      value: `${stock.peg}`,
    });
  } else if (stock.peg <= 2.5) {
    explanations.push({
      text: `PEG un peu eleve (${stock.peg}) : la croissance est deja dans le prix`,
      type: "neutral",
      metric: "PEG",
      value: `${stock.peg}`,
    });
  } else {
    explanations.push({
      text: `PEG eleve (${stock.peg}) : prix excessif par rapport a la croissance`,
      type: "negative",
      metric: "PEG",
      value: `${stock.peg}`,
    });
  }

  // Growth
  if (stock.epsGrowth >= 15) {
    explanations.push({
      text: `Croissance des benefices forte (+${stock.epsGrowth}%)`,
      type: "positive",
      metric: "EPS Growth",
      value: `+${stock.epsGrowth}%`,
    });
  } else if (stock.epsGrowth >= 5) {
    explanations.push({
      text: `Croissance des benefices moderee (+${stock.epsGrowth}%)`,
      type: "neutral",
      metric: "EPS Growth",
      value: `+${stock.epsGrowth}%`,
    });
  } else {
    explanations.push({
      text: `Croissance des benefices faible (+${stock.epsGrowth}%)`,
      type: "negative",
      metric: "EPS Growth",
      value: `+${stock.epsGrowth}%`,
    });
  }

  if (stock.revenueGrowth >= 10) {
    explanations.push({
      text: `Chiffre d'affaires en forte progression (+${stock.revenueGrowth}%)`,
      type: "positive",
      metric: "CA Growth",
      value: `+${stock.revenueGrowth}%`,
    });
  } else if (stock.revenueGrowth >= 5) {
    explanations.push({
      text: `Chiffre d'affaires en croissance (+${stock.revenueGrowth}%)`,
      type: "neutral",
      metric: "CA Growth",
      value: `+${stock.revenueGrowth}%`,
    });
  } else {
    explanations.push({
      text: `Chiffre d'affaires quasi stagnant (+${stock.revenueGrowth}%)`,
      type: "negative",
      metric: "CA Growth",
      value: `+${stock.revenueGrowth}%`,
    });
  }

  // Quality
  if (stock.operatingMargin >= 20) {
    explanations.push({
      text: `Marges solides (${stock.operatingMargin}%)`,
      type: "positive",
      metric: "Marge op.",
      value: `${stock.operatingMargin}%`,
    });
  }

  if (stock.debtToEquity <= 0.5) {
    explanations.push({
      text: `Faible endettement (D/E: ${stock.debtToEquity})`,
      type: "positive",
      metric: "Dette/Capitaux",
      value: `${stock.debtToEquity}`,
    });
  } else if (stock.debtToEquity > 2) {
    explanations.push({
      text: `Endettement eleve (D/E: ${stock.debtToEquity})`,
      type: "negative",
      metric: "Dette/Capitaux",
      value: `${stock.debtToEquity}`,
    });
  }

  return { subScores, explanations };
}
