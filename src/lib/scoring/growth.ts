import { Stock, SubScore, Explanation } from "../types";

function scoreRevenueGrowth(growth: number): number {
  if (growth >= 30) return 100;
  if (growth >= 20) return 85;
  if (growth >= 10) return 65;
  if (growth >= 5) return 40;
  return 15;
}

function scoreEPSGrowth(growth: number): number {
  if (growth >= 30) return 100;
  if (growth >= 20) return 85;
  if (growth >= 10) return 65;
  if (growth >= 5) return 40;
  return 15;
}

function scoreMargin(margin: number): number {
  if (margin >= 20) return 100;
  if (margin >= 10) return 75;
  if (margin >= 5) return 50;
  if (margin > 0) return 30;
  return 10;
}

function scoreROE(roe: number): number {
  if (roe >= 20) return 100;
  if (roe >= 15) return 80;
  if (roe >= 10) return 60;
  return 35;
}

function scoreScalability(marketCap: number): number {
  // Smaller companies have more room to grow
  if (marketCap < 10) return 100;
  if (marketCap < 50) return 90;
  if (marketCap < 200) return 70;
  if (marketCap < 500) return 50;
  if (marketCap < 1000) return 35;
  return 20;
}

export function computeGrowthScore(stock: Stock): {
  subScores: SubScore[];
  explanations: Explanation[];
} {
  const revGrowthScore = scoreRevenueGrowth(stock.revenueGrowth);
  const epsGrowthScore = scoreEPSGrowth(stock.epsGrowth);
  const momentumValue = Math.round(
    revGrowthScore * 0.5 + epsGrowthScore * 0.5
  );

  const marginScore = scoreMargin(stock.operatingMargin);
  const roeScore = scoreROE(stock.roe);
  const profitValue = Math.round(marginScore * 0.5 + roeScore * 0.5);

  const scaleScore = scoreScalability(stock.marketCap);
  const scalabilityValue = scaleScore;

  const subScores: SubScore[] = [
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

  const explanations: Explanation[] = [];

  // Revenue growth
  if (stock.revenueGrowth >= 20) {
    explanations.push({
      text: `Croissance du CA explosive (+${stock.revenueGrowth}%)`,
      type: "positive",
      metric: "CA Growth",
      value: `+${stock.revenueGrowth}%`,
    });
  } else if (stock.revenueGrowth >= 10) {
    explanations.push({
      text: `Croissance du CA solide (+${stock.revenueGrowth}%)`,
      type: "positive",
      metric: "CA Growth",
      value: `+${stock.revenueGrowth}%`,
    });
  } else if (stock.revenueGrowth >= 5) {
    explanations.push({
      text: `Croissance du CA moderee (+${stock.revenueGrowth}%)`,
      type: "neutral",
      metric: "CA Growth",
      value: `+${stock.revenueGrowth}%`,
    });
  } else {
    explanations.push({
      text: `Croissance du CA insuffisante (+${stock.revenueGrowth}%)`,
      type: "negative",
      metric: "CA Growth",
      value: `+${stock.revenueGrowth}%`,
    });
  }

  // EPS growth
  if (stock.epsGrowth >= 20) {
    explanations.push({
      text: `Benefices en tres forte hausse (+${stock.epsGrowth}%)`,
      type: "positive",
      metric: "EPS Growth",
      value: `+${stock.epsGrowth}%`,
    });
  } else if (stock.epsGrowth >= 10) {
    explanations.push({
      text: `Benefices en progression (+${stock.epsGrowth}%)`,
      type: "positive",
      metric: "EPS Growth",
      value: `+${stock.epsGrowth}%`,
    });
  } else {
    explanations.push({
      text: `Croissance des benefices limitee (+${stock.epsGrowth}%)`,
      type: "negative",
      metric: "EPS Growth",
      value: `+${stock.epsGrowth}%`,
    });
  }

  // Profitability
  if (stock.operatingMargin >= 20) {
    explanations.push({
      text: `Marges elevees (${stock.operatingMargin}%) : croissance rentable`,
      type: "positive",
      metric: "Marge op.",
      value: `${stock.operatingMargin}%`,
    });
  } else if (stock.operatingMargin < 5) {
    explanations.push({
      text: `Marges faibles (${stock.operatingMargin}%) : croissance couteuse`,
      type: "negative",
      metric: "Marge op.",
      value: `${stock.operatingMargin}%`,
    });
  }

  // Scalability
  if (stock.marketCap < 50) {
    explanations.push({
      text: `Capitalisation moderee (${stock.marketCap} Mds$) : potentiel de croissance important`,
      type: "positive",
      metric: "Market Cap",
      value: `${stock.marketCap} Mds$`,
    });
  } else if (stock.marketCap > 1000) {
    explanations.push({
      text: `Mega-cap (${stock.marketCap} Mds$) : croissance plus difficile a maintenir`,
      type: "negative",
      metric: "Market Cap",
      value: `${stock.marketCap} Mds$`,
    });
  }

  return { subScores, explanations };
}
