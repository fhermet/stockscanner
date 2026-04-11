import { describe, it, expect, beforeAll } from "vitest";
import { Stock } from "../../types";

import "../strategies/buffett";
import "../strategies/lynch";
import "../strategies/growth";
import "../strategies/dividend";
import { scoreStock, getAllScorerIds } from "../engine";

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
  roe: 38,
  debtToEquity: 0.35,
  operatingMargin: 44.6,
  freeCashFlow: 70,
  revenueGrowth: 15.7,
  epsGrowth: 18.2,
  dividendYield: 0.72,
  payoutRatio: 25,
  history: [
    { year: 2021, revenue: 168088, eps: 8.05, dividendPerShare: 2.24 },
    { year: 2022, revenue: 198270, eps: 9.21, dividendPerShare: 2.48 },
    { year: 2023, revenue: 211915, eps: 10.31, dividendPerShare: 2.72 },
    { year: 2024, revenue: 245122, eps: 12.19, dividendPerShare: 3.0 },
  ],
};

const T_STOCK: Stock = {
  ticker: "T",
  name: "AT&T",
  sector: "Telecom",
  country: "USA",
  exchange: "NYSE",
  currency: "USD",
  marketCap: 160,
  price: 22.5,
  per: 10,
  peg: 4.0,
  roe: 12,
  debtToEquity: 1.2,
  operatingMargin: 18.5,
  freeCashFlow: 16,
  revenueGrowth: 1.5,
  epsGrowth: 2.5,
  dividendYield: 4.9,
  payoutRatio: 49,
  history: [
    { year: 2021, revenue: 168864, eps: 1.78, dividendPerShare: 2.08 },
    { year: 2022, revenue: 120741, eps: 1.52, dividendPerShare: 1.39 },
    { year: 2023, revenue: 122428, eps: 1.82, dividendPerShare: 1.11 },
    { year: 2024, revenue: 124264, eps: 1.87, dividendPerShare: 1.11 },
  ],
};

beforeAll(() => {
  // Strategies are auto-registered via imports above
});

describe("strategy registry", () => {
  it("has all 4 strategies registered", () => {
    const ids = getAllScorerIds();
    expect(ids).toContain("buffett");
    expect(ids).toContain("lynch");
    expect(ids).toContain("growth");
    expect(ids).toContain("dividend");
  });
});

describe("scoring produces valid output", () => {
  const strategies = ["buffett", "lynch", "growth", "dividend"] as const;

  for (const strategyId of strategies) {
    it(`${strategyId}: score is between 0 and 100`, () => {
      const result = scoreStock(MSFT, strategyId);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it(`${strategyId}: has sub-scores with valid weights`, () => {
      const result = scoreStock(MSFT, strategyId);
      expect(result.subScores.length).toBeGreaterThan(0);
      const totalWeight = result.subScores.reduce((s, sub) => s + sub.weight, 0);
      expect(totalWeight).toBeCloseTo(1, 1);
    });

    it(`${strategyId}: has explanations`, () => {
      const result = scoreStock(MSFT, strategyId);
      expect(result.explanations.length).toBeGreaterThan(0);
    });

    it(`${strategyId}: has confidence and completeness`, () => {
      const result = scoreStock(MSFT, strategyId);
      expect(["high", "medium", "low"]).toContain(result.confidence);
      expect(result.dataCompleteness.score).toBeGreaterThanOrEqual(0);
      expect(result.dataCompleteness.score).toBeLessThanOrEqual(100);
    });
  }
});

describe("strategy differentiation", () => {
  it("MSFT scores well in both lynch and buffett", () => {
    const lynchScore = scoreStock(MSFT, "lynch").total!;
    const buffettScore = scoreStock(MSFT, "buffett").total!;
    expect(lynchScore).toBeGreaterThan(50);
    expect(buffettScore).toBeGreaterThan(50);
  });

  it("AT&T scores higher in dividend than growth", () => {
    const growthScore = scoreStock(T_STOCK, "growth").total!;
    const dividendScore = scoreStock(T_STOCK, "dividend").total!;
    expect(dividendScore).toBeGreaterThan(growthScore);
  });
});

describe("partial data handling", () => {
  it("returns null total for stocks with null metrics", () => {
    const empty: Stock = {
      ticker: "EMPTY",
      name: "Empty Corp",
      sector: "Autre",
      country: "USA",
      exchange: "N/A",
      currency: "USD",
      marketCap: 1,
      price: 1,
      per: null,
      peg: null,
      roe: null,
      debtToEquity: null,
      operatingMargin: null,
      freeCashFlow: null,
      revenueGrowth: null,
      epsGrowth: null,
      dividendYield: null,
      payoutRatio: null,
      history: [],
    };

    for (const strategyId of ["buffett", "lynch", "growth", "dividend"] as const) {
      const result = scoreStock(empty, strategyId);
      expect(result.total).toBeNull();
      expect(result.dataCompleteness.missing.length).toBeGreaterThan(0);
    }
  });
});

describe("N/A scoring for missing data", () => {
  const MISSING_PER: Stock = {
    ...MSFT,
    per: null,
  };

  it("buffett returns null total when PER is missing", () => {
    const result = scoreStock(MISSING_PER, "buffett");
    expect(result.total).toBeNull();
    expect(result.dataCompleteness.missing).toContain("PER");
  });

  const MISSING_PEG: Stock = {
    ...MSFT,
    peg: null,
  };

  it("lynch returns null total when PEG is missing", () => {
    const result = scoreStock(MISSING_PEG, "lynch");
    expect(result.total).toBeNull();
    expect(result.dataCompleteness.missing).toContain("PEG");
  });

  const NO_HISTORY: Stock = {
    ...MSFT,
    history: [],
  };

  it("dividend returns null total when history is missing", () => {
    const result = scoreStock(NO_HISTORY, "dividend");
    expect(result.total).toBeNull();
    expect(result.dataCompleteness.missing).toContain("historique dividende");
  });

  it("complete stock still produces numeric score", () => {
    const result = scoreStock(MSFT, "buffett");
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });
});
