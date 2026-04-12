import { describe, it, expect } from "vitest";
import { compareStocks } from "../compare";
import { ScoredStock, StrategyId } from "../../types";

function makeScoredStock(
  ticker: string,
  name: string,
  total: number,
  subScores: { name: string; value: number; label: string; weight: number }[],
  overrides?: Partial<ScoredStock["stock"]>
): ScoredStock {
  return {
    stock: {
      ticker,
      name,
      sector: "Technologie",
      country: "USA",
      exchange: "NASDAQ",
      currency: "USD",
      marketCap: 1000,
      price: 100,
      per: 25,
      peg: 1.5,
      roic: 25,
      debtToOcf: 1.5,
      operatingMargin: 25,
      freeCashFlow: 10,
      revenueGrowth: 15,
      epsGrowth: 18,
      dividendYield: 1.0,
      payoutRatio: 30,
      history: [],
      ...overrides,
    },
    score: {
      strategyId: "buffett",
      total,
      subScores,
      explanations: [],
      confidence: "high",
      dataCompleteness: { score: 100, available: [], missing: [] },
    },
  };
}

const MSFT = makeScoredStock("MSFT", "Microsoft", 78, [
  { name: "quality", value: 85, label: "Qualite", weight: 0.4 },
  { name: "strength", value: 75, label: "Solidite", weight: 0.3 },
  { name: "valuation", value: 65, label: "Valorisation", weight: 0.3 },
]);

const AAPL = makeScoredStock("AAPL", "Apple", 72, [
  { name: "quality", value: 80, label: "Qualite", weight: 0.4 },
  { name: "strength", value: 60, label: "Solidite", weight: 0.3 },
  { name: "valuation", value: 70, label: "Valorisation", weight: 0.3 },
]);

const NVDA = makeScoredStock("NVDA", "NVIDIA", 65, [
  { name: "quality", value: 90, label: "Qualite", weight: 0.4 },
  { name: "strength", value: 70, label: "Solidite", weight: 0.3 },
  { name: "valuation", value: 30, label: "Valorisation", weight: 0.3 },
]);

describe("compareStocks", () => {
  it("identifies the winner correctly", () => {
    const result = compareStocks([MSFT, AAPL, NVDA], "buffett");
    expect(result.winner?.ticker).toBe("MSFT");
    expect(result.winner?.score).toBe(78);
  });

  it("compares sub-scores with correct best/worst", () => {
    const result = compareStocks([MSFT, AAPL, NVDA], "buffett");
    const quality = result.subScoreComparison.find((c) => c.key === "quality");
    expect(quality).toBeDefined();
    expect(quality!.bestTicker).toBe("NVDA"); // 90 > 85 > 80
    expect(quality!.worstTicker).toBe("AAPL"); // 80

    const valuation = result.subScoreComparison.find((c) => c.key === "valuation");
    expect(valuation!.bestTicker).toBe("AAPL"); // 70 > 65 > 30
    expect(valuation!.worstTicker).toBe("NVDA"); // 30
  });

  it("compares metrics with inverse handling", () => {
    const result = compareStocks([MSFT, AAPL, NVDA], "buffett");
    const per = result.metricComparison.find((c) => c.key === "per");
    // All have PER=25, so best=worst (tie)
    expect(per).toBeDefined();
  });

  it("generates a non-empty summary", () => {
    const result = compareStocks([MSFT, AAPL, NVDA], "buffett");
    expect(result.summary.length).toBeGreaterThan(20);
    expect(result.summary).toContain("MSFT"); // winner
  });

  it("summary mentions laggard when gap >= 15", () => {
    const result = compareStocks([MSFT, AAPL, NVDA], "buffett");
    // gap = 78 - 65 = 13 (< 15), so NVDA might not be mentioned as laggard
    // Let's test with bigger gap
    const weak = makeScoredStock("WEAK", "Weak Co", 40, [
      { name: "quality", value: 30, label: "Q", weight: 0.4 },
      { name: "strength", value: 40, label: "S", weight: 0.3 },
      { name: "valuation", value: 50, label: "V", weight: 0.3 },
    ]);
    const result2 = compareStocks([MSFT, weak], "buffett");
    expect(result2.summary).toContain("WEAK");
    expect(result2.summary).toContain("retrait");
  });

  it("works with exactly 2 stocks", () => {
    const result = compareStocks([MSFT, AAPL], "buffett");
    expect(result.winner?.ticker).toBe("MSFT");
    expect(result.subScoreComparison.length).toBe(3);
    expect(result.metricComparison.length).toBe(9);
  });

  it("handles edge case: stocks with identical scores", () => {
    const clone = makeScoredStock("CLONE", "Clone", 78, [
      { name: "quality", value: 85, label: "Q", weight: 0.4 },
      { name: "strength", value: 75, label: "S", weight: 0.3 },
      { name: "valuation", value: 65, label: "V", weight: 0.3 },
    ]);
    const result = compareStocks([MSFT, clone], "buffett");
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

describe("near-tie detection", () => {
  it("detects tie when scores differ by < 3 points", () => {
    const a = makeScoredStock("A", "Alpha", 78, [
      { name: "quality", value: 80, label: "Q", weight: 1 },
    ]);
    const b = makeScoredStock("B", "Beta", 77, [
      { name: "quality", value: 75, label: "Q", weight: 1 },
    ]);
    const result = compareStocks([a, b], "buffett");
    expect(result.isTie).toBe(true);
    expect(result.summary).toContain("proches");
  });

  it("does not flag tie when gap >= 3", () => {
    const result = compareStocks([MSFT, AAPL], "buffett"); // 78 vs 72 = 6
    expect(result.isTie).toBe(false);
  });
});

describe("N/A and missing data handling", () => {
  it("ignores N/A values in best/worst determination", () => {
    const withNA = makeScoredStock("NA", "Missing", 50, [
      { name: "quality", value: 60, label: "Q", weight: 0.4 },
      { name: "strength", value: 50, label: "S", weight: 0.3 },
      { name: "valuation", value: 40, label: "V", weight: 0.3 },
    ], { per: 0 }); // PER=0 → treated as N/A

    const result = compareStocks([MSFT, withNA], "buffett");

    // PER: MSFT=25, NA=null → MSFT is best, NA ignored
    const per = result.metricComparison.find((m) => m.key === "per");
    expect(per!.isPartial).toBe(true);
    expect(per!.bestTicker).not.toBe("NA");
  });

  it("marks partial metrics with isPartial flag", () => {
    const partial = makeScoredStock("P", "Partial", 50, [
      { name: "quality", value: 50, label: "Q", weight: 1 },
    ], { per: 0 });

    const result = compareStocks([MSFT, partial], "buffett");
    const per = result.metricComparison.find((m) => m.key === "per");
    expect(per!.isPartial).toBe(true);
  });

  it("generates warning when many metrics are partial", () => {
    // per=0 is N/A (zeroIsNA), fcf uses NaN for truly missing
    const incomplete = makeScoredStock("INC", "Incomplete", 40, [
      { name: "quality", value: 40, label: "Q", weight: 1 },
    ], { per: 0, freeCashFlow: NaN, roic: 0 });

    const result = compareStocks([MSFT, incomplete], "buffett");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("partielle");
  });
});

describe("confidence in summary", () => {
  it("mentions low confidence stocks in summary", () => {
    const lowConf = makeScoredStock("LOW", "LowConf", 82, [
      { name: "quality", value: 90, label: "Q", weight: 1 },
    ]);
    // Override confidence to low
    const withLowConf: ScoredStock = {
      ...lowConf,
      score: { ...lowConf.score, confidence: "low", dataCompleteness: { score: 40, available: [], missing: ["PER", "ROE"] } },
    };

    const result = compareStocks([MSFT, withLowConf], "buffett");
    expect(result.summary).toContain("incompletes");
    expect(result.summary).toContain("LOW");
  });
});
