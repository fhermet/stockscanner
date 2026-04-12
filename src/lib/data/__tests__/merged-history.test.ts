import { describe, it, expect } from "vitest";

import {
  computePER,
  computeDividendYield,
  computePEG,
  computeMarketCap,
  computeFCFYield,
  mergeHistory,
} from "../merged-history";
import type { SecTickerData } from "@/lib/types/sec-fundamentals";
import type { YearlyPrice } from "../yahoo-history-provider";

describe("computePER", () => {
  it("returns price / EPS for valid inputs", () => {
    expect(computePER(150, 10)).toBe(15);
    expect(computePER(300, 11.86)).toBe(25.3);
  });

  it("returns null when price is null", () => {
    expect(computePER(null, 10)).toBeNull();
  });

  it("returns null when EPS is null or <= 0", () => {
    expect(computePER(150, null)).toBeNull();
    expect(computePER(150, 0)).toBeNull();
    expect(computePER(150, -5)).toBeNull();
  });
});

describe("computeDividendYield", () => {
  it("computes yield as (DPS / price) * 100", () => {
    // DPS = 22B / 7.4B shares = ~2.97, yield = 2.97/150 * 100 = 1.98%
    const result = computeDividendYield(150, 22000000000, 7400000000);
    expect(result).toBeCloseTo(1.98, 1);
  });

  it("returns null when price is 0 or null", () => {
    expect(computeDividendYield(0, 22000000000, 7400000000)).toBeNull();
    expect(computeDividendYield(null, 22000000000, 7400000000)).toBeNull();
  });

  it("returns null when dividends are null or 0", () => {
    expect(computeDividendYield(150, null, 7400000000)).toBeNull();
    expect(computeDividendYield(150, 0, 7400000000)).toBeNull();
  });

  it("returns null when shares are null or 0", () => {
    expect(computeDividendYield(150, 22000000000, null)).toBeNull();
    expect(computeDividendYield(150, 22000000000, 0)).toBeNull();
  });
});

describe("computeMarketCap", () => {
  it("returns price * shares", () => {
    expect(computeMarketCap(150, 7400000000)).toBe(1110000000000);
  });

  it("returns null when either input is null", () => {
    expect(computeMarketCap(null, 7400000000)).toBeNull();
    expect(computeMarketCap(150, null)).toBeNull();
  });
});

describe("computeFCFYield", () => {
  it("computes FCF yield as (FCF/shares) / price * 100", () => {
    // FCF per share = 74B / 7.4B = 10, yield = 10/150 * 100 = 6.67%
    const result = computeFCFYield(150, 74000000000, 7400000000);
    expect(result).toBeCloseTo(6.67, 1);
  });

  it("returns null when inputs are missing", () => {
    expect(computeFCFYield(null, 74000000000, 7400000000)).toBeNull();
    expect(computeFCFYield(150, null, 7400000000)).toBeNull();
    expect(computeFCFYield(150, 74000000000, null)).toBeNull();
  });
});

describe("computePEG", () => {
  it("computes PEG = PER / (epsGrowth%)", () => {
    // PER = 150/10 = 15, epsGrowth = 0.20 → 20%, PEG = 15/20 = 0.75
    const result = computePEG(150, 10, 0.2);
    expect(result).toBe(0.75);
  });

  it("returns null when EPS growth is 0 or negative", () => {
    expect(computePEG(150, 10, 0)).toBeNull();
    expect(computePEG(150, 10, -0.1)).toBeNull();
  });

  it("returns null when PER cannot be computed", () => {
    expect(computePEG(null, 10, 0.2)).toBeNull();
    expect(computePEG(150, null, 0.2)).toBeNull();
  });
});

describe("mergeHistory", () => {
  const secData: SecTickerData = {
    ticker: "MSFT",
    company_name: "MICROSOFT CORP",
    cik: "0000789019",
    schema_version: "1.0",
    last_updated: "2026-04-06",
    annuals: [
      {
        fiscal_year: 2023,
        fundamentals: {
          revenue: 211000000000,
          net_income: 72000000000,
          shareholders_equity: 166000000000,
          total_debt: 60000000000,
          eps_diluted: 9.72,
          dividends_paid: 20000000000,
          operating_cash_flow: 87000000000,
          capital_expenditure: 28000000000,
          operating_income: 88000000000,
          shares_outstanding: 7400000000,
        },
        ratios: {
          roe: 0.43,
          debt_to_equity: 0.36,
          revenue_growth: 0.07,
          eps_growth: 0.01,
          free_cash_flow: 59000000000,
          payout_ratio: 0.28,
          operating_margin: 0.42,
        },
        completeness: {
          present_field_count: 8,
          missing_field_count: 0,
          missing_field_names: [],
          completeness_ratio: 1.0,
        },
      },
      {
        fiscal_year: 2024,
        fundamentals: {
          revenue: 245000000000,
          net_income: 88000000000,
          shareholders_equity: 206000000000,
          total_debt: 60000000000,
          eps_diluted: 11.86,
          dividends_paid: 22000000000,
          operating_cash_flow: 118000000000,
          capital_expenditure: 44000000000,
          operating_income: 109000000000,
          shares_outstanding: 7400000000,
        },
        ratios: {
          roe: 0.43,
          debt_to_equity: 0.29,
          revenue_growth: 0.16,
          eps_growth: 0.22,
          free_cash_flow: 74000000000,
          payout_ratio: 0.25,
          operating_margin: 0.45,
        },
        completeness: {
          present_field_count: 8,
          missing_field_count: 0,
          missing_field_names: [],
          completeness_ratio: 1.0,
        },
      },
    ],
  };

  const prices: YearlyPrice[] = [
    { year: 2023, close: 375.28, date: "2023-12-01" },
    { year: 2024, close: 421.50, date: "2024-12-01" },
  ];

  it("merges SEC and price data by year", () => {
    const merged = mergeHistory(secData, prices);
    expect(merged.annuals).toHaveLength(2);
    expect(merged.ticker).toBe("MSFT");
    expect(merged.priceYearsAvailable).toBe(2);
    expect(merged.secYearsAvailable).toBe(2);
  });

  it("computes market-derived metrics when price available", () => {
    const merged = mergeHistory(secData, prices);
    const y2024 = merged.annuals[1];

    expect(y2024.hasPrice).toBe(true);
    expect(y2024.price).toBe(421.50);
    expect(y2024.per).not.toBeNull();
    expect(y2024.dividendYield).not.toBeNull();
    expect(y2024.marketCap).not.toBeNull();
    expect(y2024.peg).not.toBeNull();
    expect(y2024.fcfYield).not.toBeNull();
  });

  it("returns null for market metrics when no price", () => {
    const merged = mergeHistory(secData, []);
    const y2024 = merged.annuals[1];

    expect(y2024.hasPrice).toBe(false);
    expect(y2024.per).toBeNull();
    expect(y2024.dividendYield).toBeNull();
    expect(y2024.marketCap).toBeNull();
    expect(y2024.peg).toBeNull();
  });

  it("passes through SEC fundamentals and ratios", () => {
    const merged = mergeHistory(secData, prices);
    const y2024 = merged.annuals[1];

    expect(y2024.revenue).toBe(245000000000);
    expect(y2024.operatingMargin).toBe(0.45);
    expect(y2024.freeCashFlow).toBe(74000000000);
  });
});
