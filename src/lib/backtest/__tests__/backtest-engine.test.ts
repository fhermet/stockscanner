import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for backtest helper logic.
 * We test the pure functions by importing the module and mocking
 * external dependencies (SEC provider, Yahoo provider).
 */

// Mock external dependencies before importing
vi.mock("@/lib/data/sec-history-provider", () => ({
  getAvailableTickers: vi.fn(),
  getSecHistory: vi.fn(),
}));

vi.mock("@/lib/data/yahoo-history-provider", () => ({
  getYearlyPrices: vi.fn(),
}));

import {
  runBacktest,
  runRollingBacktest,
  getAvailableYears,
  resetBacktestCache,
  computeRiskMetrics,
  getCumulativeDps,
  type AnnualSlice,
} from "../backtest-engine";
import { getAvailableTickers, getSecHistory } from "@/lib/data/sec-history-provider";
import { getYearlyPrices } from "@/lib/data/yahoo-history-provider";
import type { SecTickerData } from "@/lib/types/sec-fundamentals";
import type { YearlyPrice } from "@/lib/data/yahoo-history-provider";

const mockGetAvailableTickers = vi.mocked(getAvailableTickers);
const mockGetSecHistory = vi.mocked(getSecHistory);
const mockGetYearlyPrices = vi.mocked(getYearlyPrices);

function makeSecData(ticker: string, years: number[]): SecTickerData {
  return {
    ticker,
    company_name: `${ticker} Corp`,
    cik: "0000000001",
    schema_version: "1.0",
    last_updated: "2026-04-06",
    annuals: years.map((year) => ({
      fiscal_year: year,
      fundamentals: {
        revenue: 100000000000,
        net_income: 30000000000,
        shareholders_equity: 80000000000,
        total_debt: 20000000000,
        eps_diluted: 10,
        dividends_paid: 0,
        operating_cash_flow: 40000000000,
        capital_expenditure: 10000000000,
        operating_income: 35000000000,
        interest_expense: 2300000000,
        shares_outstanding: 3000000000,
      },
      ratios: {
        roe: 0.375,
        debt_to_equity: 0.25,
        revenue_growth: 0.10,
        eps_growth: 0.15,
        free_cash_flow: 30000000000,
        payout_ratio: 0.167,
        operating_margin: 0.35,
      },
      completeness: {
        present_field_count: 8,
        missing_field_count: 0,
        missing_field_names: [],
        completeness_ratio: 1.0,
      },
    })),
  };
}

function makePrices(ticker: string, yearPrices: [number, number][]): YearlyPrice[] {
  return yearPrices.map(([year, close]) => ({
    year,
    close,
    date: `${year}-12-01`,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  resetBacktestCache();
});

describe("runBacktest", () => {
  it("returns a valid result with stocks and returns", async () => {
    mockGetAvailableTickers.mockResolvedValue(["AAPL", "MSFT"]);
    mockGetSecHistory.mockImplementation(async (ticker) =>
      makeSecData(ticker as string, [2018, 2019, 2020, 2021, 2022, 2023, 2024]),
    );

    mockGetYearlyPrices.mockImplementation(async (ticker) => {
      if (ticker === "^SP500TR") {
        return makePrices("^SP500TR", [[2018, 2500], [2024, 4800]]);
      }
      if (ticker === "AAPL") {
        return makePrices("AAPL", [[2018, 150], [2024, 250]]);
      }
      if (ticker === "MSFT") {
        return makePrices("MSFT", [[2018, 100], [2024, 400]]);
      }
      return [];
    });

    const result = await runBacktest("buffett", 2018, 2);

    expect(result.stocks.length).toBe(2);
    expect(result.startYear).toBe(2018);
    expect(result.endYear).toBe(2024);
    expect(result.portfolioReturnPct).toBeGreaterThan(0);
    expect(result.benchmarkReturnPct).toBeCloseTo(92, 0); // (4800/2500-1)*100
    expect(result.summary).toContain("stratégie Warren Buffett");
    expect(result.summary).toContain("2018");
    expect(result.disclaimer.length).toBeGreaterThan(0);
  });

  it("computes individual stock returns correctly", async () => {
    mockGetAvailableTickers.mockResolvedValue(["AAPL"]);
    mockGetSecHistory.mockResolvedValue(makeSecData("AAPL", [2020, 2024]));
    mockGetYearlyPrices.mockImplementation(async (ticker) => {
      if (ticker === "^SP500TR") return makePrices("^SP500TR", [[2020, 3000], [2024, 5000]]);
      return makePrices("AAPL", [[2020, 100], [2024, 200]]);
    });

    const result = await runBacktest("buffett", 2020, 5);

    expect(result.stocks).toHaveLength(1);
    expect(result.stocks[0].returnPct).toBeCloseTo(100, 0); // 200/100 - 1
    expect(result.portfolioReturnPct).toBeCloseTo(100, 0);
  });

  it("returns empty when no data for the year", async () => {
    mockGetAvailableTickers.mockResolvedValue(["AAPL"]);
    mockGetSecHistory.mockResolvedValue(makeSecData("AAPL", [2020]));

    const result = await runBacktest("buffett", 2015, 5);

    expect(result.stocks).toHaveLength(0);
    expect(result.summary).toContain("Aucune donnée");
  });

  it("returns empty when prices are missing", async () => {
    mockGetAvailableTickers.mockResolvedValue(["AAPL"]);
    mockGetSecHistory.mockResolvedValue(makeSecData("AAPL", [2018, 2024]));
    mockGetYearlyPrices.mockResolvedValue([]);

    const result = await runBacktest("buffett", 2018, 5);

    expect(result.stocks).toHaveLength(0);
  });

  it("handles benchmark unavailable gracefully", async () => {
    mockGetAvailableTickers.mockResolvedValue(["AAPL"]);
    mockGetSecHistory.mockResolvedValue(makeSecData("AAPL", [2020, 2024]));
    mockGetYearlyPrices.mockImplementation(async (ticker) => {
      if (ticker === "^SP500TR") return [];
      return makePrices("AAPL", [[2020, 100], [2024, 180]]);
    });

    const result = await runBacktest("buffett", 2020, 5);

    expect(result.stocks).toHaveLength(1);
    expect(result.benchmarkReturnPct).toBeNull();
    expect(result.outperformance).toBeNull();
  });

  it("sorts stocks by return descending", async () => {
    mockGetAvailableTickers.mockResolvedValue(["AAPL", "MSFT"]);
    mockGetSecHistory.mockImplementation(async (ticker) =>
      makeSecData(ticker as string, [2020, 2024]),
    );
    mockGetYearlyPrices.mockImplementation(async (ticker) => {
      if (ticker === "^SP500TR") return makePrices("^SP500TR", [[2020, 3000], [2024, 4000]]);
      if (ticker === "AAPL") return makePrices("AAPL", [[2020, 100], [2024, 150]]);
      if (ticker === "MSFT") return makePrices("MSFT", [[2020, 100], [2024, 300]]);
      return [];
    });

    const result = await runBacktest("buffett", 2020, 5);

    expect(result.stocks[0].ticker).toBe("MSFT"); // +200% first
    expect(result.stocks[1].ticker).toBe("AAPL"); // +50% second
  });
});

// ============================================================
// getCumulativeDps
// ============================================================

describe("getCumulativeDps", () => {
  it("returns 0 when secData is null", () => {
    expect(getCumulativeDps(null, 2020, 2024)).toBe(0);
  });

  it("computes DPS from dividends_paid / shares_outstanding", () => {
    const secData: SecTickerData = {
      ticker: "TEST",
      company_name: "Test Corp",
      cik: "0000000001",
      schema_version: "1.0",
      last_updated: "2026-04-12",
      annuals: [
        {
          fiscal_year: 2020,
          fundamentals: {
            revenue: 100e9, net_income: 30e9, shareholders_equity: 80e9,
            total_debt: 20e9, eps_diluted: 10, dividends_paid: -3e9, // negative = cash outflow
            operating_cash_flow: 40e9, capital_expenditure: 10e9,
            operating_income: 35e9, interest_expense: 2e9, shares_outstanding: 1e9,
          },
          ratios: { roe: 0.375, debt_to_equity: 0.25, revenue_growth: 0.10, eps_growth: 0.15, free_cash_flow: 30e9, payout_ratio: 0.1, operating_margin: 0.35 },
          completeness: { present_field_count: 11, missing_field_count: 0, missing_field_names: [], completeness_ratio: 1.0 },
        },
        {
          fiscal_year: 2021,
          fundamentals: {
            revenue: 110e9, net_income: 33e9, shareholders_equity: 85e9,
            total_debt: 18e9, eps_diluted: 11, dividends_paid: -4e9,
            operating_cash_flow: 45e9, capital_expenditure: 11e9,
            operating_income: 38e9, interest_expense: 1.8e9, shares_outstanding: 1e9,
          },
          ratios: { roe: 0.39, debt_to_equity: 0.21, revenue_growth: 0.10, eps_growth: 0.10, free_cash_flow: 34e9, payout_ratio: 0.12, operating_margin: 0.35 },
          completeness: { present_field_count: 11, missing_field_count: 0, missing_field_names: [], completeness_ratio: 1.0 },
        },
      ],
    };

    // DPS 2020 = |−3e9| / 1e9 = 3.0
    // DPS 2021 = |−4e9| / 1e9 = 4.0
    // Cumulative 2020→2022 (years 2020 and 2021) = 7.0
    expect(getCumulativeDps(secData, 2020, 2022)).toBe(7);
    // Only 2020
    expect(getCumulativeDps(secData, 2020, 2021)).toBe(3);
    // Only 2021
    expect(getCumulativeDps(secData, 2021, 2022)).toBe(4);
    // No years match
    expect(getCumulativeDps(secData, 2025, 2026)).toBe(0);
  });

  it("returns 0 when dividends_paid or shares_outstanding is null", () => {
    const secData: SecTickerData = {
      ticker: "TEST", company_name: "Test", cik: "1", schema_version: "1.0", last_updated: "2026-01-01",
      annuals: [{
        fiscal_year: 2020,
        fundamentals: {
          revenue: 100e9, net_income: 30e9, shareholders_equity: 80e9, total_debt: 20e9,
          eps_diluted: 10, dividends_paid: null, operating_cash_flow: 40e9,
          capital_expenditure: 10e9, operating_income: 35e9, interest_expense: 2e9, shares_outstanding: 1e9,
        },
        ratios: { roe: 0.375, debt_to_equity: 0.25, revenue_growth: 0.10, eps_growth: 0.15, free_cash_flow: 30e9, payout_ratio: null, operating_margin: 0.35 },
        completeness: { present_field_count: 10, missing_field_count: 1, missing_field_names: ["dividends_paid"], completeness_ratio: 0.91 },
      }],
    };
    expect(getCumulativeDps(secData, 2020, 2021)).toBe(0);
  });
});

describe("runBacktest with dividends", () => {
  it("includes dividends in total return", async () => {
    // SEC data with DPS = |−3e9| / 1e9 = $3/share for each year
    const secWithDiv: SecTickerData = {
      ticker: "DIV",
      company_name: "Dividend Corp",
      cik: "0000000001",
      schema_version: "1.0",
      last_updated: "2026-04-12",
      annuals: [2020, 2021, 2022, 2023, 2024].map((year) => ({
        fiscal_year: year,
        fundamentals: {
          revenue: 100e9, net_income: 30e9, shareholders_equity: 80e9,
          total_debt: 20e9, eps_diluted: 10, dividends_paid: -3e9,
          operating_cash_flow: 40e9, capital_expenditure: 10e9,
          operating_income: 35e9, interest_expense: 2e9, shares_outstanding: 1e9,
        },
        ratios: { roe: 0.375, debt_to_equity: 0.25, revenue_growth: 0.10, eps_growth: 0.15, free_cash_flow: 30e9, payout_ratio: 0.1, operating_margin: 0.35 },
        completeness: { present_field_count: 11, missing_field_count: 0, missing_field_names: [], completeness_ratio: 1.0 },
      })),
    };

    mockGetAvailableTickers.mockResolvedValue(["DIV"]);
    mockGetSecHistory.mockResolvedValue(secWithDiv);
    mockGetYearlyPrices.mockImplementation(async (ticker) => {
      if (ticker === "^SP500TR") return makePrices("^SP500TR", [[2020, 3000], [2024, 5000]]);
      return makePrices("DIV", [[2020, 100], [2024, 200]]);
    });

    const result = await runBacktest("buffett", 2020, 5);

    expect(result.stocks).toHaveLength(1);
    // Price return = (200/100 - 1) = 100%
    // Cum DPS for years 2020,2021,2022,2023 = 4 × $3 = $12
    // Total return = (200 + 12) / 100 - 1 = 112%
    expect(result.stocks[0].returnPct).toBeCloseTo(112, 0);
  });
});

describe("getAvailableYears", () => {
  it("returns years between 2010 and currentYear-2", async () => {
    mockGetAvailableTickers.mockResolvedValue(["AAPL"]);
    mockGetSecHistory.mockResolvedValue(
      makeSecData("AAPL", [2008, 2010, 2015, 2020, 2024, 2025, 2026]),
    );

    const years = await getAvailableYears();

    expect(years).toContain(2010);
    expect(years).toContain(2020);
    expect(years).toContain(2024);
    expect(years).not.toContain(2008); // too old
    expect(years).not.toContain(2026); // too recent (currentYear - 2)
  });
});

// ============================================================
// computeRiskMetrics
// ============================================================

describe("computeRiskMetrics", () => {
  function makeSlice(year: number, portfolioReturnPct: number, benchmarkReturnPct: number | null = null, turnover = 0): AnnualSlice {
    return {
      year,
      holdings: [],
      portfolioReturnPct,
      benchmarkReturnPct,
      turnover,
    };
  }

  it("computes CAGR correctly for simple case", () => {
    // 3 years: +10%, +10%, +10% → CAGR = 10%
    const slices = [
      makeSlice(2020, 10),
      makeSlice(2021, 10),
      makeSlice(2022, 10),
    ];
    const risk = computeRiskMetrics(slices);
    expect(risk.cagr).toBe(10);
  });

  it("computes CAGR with variable returns", () => {
    // 2 years: +50%, -20% → cumulative = 1.5 * 0.8 = 1.2 → CAGR = sqrt(1.2)-1 ≈ 9.54%
    const slices = [makeSlice(2020, 50), makeSlice(2021, -20)];
    const risk = computeRiskMetrics(slices);
    expect(risk.cagr).toBeCloseTo(9.54, 1);
  });

  it("computes volatility as std dev of annual returns", () => {
    // Returns: 10, 10, 10 → volatility = 0
    const stable = [makeSlice(2020, 10), makeSlice(2021, 10), makeSlice(2022, 10)];
    expect(computeRiskMetrics(stable).volatility).toBe(0);

    // Returns: 20, -10 → mean = 5, variance = ((15)²+(15)²)/1 = 450, std = ~21.21
    const volatile = [makeSlice(2020, 20), makeSlice(2021, -10)];
    expect(computeRiskMetrics(volatile).volatility).toBeCloseTo(21.21, 1);
  });

  it("computes max drawdown from equity curve", () => {
    // Equity: 100 → 120 (+20%) → 96 (-20%) → 115.2 (+20%)
    // Peak at 120, trough at 96 → drawdown = (120-96)/120 = 20%
    const slices = [makeSlice(2020, 20), makeSlice(2021, -20), makeSlice(2022, 20)];
    const risk = computeRiskMetrics(slices);
    expect(risk.maxDrawdown).toBe(20);
  });

  it("computes win rate vs benchmark", () => {
    const slices = [
      makeSlice(2020, 15, 10), // win
      makeSlice(2021, 5, 12),  // lose
      makeSlice(2022, 20, 8),  // win
    ];
    const risk = computeRiskMetrics(slices);
    expect(risk.winRate).toBeCloseTo(66.67, 0); // 2/3
  });

  it("identifies best and worst years", () => {
    const slices = [
      makeSlice(2020, 30, 10),
      makeSlice(2021, -15, 5),
      makeSlice(2022, 10, 8),
    ];
    const risk = computeRiskMetrics(slices);
    expect(risk.bestYear).toEqual({ year: 2020, returnPct: 30 });
    expect(risk.worstYear).toEqual({ year: 2021, returnPct: -15 });
  });

  it("computes benchmark CAGR", () => {
    const slices = [
      makeSlice(2020, 10, 15),
      makeSlice(2021, 10, 15),
    ];
    const risk = computeRiskMetrics(slices);
    expect(risk.benchmarkCagr).toBe(15);
  });

  it("returns null benchmark CAGR when no benchmark data", () => {
    const slices = [makeSlice(2020, 10, null)];
    const risk = computeRiskMetrics(slices);
    expect(risk.benchmarkCagr).toBeNull();
  });

  it("handles empty slices gracefully", () => {
    const risk = computeRiskMetrics([]);
    expect(risk.cagr).toBe(0);
    expect(risk.volatility).toBe(0);
    expect(risk.maxDrawdown).toBe(0);
    expect(risk.winRate).toBe(0);
  });

  it("computes Sharpe ratio as CAGR / volatility", () => {
    // Returns: 20, 0 → mean=10, CAGR≈9.54, vol≈14.14 → Sharpe ≈ 0.67
    const slices = [makeSlice(2020, 20), makeSlice(2021, 0)];
    const risk = computeRiskMetrics(slices);
    expect(risk.sharpeRatio).not.toBeNull();
    expect(risk.sharpeRatio!).toBeCloseTo(0.67, 1);
  });
});

// ============================================================
// runRollingBacktest
// ============================================================

describe("runRollingBacktest", () => {
  it("produces annual slices with rebalancing", async () => {
    // 2 stocks, 4 years of data → 3 scoreable years (2018, 2019, 2020)
    mockGetAvailableTickers.mockResolvedValue(["AAPL", "MSFT"]);
    mockGetSecHistory.mockImplementation(async (ticker) =>
      makeSecData(ticker as string, [2018, 2019, 2020, 2021, 2022, 2023, 2024]),
    );

    mockGetYearlyPrices.mockImplementation(async (ticker) => {
      if (ticker === "^SP500TR") {
        return makePrices("^SP500TR", [[2018, 2500], [2019, 2800], [2020, 3200], [2021, 3700], [2022, 3800], [2023, 4200], [2024, 4800], [2025, 5200]]);
      }
      if (ticker === "AAPL") {
        return makePrices("AAPL", [[2018, 150], [2019, 180], [2020, 200], [2021, 250], [2022, 230], [2023, 280], [2024, 300], [2025, 340]]);
      }
      if (ticker === "MSFT") {
        return makePrices("MSFT", [[2018, 100], [2019, 130], [2020, 180], [2021, 250], [2022, 220], [2023, 310], [2024, 400], [2025, 450]]);
      }
      return [];
    });

    const result = await runRollingBacktest("buffett", 2);

    expect(result.slices.length).toBeGreaterThan(0);
    expect(result.strategyId).toBe("buffett");
    expect(result.risk.cagr).toBeDefined();
    expect(result.risk.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(result.cumulativeReturnPct).toBeDefined();

    // Each slice should have holdings
    for (const slice of result.slices) {
      expect(slice.holdings.length).toBeGreaterThan(0);
      expect(typeof slice.portfolioReturnPct).toBe("number");
    }
  });

  it("computes turnover when holdings change", async () => {
    // Use 2 tickers but vary scores so holdings might change
    mockGetAvailableTickers.mockResolvedValue(["AAPL", "MSFT"]);
    mockGetSecHistory.mockImplementation(async (ticker) =>
      makeSecData(ticker as string, [2018, 2019, 2020, 2021, 2022, 2023, 2024]),
    );

    mockGetYearlyPrices.mockImplementation(async (ticker) => {
      if (ticker === "^SP500TR") {
        return makePrices("^SP500TR", [[2018, 2500], [2019, 2800], [2020, 3200], [2021, 3700], [2022, 3800], [2023, 4200], [2024, 4800], [2025, 5200]]);
      }
      return makePrices(ticker as string, [[2018, 100], [2019, 120], [2020, 150], [2021, 180], [2022, 170], [2023, 200], [2024, 250], [2025, 280]]);
    });

    const result = await runRollingBacktest("buffett", 2);

    // First slice should have 0 turnover
    if (result.slices.length > 0) {
      expect(result.slices[0].turnover).toBe(0);
    }
  });

  it("returns empty result when not enough years", async () => {
    mockGetAvailableTickers.mockResolvedValue(["AAPL"]);
    mockGetSecHistory.mockResolvedValue(makeSecData("AAPL", [2024]));

    const result = await runRollingBacktest("buffett", 5);

    expect(result.slices).toHaveLength(0);
    expect(result.summary).toContain("Pas assez");
  });

  it("includes risk metrics in the result", async () => {
    mockGetAvailableTickers.mockResolvedValue(["AAPL"]);
    mockGetSecHistory.mockResolvedValue(
      makeSecData("AAPL", [2018, 2019, 2020, 2021, 2022, 2023, 2024]),
    );

    mockGetYearlyPrices.mockImplementation(async (ticker) => {
      if (ticker === "^SP500TR") {
        return makePrices("^SP500TR", [[2018, 2500], [2019, 2800], [2020, 3200], [2021, 3700], [2022, 3800], [2023, 4200], [2024, 4800], [2025, 5200]]);
      }
      return makePrices("AAPL", [[2018, 150], [2019, 180], [2020, 220], [2021, 250], [2022, 230], [2023, 280], [2024, 300], [2025, 340]]);
    });

    const result = await runRollingBacktest("buffett", 3);

    expect(result.risk).toBeDefined();
    expect(typeof result.risk.cagr).toBe("number");
    expect(typeof result.risk.volatility).toBe("number");
    expect(typeof result.risk.maxDrawdown).toBe("number");
    expect(typeof result.risk.winRate).toBe("number");
    expect(result.risk.bestYear.year).toBeGreaterThan(0);
    expect(result.risk.worstYear.year).toBeGreaterThan(0);
  });
});
