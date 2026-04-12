import { describe, it, expect, beforeEach } from "vitest";
import { median, computeDynamicBenchmarks, MIN_STOCKS_PER_SECTOR } from "../dynamic-benchmarks";
import { setDynamicBenchmarks, getSectorBenchmark, STATIC_SECTOR_BENCHMARKS } from "../sector-benchmarks";
import type { Stock } from "../../types";

// --- Helper: minimal Stock factory ---

function makeStock(overrides: Partial<Stock> & { sector: string }): Stock {
  return {
    ticker: "TEST",
    name: "Test Corp",
    country: "US",
    exchange: "NYSE",
    currency: "USD",
    marketCap: 10,
    price: 100,
    per: 20,
    peg: 1.5,
    roic: 15,
    operatingMargin: 20,
    freeCashFlow: 500,
    revenueGrowth: 10,
    epsGrowth: 12,
    dividendYield: 2,
    payoutRatio: 40,
    debtToOcf: 3,
    evToEbit: 18,
    history: [],
    ...overrides,
  };
}

// --- median() ---

describe("median", () => {
  it("returns null for empty array", () => {
    expect(median([])).toBeNull();
  });

  it("returns the single value for length-1 array", () => {
    expect(median([42])).toBe(42);
  });

  it("returns middle value for odd-length array", () => {
    expect(median([1, 3, 5])).toBe(3);
  });

  it("returns average of two middle values for even-length array", () => {
    expect(median([1, 3, 5, 7])).toBe(4);
  });

  it("handles unsorted input", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("handles negative values", () => {
    expect(median([-10, -5, 0, 5, 10])).toBe(0);
  });
});

// --- computeDynamicBenchmarks() ---

describe("computeDynamicBenchmarks", () => {
  it("returns empty for fewer than MIN_STOCKS_PER_SECTOR stocks", () => {
    const stocks = Array.from({ length: MIN_STOCKS_PER_SECTOR - 1 }, (_, i) =>
      makeStock({ ticker: `T${i}`, sector: "Technologie", per: 20 + i })
    );
    const result = computeDynamicBenchmarks(stocks);
    expect(result["Technologie"]).toBeUndefined();
  });

  it("computes median for sector with exactly MIN_STOCKS_PER_SECTOR stocks", () => {
    const stocks = Array.from({ length: MIN_STOCKS_PER_SECTOR }, (_, i) =>
      makeStock({
        ticker: `T${i}`,
        sector: "Technologie",
        per: 10 + i * 5, // 10, 15, 20, 25, 30 → median 20
        operatingMargin: 20,
        revenueGrowth: 10,
        epsGrowth: 12,
        dividendYield: 1,
        marketCap: 10,
        freeCashFlow: 500, // priceToFcf = 10B / 500M = 20
      })
    );
    const result = computeDynamicBenchmarks(stocks);
    expect(result["Technologie"]).toBeDefined();
    expect(result["Technologie"].per).toBe(20);
  });

  it("handles multiple sectors independently", () => {
    const techStocks = Array.from({ length: 6 }, (_, i) =>
      makeStock({ ticker: `TECH${i}`, sector: "Technologie", operatingMargin: 25 + i })
    );
    const finStocks = Array.from({ length: 6 }, (_, i) =>
      makeStock({ ticker: `FIN${i}`, sector: "Finance", operatingMargin: 35 + i })
    );
    const result = computeDynamicBenchmarks([...techStocks, ...finStocks]);

    expect(result["Technologie"]).toBeDefined();
    expect(result["Finance"]).toBeDefined();
    // Tech margins: 25,26,27,28,29,30 → median (27+28)/2 = 27.5
    expect(result["Technologie"].operatingMargin).toBe(27.5);
    // Fin margins: 35,36,37,38,39,40 → median (37+38)/2 = 37.5
    expect(result["Finance"].operatingMargin).toBe(37.5);
  });

  it("excludes null and undefined values from median computation", () => {
    const stocks = Array.from({ length: 7 }, (_, i) =>
      makeStock({
        ticker: `T${i}`,
        sector: "Technologie",
        per: i < 5 ? 10 + i * 5 : null, // 5 real values, 2 nulls
      } as Partial<Stock> & { sector: string })
    );
    const result = computeDynamicBenchmarks(stocks);
    expect(result["Technologie"]).toBeDefined();
    // PER values: 10, 15, 20, 25, 30 (nulls excluded) → median 20
    expect(result["Technologie"].per).toBe(20);
  });

  it("excludes NaN and Infinity from median computation", () => {
    const stocks = Array.from({ length: 6 }, (_, i) =>
      makeStock({
        ticker: `T${i}`,
        sector: "Technologie",
        per: i < 5 ? 20 : NaN,
      })
    );
    const result = computeDynamicBenchmarks(stocks);
    expect(result["Technologie"]).toBeDefined();
    expect(result["Technologie"].per).toBe(20);
  });

  it("computes priceToFcf from marketCap / freeCashFlow", () => {
    // priceToFcf = marketCap / FCF (same units)
    // Values: 10000/500=20, 10000/600≈16.67, 10000/700≈14.29, 10000/800=12.5, 10000/900≈11.11
    // Sorted: 11.11, 12.5, 14.29, 16.67, 20 → median 14.29
    const stocks = Array.from({ length: 5 }, (_, i) =>
      makeStock({
        ticker: `T${i}`,
        sector: "Technologie",
        marketCap: 10000,
        freeCashFlow: 500 + i * 100,
      })
    );
    const result = computeDynamicBenchmarks(stocks);
    expect(result["Technologie"].priceToFcf).toBeCloseTo(14.29, 1);
  });

  it("excludes stocks with negative or zero FCF from priceToFcf", () => {
    const stocks = Array.from({ length: 6 }, (_, i) =>
      makeStock({
        ticker: `T${i}`,
        sector: "Technologie",
        marketCap: 10000,
        freeCashFlow: i < 5 ? 500 : -100, // 5 positive, 1 negative
      })
    );
    const result = computeDynamicBenchmarks(stocks);
    // All 5 positive have priceToFcf = 10000/500 = 20
    expect(result["Technologie"].priceToFcf).toBe(20);
  });

  it("skips stocks with empty sector", () => {
    const stocks = Array.from({ length: 6 }, (_, i) =>
      makeStock({ ticker: `T${i}`, sector: "" })
    );
    const result = computeDynamicBenchmarks(stocks);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// --- Integration: getSectorBenchmark with dynamic benchmarks ---

describe("getSectorBenchmark with dynamic benchmarks", () => {
  beforeEach(() => {
    setDynamicBenchmarks(null);
  });

  it("returns static benchmark when no dynamic benchmarks set", () => {
    const benchmark = getSectorBenchmark("Technologie");
    expect(benchmark).toBe(STATIC_SECTOR_BENCHMARKS["Technologie"]);
  });

  it("returns dynamic benchmark when set", () => {
    const custom: Record<string, any> = {
      Technologie: {
        operatingMargin: 30,
        revenueGrowth: 15,
        epsGrowth: 18,
        per: 35,
        dividendYield: 0.5,
        evToEbit: 28,
        priceToFcf: 32,
      },
    };
    setDynamicBenchmarks(custom);
    const benchmark = getSectorBenchmark("Technologie");
    expect(benchmark.operatingMargin).toBe(30);
    expect(benchmark.per).toBe(35);
  });

  it("falls back to static when dynamic does not include the sector", () => {
    setDynamicBenchmarks({ Finance: STATIC_SECTOR_BENCHMARKS["Finance"] });
    const benchmark = getSectorBenchmark("Technologie");
    expect(benchmark).toBe(STATIC_SECTOR_BENCHMARKS["Technologie"]);
  });

  it("reverts to static after setting null", () => {
    setDynamicBenchmarks({
      Technologie: { ...STATIC_SECTOR_BENCHMARKS["Technologie"], per: 999 },
    });
    expect(getSectorBenchmark("Technologie").per).toBe(999);

    setDynamicBenchmarks(null);
    expect(getSectorBenchmark("Technologie").per).toBe(
      STATIC_SECTOR_BENCHMARKS["Technologie"].per
    );
  });
});
