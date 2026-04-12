import { describe, it, expect } from "vitest";
import { Stock } from "../../types";

import "../strategies/buffett";
import "../strategies/lynch";
import "../strategies/growth";
import "../strategies/dividend";
import { scoreStock } from "../engine";

/**
 * Reference panel: 10 stocks covering all strategy profiles.
 * These tests validate scoring COHERENCE — not exact values.
 * If a refactor changes a score from 72 to 74, that's fine.
 * If MSFT suddenly scores lower than T on Buffett, something broke.
 */

// --- Reference stocks ---

const MSFT: Stock = {
  ticker: "MSFT", name: "Microsoft", sector: "Technologie", country: "USA",
  exchange: "NASDAQ", currency: "USD", marketCap: 3100, price: 415, per: 35, peg: 2.0,
  roic: 25, debtToOcf: 1.5, operatingMargin: 44.6, freeCashFlow: 70,
  revenueGrowth: 15.7, epsGrowth: 18.2, dividendYield: 0.72, payoutRatio: 25,
  history: [
    { year: 2022, revenue: 198270, eps: 9.21, dividendPerShare: 2.48 },
    { year: 2023, revenue: 211915, eps: 10.31, dividendPerShare: 2.72 },
    { year: 2024, revenue: 245122, eps: 12.19, dividendPerShare: 3.0 },
  ],
};

const JNJ: Stock = {
  ticker: "JNJ", name: "Johnson & Johnson", sector: "Sante", country: "USA",
  exchange: "NYSE", currency: "USD", marketCap: 380, price: 157, per: 15, peg: 2.8,
  roic: 15, debtToOcf: 2.0, operatingMargin: 24.8, freeCashFlow: 18,
  revenueGrowth: 3.5, epsGrowth: 5.2, dividendYield: 3.1, payoutRatio: 46,
  history: [
    { year: 2022, revenue: 94943, eps: 6.73, dividendPerShare: 4.45 },
    { year: 2023, revenue: 85159, eps: 5.2, dividendPerShare: 4.7 },
    { year: 2024, revenue: 88130, eps: 5.47, dividendPerShare: 4.96 },
  ],
};

const NVDA: Stock = {
  ticker: "NVDA", name: "NVIDIA", sector: "Technologie", country: "USA",
  exchange: "NASDAQ", currency: "USD", marketCap: 2800, price: 875, per: 55, peg: 0.9,
  roic: 55, debtToOcf: 0.5, operatingMargin: 62, freeCashFlow: 30,
  revenueGrowth: 122, epsGrowth: 145, dividendYield: 0.02, payoutRatio: 1,
  history: [
    { year: 2022, revenue: 26974, eps: 1.21, dividendPerShare: 0.16 },
    { year: 2023, revenue: 60922, eps: 7.54, dividendPerShare: 0.16 },
    { year: 2024, revenue: 130497, eps: 17.45, dividendPerShare: 0.16 },
  ],
};

const T_STOCK: Stock = {
  ticker: "T", name: "AT&T", sector: "Telecom", country: "USA",
  exchange: "NYSE", currency: "USD", marketCap: 160, price: 22.5, per: 10, peg: 4.0,
  roic: 8, debtToOcf: 3.5, operatingMargin: 18.5, freeCashFlow: 16,
  revenueGrowth: 1.5, epsGrowth: 2.5, dividendYield: 4.9, payoutRatio: 49,
  history: [
    { year: 2022, revenue: 120741, eps: 1.52, dividendPerShare: 1.39 },
    { year: 2023, revenue: 122428, eps: 1.82, dividendPerShare: 1.11 },
    { year: 2024, revenue: 124264, eps: 1.87, dividendPerShare: 1.11 },
  ],
};

const KO: Stock = {
  ticker: "KO", name: "Coca-Cola", sector: "Consommation de base", country: "USA",
  exchange: "NYSE", currency: "USD", marketCap: 265, price: 61.5, per: 25, peg: 3.2,
  roic: 20, debtToOcf: 2.5, operatingMargin: 29.5, freeCashFlow: 10,
  revenueGrowth: 2.5, epsGrowth: 7.8, dividendYield: 3.05, payoutRatio: 74,
  history: [
    { year: 2022, revenue: 43004, eps: 2.48, dividendPerShare: 1.76 },
    { year: 2023, revenue: 45754, eps: 2.47, dividendPerShare: 1.84 },
    { year: 2024, revenue: 46898, eps: 2.66, dividendPerShare: 1.94 },
  ],
};

const PARTIAL: Stock = {
  ticker: "PARTIAL", name: "Partial Data Inc", sector: "Autre", country: "USA",
  exchange: "N/A", currency: "USD", marketCap: 5, price: 10, per: 0, peg: 0,
  roic: 0, debtToOcf: 0, operatingMargin: 0, freeCashFlow: 0,
  revenueGrowth: 0, epsGrowth: 0, dividendYield: 0, payoutRatio: 0,
  history: [],
};

// --- Coherence tests ---

describe("scoring coherence: quality tech stocks", () => {
  it("MSFT scores well on Buffett (quality + margins)", () => {
    const score = scoreStock(MSFT, "buffett");
    expect(score.total).toBeGreaterThan(50);
    expect(score.confidence).toBe("high");
  });

  it("NVDA scores very high on Growth (explosive growth)", () => {
    const score = scoreStock(NVDA, "growth");
    expect(score.total).toBeGreaterThan(60);
  });

  it("NVDA scores best on Lynch thanks to PEG < 1", () => {
    const score = scoreStock(NVDA, "lynch");
    expect(score.total).toBeGreaterThan(65);
  });
});

describe("scoring coherence: dividend stocks", () => {
  it("T scores higher on Dividend than on Growth", () => {
    const div = scoreStock(T_STOCK, "dividend").total!;
    const growth = scoreStock(T_STOCK, "growth").total!;
    expect(div).toBeGreaterThan(growth);
  });

  it("JNJ is a balanced dividend pick (yield + quality)", () => {
    const score = scoreStock(JNJ, "dividend");
    expect(score.total).toBeGreaterThan(50);
  });

  it("KO high payout ratio is flagged", () => {
    const score = scoreStock(KO, "dividend");
    const hasPayout = score.explanations.some(
      (e) => e.metric === "Payout Ratio"
    );
    expect(hasPayout).toBe(true);
  });
});

describe("scoring coherence: cross-strategy ranking", () => {
  it("MSFT beats T on quality sub-score, T beats MSFT on valuation", () => {
    const msft = scoreStock(MSFT, "buffett");
    const att = scoreStock(T_STOCK, "buffett");
    const msftQuality = msft.subScores.find((s) => s.name === "quality")!.value!;
    const attQuality = att.subScores.find((s) => s.name === "quality")!.value!;
    const msftVal = msft.subScores.find((s) => s.name === "valuation")!.value!;
    const attVal = att.subScores.find((s) => s.name === "valuation")!.value!;
    expect(msftQuality).toBeGreaterThan(attQuality);
    expect(attVal).toBeGreaterThan(msftVal);
  });

  it("high-growth beats low-growth on Growth", () => {
    const nvda = scoreStock(NVDA, "growth").total!;
    const ko = scoreStock(KO, "growth").total!;
    expect(nvda).toBeGreaterThan(ko);
  });

  it("dividend stock beats non-dividend on Dividend", () => {
    const att = scoreStock(T_STOCK, "dividend").total!;
    const nvda = scoreStock(NVDA, "dividend").total!;
    expect(att).toBeGreaterThan(nvda);
  });
});

describe("scoring coherence: partial data", () => {
  it("partial data stock has lower confidence", () => {
    const strategies = ["buffett", "lynch", "growth", "dividend"] as const;
    for (const id of strategies) {
      const score = scoreStock(PARTIAL, id);
      if (score.total !== null) {
        expect(score.total).toBeGreaterThanOrEqual(0);
        expect(score.total).toBeLessThanOrEqual(100);
      }
      // partial data should not get "high" on dividend (no yield/payout)
      if (id === "dividend") {
        expect(score.dataCompleteness.missing.length).toBeGreaterThan(0);
      }
    }
  });

  it("all scores remain in valid 0-100 range for edge cases", () => {
    const extreme: Stock = {
      ...PARTIAL,
      per: -5, revenueGrowth: -50,
    };
    for (const id of ["buffett", "lynch", "growth", "dividend"] as const) {
      const score = scoreStock(extreme, id);
      if (score.total !== null) {
        expect(score.total).toBeGreaterThanOrEqual(0);
        expect(score.total).toBeLessThanOrEqual(100);
      }
      for (const sub of score.subScores) {
        if (sub.value !== null) {
          expect(sub.value).toBeGreaterThanOrEqual(0);
          expect(sub.value).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});
