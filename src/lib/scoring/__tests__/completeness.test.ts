import { describe, it, expect } from "vitest";
import { computeDataCompleteness, computeConfidence } from "../completeness";
import { Stock } from "../../types";

const COMPLETE_STOCK: Stock = {
  ticker: "TEST",
  name: "Test Corp",
  sector: "Technologie",
  country: "USA",
  exchange: "NASDAQ",
  currency: "USD",
  marketCap: 100,
  price: 50,
  per: 20,
  peg: 1.5,
  roe: 25,
  debtToEquity: 0.5,
  operatingMargin: 20,
  freeCashFlow: 5,
  revenueGrowth: 10,
  epsGrowth: 12,
  dividendYield: 2.0,
  payoutRatio: 40,
  history: [
    { year: 2023, revenue: 1000, eps: 2.5, dividendPerShare: 1.0 },
    { year: 2024, revenue: 1100, eps: 2.8, dividendPerShare: 1.1 },
  ],
};

const PARTIAL_STOCK: Stock = {
  ...COMPLETE_STOCK,
  per: 0,
  roe: 0,
  operatingMargin: 0,
  debtToEquity: -1,
};

describe("computeDataCompleteness", () => {
  it("returns 100% for a complete stock in buffett mode", () => {
    const result = computeDataCompleteness(COMPLETE_STOCK, "buffett");
    expect(result.score).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it("identifies missing metrics for partial data", () => {
    const result = computeDataCompleteness(PARTIAL_STOCK, "buffett");
    expect(result.score).toBeLessThan(100);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("checks dividend-specific metrics for dividend strategy", () => {
    const noDividend: Stock = { ...COMPLETE_STOCK, dividendYield: 0, payoutRatio: 0 };
    const result = computeDataCompleteness(noDividend, "dividend");
    expect(result.missing).toContain("rendement dividende");
    expect(result.missing).toContain("payout ratio");
  });
});

describe("computeConfidence", () => {
  it("returns high for >= 85%", () => {
    expect(computeConfidence({ score: 100, available: [], missing: [] })).toBe("high");
    expect(computeConfidence({ score: 85, available: [], missing: [] })).toBe("high");
  });

  it("returns medium for >= 60%", () => {
    expect(computeConfidence({ score: 60, available: [], missing: [] })).toBe("medium");
    expect(computeConfidence({ score: 75, available: [], missing: [] })).toBe("medium");
  });

  it("returns low for < 60%", () => {
    expect(computeConfidence({ score: 50, available: [], missing: [] })).toBe("low");
    expect(computeConfidence({ score: 0, available: [], missing: [] })).toBe("low");
  });
});
