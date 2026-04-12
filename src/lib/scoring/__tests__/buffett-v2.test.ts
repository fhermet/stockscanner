import { describe, it, expect } from "vitest";
import { Stock } from "../../types";

import "../strategies/buffett";
import { scoreStock } from "../engine";
import { applyBuffettPreFilters, DEFAULT_PRE_FILTER_CONFIG } from "../pre-filters";
import { buildPortfolio, checkRebalanceTriggers, DEFAULT_PORTFOLIO_CONFIG } from "../portfolio";
import { scoreMetric } from "../normalize";
import type { ScoredStock } from "../../types";

// --- Test fixtures ---

const MSFT: Stock = {
  ticker: "MSFT",
  name: "Microsoft",
  sector: "Technologie",
  country: "USA",
  exchange: "NASDAQ",
  currency: "USD",
  marketCap: 3100,
  price: 415.0,
  per: 35,
  peg: 2.0,
  roic: 25,
  debtToOcf: 0.8,
  operatingMargin: 44.6,
  freeCashFlow: 70,
  revenueGrowth: 15.7,
  epsGrowth: 18.2,
  dividendYield: 0.72,
  payoutRatio: 25,
  history: [
    { year: 2020, revenue: 143015, eps: 5.76, dividendPerShare: 2.04 },
    { year: 2021, revenue: 168088, eps: 8.05, dividendPerShare: 2.24 },
    { year: 2022, revenue: 198270, eps: 9.21, dividendPerShare: 2.48 },
    { year: 2023, revenue: 211915, eps: 10.31, dividendPerShare: 2.72 },
    { year: 2024, revenue: 245122, eps: 12.19, dividendPerShare: 3.0 },
  ],
  // Buffett v2 metrics
  netIncome: 88,
  operatingIncome: 109,
  enterpriseValue: 3200,
  interestCoverage: null, // not available
  evToEbit: 29.4,
  roicStability: 3.2,
  revenueCagr5y: 11.4,
  roicAvg5y: 28,
  fcfPositiveYears: 5,
  perAvg5y: 32,
  evToEbitAvg5y: 26,
  priceToFcfAvg5y: 40,
};

const WEAK_STOCK: Stock = {
  ticker: "WEAK",
  name: "Weak Corp",
  sector: "Industrie",
  country: "USA",
  exchange: "NYSE",
  currency: "USD",
  marketCap: 10,
  price: 5,
  per: 50,
  peg: 5.0,
  roic: 3,
  debtToOcf: 8,
  operatingMargin: -2,
  freeCashFlow: -1,
  revenueGrowth: -5,
  epsGrowth: -10,
  dividendYield: 0,
  payoutRatio: 0,
  history: [
    { year: 2020, revenue: 5000, eps: 0.5, dividendPerShare: 0 },
    { year: 2021, revenue: 4800, eps: 0.3, dividendPerShare: 0 },
    { year: 2022, revenue: 4500, eps: 0.1, dividendPerShare: 0 },
    { year: 2023, revenue: 4200, eps: -0.1, dividendPerShare: 0 },
    { year: 2024, revenue: 4000, eps: -0.2, dividendPerShare: 0 },
  ],
  netIncome: -0.5,
  operatingIncome: -0.3,
  enterpriseValue: 12,
  interestCoverage: null,
  evToEbit: null,
  roicStability: 12,
  revenueCagr5y: -4.4,
  roicAvg5y: 2,
  fcfPositiveYears: 1,
};

// --- Buffett v2 sub-scores ---

describe("Buffett v2: 4 sub-scores with correct weights", () => {
  it("returns 4 sub-scores: quality, strength, valuation, durability", () => {
    const result = scoreStock(MSFT, "buffett");
    expect(result.subScores).toHaveLength(4);
    expect(result.subScores.map((s) => s.name)).toEqual([
      "quality", "strength", "valuation", "durability",
    ]);
  });

  it("weights sum to 1.0 (35+25+25+15)", () => {
    const result = scoreStock(MSFT, "buffett");
    const totalWeight = result.subScores.reduce((a, s) => a + s.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 10);
  });

  it("quality weight is 0.35", () => {
    const result = scoreStock(MSFT, "buffett");
    const quality = result.subScores.find((s) => s.name === "quality")!;
    expect(quality.weight).toBe(0.35);
  });

  it("durability weight is 0.15", () => {
    const result = scoreStock(MSFT, "buffett");
    const durability = result.subScores.find((s) => s.name === "durability")!;
    expect(durability.weight).toBe(0.15);
  });
});

describe("Buffett v2: ROIC normalization 0-40%", () => {
  it("ROIC 40% scores 100", () => {
    expect(scoreMetric("roic", 40)).toBe(100);
  });

  it("ROIC 20% scores 50", () => {
    expect(scoreMetric("roic", 20)).toBe(50);
  });

  it("ROIC > 40% is capped at 100", () => {
    expect(scoreMetric("roic", 60)).toBe(100);
  });
});

describe("Buffett v2: new normalization ranges", () => {
  it("interestCoverage 2x scores 0, 20x scores 100", () => {
    expect(scoreMetric("interestCoverage", 2)).toBe(0);
    expect(scoreMetric("interestCoverage", 20)).toBe(100);
  });

  it("evToEbit inverse: 8x scores 100, 40x scores 0", () => {
    expect(scoreMetric("evToEbit", 8)).toBe(100);
    expect(scoreMetric("evToEbit", 40)).toBe(0);
  });

  it("priceToFcf inverse: 8x scores 100, 40x scores 0", () => {
    expect(scoreMetric("priceToFcf", 8)).toBe(100);
    expect(scoreMetric("priceToFcf", 40)).toBe(0);
  });

  it("fcfConversion: 0% scores 0, 120% scores 100", () => {
    expect(scoreMetric("fcfConversion", 0)).toBe(0);
    expect(scoreMetric("fcfConversion", 120)).toBe(100);
  });

  it("roicStability inverse: 2% (stable) scores 100, 15% (volatile) scores 0", () => {
    expect(scoreMetric("roicStability", 2)).toBe(100);
    expect(scoreMetric("roicStability", 15)).toBe(0);
  });

  it("revenueCagr: 0% scores 0, 15% scores 100", () => {
    expect(scoreMetric("revenueCagr", 0)).toBe(0);
    expect(scoreMetric("revenueCagr", 15)).toBe(100);
  });
});

describe("Buffett v2: FCF Yield removed from quality", () => {
  it("quality does not use FCF yield", () => {
    // Stock with high FCF yield but no new metrics
    const stockHighFcfYield: Stock = {
      ...MSFT,
      freeCashFlow: 300, // extreme FCF yield (300/3100 ≈ 10%)
      netIncome: undefined, // no new metrics → fcfConversion null
      roicStability: undefined,
    };
    const result1 = scoreStock(stockHighFcfYield, "buffett");
    const quality1 = result1.subScores.find((s) => s.name === "quality")!.value!;

    const stockLowFcfYield: Stock = {
      ...MSFT,
      freeCashFlow: 1, // tiny FCF yield
      netIncome: undefined,
      roicStability: undefined,
    };
    const result2 = scoreStock(stockLowFcfYield, "buffett");
    const quality2 = result2.subScores.find((s) => s.name === "quality")!.value!;

    // Quality should be similar since FCF yield is no longer in quality
    // Both have same ROIC + margin, only difference is FCF conversion
    // but netIncome is undefined so fcfConversion is null
    expect(Math.abs(quality1 - quality2)).toBeLessThan(5);
  });
});

// --- Pre-filters ---

describe("Buffett v2: pre-filters", () => {
  it("MSFT passes all pre-filters", () => {
    const result = applyBuffettPreFilters(MSFT);
    expect(result.passed).toBe(true);
    expect(result.failedReasons).toHaveLength(0);
  });

  it("weak stock fails multiple pre-filters", () => {
    const result = applyBuffettPreFilters(WEAK_STOCK);
    expect(result.passed).toBe(false);
    expect(result.failedReasons.length).toBeGreaterThan(0);
  });

  it("fails on declining revenue", () => {
    const declining: Stock = {
      ...MSFT,
      history: [
        { year: 2020, revenue: 10000, eps: 1, dividendPerShare: 0 },
        { year: 2021, revenue: 9000, eps: 1, dividendPerShare: 0 },
        { year: 2022, revenue: 8000, eps: 1, dividendPerShare: 0 },
        { year: 2023, revenue: 7000, eps: 1, dividendPerShare: 0 },
        { year: 2024, revenue: 6000, eps: 1, dividendPerShare: 0 },
      ],
      fcfPositiveYears: 2,
    };
    const result = applyBuffettPreFilters(declining);
    expect(result.passed).toBe(false);
    expect(result.failedReasons.some((r) => r.includes("declin"))).toBe(true);
  });

  it("tolerates revenue decline if FCF improving", () => {
    const declining: Stock = {
      ...MSFT,
      history: [
        { year: 2020, revenue: 10000, eps: 1, dividendPerShare: 0 },
        { year: 2021, revenue: 9000, eps: 1, dividendPerShare: 0 },
        { year: 2022, revenue: 8500, eps: 1, dividendPerShare: 0 },
      ],
      fcfPositiveYears: 4, // strong FCF
    };
    const result = applyBuffettPreFilters(declining);
    // Revenue declined but FCF is strong → tolerance
    const revenueFailed = result.failedReasons.some((r) => r.includes("declin"));
    expect(revenueFailed).toBe(false);
  });

  it("fails on low ROIC avg", () => {
    const lowRoic: Stock = { ...MSFT, roicAvg5y: 4 };
    const result = applyBuffettPreFilters(lowRoic);
    expect(result.passed).toBe(false);
    expect(result.failedReasons.some((r) => r.includes("ROIC moyen"))).toBe(true);
  });

  it("ROIC threshold is configurable", () => {
    const stock: Stock = { ...MSFT, roicAvg5y: 5 };
    // Default threshold is 6% → fails
    const fail = applyBuffettPreFilters(stock);
    expect(fail.passed).toBe(false);
    // Custom threshold of 4% → passes
    const pass = applyBuffettPreFilters(stock, { ...DEFAULT_PRE_FILTER_CONFIG, minRoicAvg5y: 4 });
    expect(pass.passed).toBe(true);
  });

  it("fails on negative operating margin", () => {
    const negMargin: Stock = { ...MSFT, operatingMargin: -5 };
    const result = applyBuffettPreFilters(negMargin);
    expect(result.passed).toBe(false);
    expect(result.failedReasons.some((r) => r.includes("Marge operationnelle"))).toBe(true);
  });

  it("fails on insufficient positive FCF years", () => {
    const lowFcf: Stock = { ...MSFT, fcfPositiveYears: 1 };
    const result = applyBuffettPreFilters(lowFcf);
    expect(result.passed).toBe(false);
    expect(result.failedReasons.some((r) => r.includes("FCF positif"))).toBe(true);
  });

  it("fails on excessive debt (Debt/OCF > 10x)", () => {
    const zombie: Stock = { ...MSFT, debtToOcf: 12 };
    const result = applyBuffettPreFilters(zombie);
    expect(result.passed).toBe(false);
    expect(result.failedReasons.some((r) => r.includes("Endettement excessif"))).toBe(true);
  });

  it("fails on negative OCF (Debt/OCF < 0)", () => {
    const negOcf: Stock = { ...MSFT, debtToOcf: -3 };
    const result = applyBuffettPreFilters(negOcf);
    expect(result.passed).toBe(false);
    expect(result.failedReasons.some((r) => r.includes("negatif"))).toBe(true);
  });

  it("passes debt filter at exactly the threshold", () => {
    const atLimit: Stock = { ...MSFT, debtToOcf: 10 };
    const result = applyBuffettPreFilters(atLimit);
    // 10 is at the limit, not above → passes
    const debtFailed = result.failedReasons.some((r) => r.includes("Endettement"));
    expect(debtFailed).toBe(false);
  });

  it("debt threshold is configurable", () => {
    const stock: Stock = { ...MSFT, debtToOcf: 7 };
    // Default 10x → passes
    const pass = applyBuffettPreFilters(stock);
    expect(pass.failedReasons.some((r) => r.includes("Endettement"))).toBe(false);
    // Custom 5x → fails
    const fail = applyBuffettPreFilters(stock, { ...DEFAULT_PRE_FILTER_CONFIG, maxDebtToOcf: 5 });
    expect(fail.failedReasons.some((r) => r.includes("Endettement"))).toBe(true);
  });

  it("passes pre-filter when data is missing (conservative: don't exclude)", () => {
    const noData: Stock = {
      ...MSFT,
      roicAvg5y: undefined,
      fcfPositiveYears: undefined,
      operatingMargin: null,
      debtToOcf: null,
    };
    const result = applyBuffettPreFilters(noData);
    // Missing data: pass (don't penalize for missing data)
    expect(result.passed).toBe(true);
  });

  it("engine returns null total with pre-filter explanations for excluded stock", () => {
    const result = scoreStock(WEAK_STOCK, "buffett");
    expect(result.total).toBeNull();
    expect(result.explanations.length).toBeGreaterThan(0);
    expect(result.explanations[0].type).toBe("negative");
    expect(result.explanations[0].metric).toBe("Pre-filtre");
  });

  it("engine still scores stock that passes pre-filters", () => {
    const result = scoreStock(MSFT, "buffett");
    expect(result.total).not.toBeNull();
    expect(result.total).toBeGreaterThan(0);
    // No pre-filter explanation
    expect(result.explanations.every((e) => e.metric !== "Pre-filtre")).toBe(true);
  });
});

// --- Portfolio construction ---

describe("Buffett v2: portfolio construction", () => {
  function makeScoredStock(
    ticker: string,
    sector: string,
    total: number,
  ): ScoredStock {
    return {
      stock: {
        ticker, name: ticker, sector, country: "USA", exchange: "NYSE",
        currency: "USD", marketCap: 100, price: 50, per: 20, peg: 1.5,
        roic: 20, debtToOcf: 2, operatingMargin: 20, freeCashFlow: 5,
        revenueGrowth: 10, epsGrowth: 12, dividendYield: 1, payoutRatio: 30,
        history: [],
      },
      score: {
        strategyId: "buffett", total,
        subScores: [
          { name: "quality", value: total, weight: 0.35, label: "Q" },
          { name: "strength", value: total, weight: 0.25, label: "S" },
          { name: "valuation", value: total, weight: 0.25, label: "V" },
          { name: "durability", value: total, weight: 0.15, label: "D" },
        ],
        explanations: [], confidence: "high",
        dataCompleteness: { score: 100, available: [], missing: [] },
      },
    };
  }

  it("selects top 20% of stocks", () => {
    const stocks = Array.from({ length: 20 }, (_, i) =>
      makeScoredStock(`S${i}`, i % 4 === 0 ? "Tech" : i % 4 === 1 ? "Sante" : i % 4 === 2 ? "Finance" : "Industrie", 90 - i * 2),
    );
    const result = buildPortfolio(stocks);
    expect(result.totalPositions).toBeLessThanOrEqual(10);
    expect(result.totalPositions).toBeGreaterThan(0);
  });

  it("excludes stocks below minimum score", () => {
    const stocks = [
      makeScoredStock("A", "Tech", 80),
      makeScoredStock("B", "Sante", 30), // below 40 threshold
      makeScoredStock("C", "Finance", 50),
    ];
    const result = buildPortfolio(stocks);
    const tickers = result.positions.map((p) => p.ticker);
    expect(tickers).not.toContain("B");
  });

  it("applies cash rule when < 10 stocks qualify", () => {
    const stocks = [
      makeScoredStock("A", "Tech", 80),
      makeScoredStock("B", "Sante", 70),
      makeScoredStock("C", "Finance", 60),
    ];
    const result = buildPortfolio(stocks);
    expect(result.cashWeight).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("cash"))).toBe(true);
  });

  it("position weight does not exceed cap", () => {
    const stocks = [
      makeScoredStock("A", "Tech", 95),
      makeScoredStock("B", "Sante", 50),
      makeScoredStock("C", "Finance", 50),
    ];
    const result = buildPortfolio(stocks, { ...DEFAULT_PORTFOLIO_CONFIG, maxPositionWeight: 0.08 });
    for (const pos of result.positions) {
      expect(pos.weight).toBeLessThanOrEqual(0.08 + 0.01); // small rounding tolerance
    }
  });

  it("returns 100% cash when no stocks qualify", () => {
    const stocks = [makeScoredStock("A", "Tech", 20)]; // below 40 threshold
    const result = buildPortfolio(stocks);
    expect(result.totalPositions).toBe(0);
    expect(result.cashWeight).toBe(1);
  });
});

describe("Buffett v2: rebalance triggers", () => {
  function makeScoredStockForTrigger(ticker: string, total: number): ScoredStock {
    return {
      stock: {
        ticker, name: ticker, sector: "Tech", country: "USA", exchange: "NYSE",
        currency: "USD", marketCap: 100, price: 50, per: 20, peg: 1.5,
        roic: 20, debtToOcf: 2, operatingMargin: 20, freeCashFlow: 5,
        revenueGrowth: 10, epsGrowth: 12, dividendYield: 1, payoutRatio: 30,
        history: [],
      },
      score: {
        strategyId: "buffett", total,
        subScores: [], explanations: [], confidence: "high",
        dataCompleteness: { score: 100, available: [], missing: [] },
      },
    };
  }

  it("detects score drop below 40", () => {
    const scores = [makeScoredStockForTrigger("A", 35)];
    const positions = [{ ticker: "A", name: "A", sector: "Tech", score: 60, weight: 0.5 }];
    const triggers = checkRebalanceTriggers(scores, positions);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].type).toBe("score_drop");
  });

  it("detects price drop > 30%", () => {
    const scores = [makeScoredStockForTrigger("A", 60)];
    const positions = [{ ticker: "A", name: "A", sector: "Tech", score: 60, weight: 0.5 }];
    const triggers = checkRebalanceTriggers(scores, positions, { A: -35 });
    expect(triggers).toHaveLength(1);
    expect(triggers[0].type).toBe("price_drop");
  });

  it("no trigger when everything is fine", () => {
    const scores = [makeScoredStockForTrigger("A", 70)];
    const positions = [{ ticker: "A", name: "A", sector: "Tech", score: 70, weight: 0.5 }];
    const triggers = checkRebalanceTriggers(scores, positions, { A: -5 });
    expect(triggers).toHaveLength(0);
  });
});

// --- Valuation: sector + historical adjustment ---

describe("Buffett v2: valuation with historical comparison", () => {
  it("stock trading below its own 5yr avg PER gets valuation bonus", () => {
    const cheap: Stock = { ...MSFT, per: 20, perAvg5y: 35 };
    const expensive: Stock = { ...MSFT, per: 45, perAvg5y: 30 };

    const cheapScore = scoreStock(cheap, "buffett");
    const expensiveScore = scoreStock(expensive, "buffett");

    const cheapVal = cheapScore.subScores.find((s) => s.name === "valuation")!.value!;
    const expensiveVal = expensiveScore.subScores.find((s) => s.name === "valuation")!.value!;

    expect(cheapVal).toBeGreaterThan(expensiveVal);
  });
});

// --- Edge cases ---

describe("Buffett v2: edge cases", () => {
  it("handles null netIncome gracefully (fcfConversion null)", () => {
    const noNI: Stock = { ...MSFT, netIncome: null };
    const result = scoreStock(noNI, "buffett");
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("handles negative netIncome (fcfConversion = 0)", () => {
    const negNI: Stock = { ...MSFT, netIncome: -5 };
    const result = scoreStock(negNI, "buffett");
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("handles negative freeCashFlow (priceToFcf null)", () => {
    const negFCF: Stock = { ...MSFT, freeCashFlow: -5 };
    const result = scoreStock(negFCF, "buffett");
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("handles all new metrics as undefined (backward compat)", () => {
    const oldStock: Stock = {
      ticker: "OLD", name: "Old Corp", sector: "Technologie", country: "USA",
      exchange: "NYSE", currency: "USD", marketCap: 100, price: 50, per: 20,
      peg: 1.5, roic: 20, debtToOcf: 2, operatingMargin: 20, freeCashFlow: 5,
      revenueGrowth: 10, epsGrowth: 12, dividendYield: 1, payoutRatio: 30,
      history: [],
    };
    const result = scoreStock(oldStock, "buffett");
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("all sub-scores bounded 0-100", () => {
    const extreme: Stock = {
      ...MSFT,
      roic: 200,
      operatingMargin: 100,
      per: 1,
      netIncome: 0.001,
      freeCashFlow: 1000,
      evToEbit: 0.5,
      roicStability: 0.1,
      revenueCagr5y: 50,
    };
    const result = scoreStock(extreme, "buffett");
    for (const sub of result.subScores) {
      if (sub.value !== null) {
        expect(sub.value).toBeGreaterThanOrEqual(0);
        expect(sub.value).toBeLessThanOrEqual(100);
      }
    }
  });
});
