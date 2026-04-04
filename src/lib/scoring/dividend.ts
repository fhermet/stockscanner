import { Stock, SubScore, Explanation } from "../types";

function scoreDividendYield(yield_: number): number {
  if (yield_ >= 5) return 100;
  if (yield_ >= 4) return 90;
  if (yield_ >= 3) return 75;
  if (yield_ >= 2) return 55;
  if (yield_ >= 1) return 35;
  return 10;
}

function scorePayoutRatio(ratio: number): number {
  if (ratio <= 0) return 5; // No dividend
  if (ratio >= 30 && ratio <= 60) return 100;
  if (ratio >= 20 && ratio < 30) return 80;
  if (ratio > 60 && ratio <= 75) return 75;
  if (ratio < 20) return 50;
  if (ratio <= 85) return 40;
  return 15; // >85% is risky
}

function scoreFCFCoverage(fcf: number, marketCap: number, yield_: number): number {
  if (yield_ <= 0) return 5;
  const dividendCost = marketCap * (yield_ / 100);
  const coverage = fcf / dividendCost;
  if (coverage >= 2.0) return 100;
  if (coverage >= 1.5) return 85;
  if (coverage >= 1.0) return 60;
  if (coverage >= 0.5) return 30;
  return 10;
}

function scoreDebt(ratio: number): number {
  if (ratio <= 0.5) return 100;
  if (ratio <= 1.0) return 80;
  if (ratio <= 1.5) return 60;
  if (ratio <= 2.0) return 40;
  return 20;
}

function scoreDividendGrowth(history: Stock["history"]): number {
  if (history.length < 2) return 50;
  let growingYears = 0;
  for (let i = 1; i < history.length; i++) {
    if (history[i].dividendPerShare > history[i - 1].dividendPerShare) {
      growingYears++;
    }
  }
  const ratio = growingYears / (history.length - 1);
  if (ratio >= 1) return 100;
  if (ratio >= 0.75) return 80;
  if (ratio >= 0.5) return 50;
  return 25;
}

export function computeDividendScore(stock: Stock): {
  subScores: SubScore[];
  explanations: Explanation[];
} {
  const yieldScore = scoreDividendYield(stock.dividendYield);
  const yieldValue = yieldScore;

  const payoutScore = scorePayoutRatio(stock.payoutRatio);
  const fcfScore = scoreFCFCoverage(
    stock.freeCashFlow,
    stock.marketCap,
    stock.dividendYield
  );
  const sustainabilityValue = Math.round(payoutScore * 0.5 + fcfScore * 0.5);

  const debtScore = scoreDebt(stock.debtToEquity);
  const divGrowthScore = scoreDividendGrowth(stock.history);
  const stabilityValue = Math.round(debtScore * 0.4 + divGrowthScore * 0.6);

  const subScores: SubScore[] = [
    {
      name: "yield",
      value: yieldValue,
      weight: 0.3,
      label: "Rendement",
    },
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

  const explanations: Explanation[] = [];

  // Yield
  if (stock.dividendYield >= 4) {
    explanations.push({
      text: `Rendement eleve (${stock.dividendYield}%)`,
      type: "positive",
      metric: "Div. Yield",
      value: `${stock.dividendYield}%`,
    });
  } else if (stock.dividendYield >= 2) {
    explanations.push({
      text: `Rendement correct (${stock.dividendYield}%)`,
      type: "neutral",
      metric: "Div. Yield",
      value: `${stock.dividendYield}%`,
    });
  } else if (stock.dividendYield > 0) {
    explanations.push({
      text: `Rendement faible (${stock.dividendYield}%)`,
      type: "negative",
      metric: "Div. Yield",
      value: `${stock.dividendYield}%`,
    });
  } else {
    explanations.push({
      text: `Pas de dividende verse`,
      type: "negative",
      metric: "Div. Yield",
      value: `0%`,
    });
  }

  // Payout ratio
  if (stock.payoutRatio >= 30 && stock.payoutRatio <= 60) {
    explanations.push({
      text: `Payout ratio equilibre (${stock.payoutRatio}%) : dividende bien couvert`,
      type: "positive",
      metric: "Payout Ratio",
      value: `${stock.payoutRatio}%`,
    });
  } else if (stock.payoutRatio > 75) {
    explanations.push({
      text: `Payout ratio eleve (${stock.payoutRatio}%) : peu de marge de securite`,
      type: "negative",
      metric: "Payout Ratio",
      value: `${stock.payoutRatio}%`,
    });
  } else if (stock.payoutRatio > 0) {
    explanations.push({
      text: `Payout ratio (${stock.payoutRatio}%)`,
      type: "neutral",
      metric: "Payout Ratio",
      value: `${stock.payoutRatio}%`,
    });
  }

  // FCF coverage
  if (stock.freeCashFlow > 0 && stock.dividendYield > 0) {
    const dividendCost = stock.marketCap * (stock.dividendYield / 100);
    const coverage = stock.freeCashFlow / dividendCost;
    if (coverage >= 2) {
      explanations.push({
        text: `Cash flow couvre largement le dividende (${coverage.toFixed(1)}x)`,
        type: "positive",
        metric: "FCF Coverage",
        value: `${coverage.toFixed(1)}x`,
      });
    } else if (coverage >= 1) {
      explanations.push({
        text: `Cash flow couvre le dividende (${coverage.toFixed(1)}x)`,
        type: "neutral",
        metric: "FCF Coverage",
        value: `${coverage.toFixed(1)}x`,
      });
    } else {
      explanations.push({
        text: `Cash flow insuffisant pour couvrir le dividende`,
        type: "negative",
        metric: "FCF Coverage",
        value: `${coverage.toFixed(1)}x`,
      });
    }
  }

  // Dividend growth
  const hasGrowth = stock.history.length >= 2 &&
    stock.history.every(
      (h, i) => i === 0 || h.dividendPerShare >= stock.history[i - 1].dividendPerShare
    );
  if (hasGrowth && stock.dividendYield > 0) {
    explanations.push({
      text: `Dividende en croissance continue`,
      type: "positive",
      metric: "Div. Growth",
      value: "Oui",
    });
  }

  // Debt
  if (stock.debtToEquity <= 1.0) {
    explanations.push({
      text: `Endettement maitrise (D/E: ${stock.debtToEquity})`,
      type: "positive",
      metric: "Dette/Capitaux",
      value: `${stock.debtToEquity}`,
    });
  } else if (stock.debtToEquity > 2) {
    explanations.push({
      text: `Endettement eleve (D/E: ${stock.debtToEquity}) : risque pour le dividende`,
      type: "negative",
      metric: "Dette/Capitaux",
      value: `${stock.debtToEquity}`,
    });
  }

  return { subScores, explanations };
}
