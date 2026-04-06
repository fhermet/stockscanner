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
  getAvailableYears,
  resetBacktestCache,
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
        dividends_paid: 5000000000,
        operating_cash_flow: 40000000000,
        capital_expenditure: 10000000000,
        operating_income: 35000000000,
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
      if (ticker === "^GSPC") {
        return makePrices("^GSPC", [[2018, 2500], [2024, 4800]]);
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
      if (ticker === "^GSPC") return makePrices("^GSPC", [[2020, 3000], [2024, 5000]]);
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
      if (ticker === "^GSPC") return [];
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
      if (ticker === "^GSPC") return makePrices("^GSPC", [[2020, 3000], [2024, 4000]]);
      if (ticker === "AAPL") return makePrices("AAPL", [[2020, 100], [2024, 150]]);
      if (ticker === "MSFT") return makePrices("MSFT", [[2020, 100], [2024, 300]]);
      return [];
    });

    const result = await runBacktest("buffett", 2020, 5);

    expect(result.stocks[0].ticker).toBe("MSFT"); // +200% first
    expect(result.stocks[1].ticker).toBe("AAPL"); // +50% second
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
