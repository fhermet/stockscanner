import { describe, it, expect } from "vitest";

import type { SecAnnual, SecTickerData } from "@/lib/types/sec-fundamentals";
import {
  computeHistoricalScores,
  computeFullHistoricalScores,
  getStrategyCoverage,
  type HistoricalStrategyScore,
} from "../sec-historical-score";
import type { MergedHistory } from "@/lib/data/merged-history";

function makeAnnual(overrides: Partial<SecAnnual> = {}): SecAnnual {
  return {
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
      interest_expense: 2300000000,
      shares_outstanding: 7431000000,
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
    ...overrides,
  };
}

function makeTickerData(annuals: SecAnnual[]): SecTickerData {
  return {
    ticker: "MSFT",
    company_name: "MICROSOFT CORP",
    cik: "0000789019",
    schema_version: "1.0",
    last_updated: "2026-04-06",
    annuals,
  };
}

function findStrategy(
  scores: readonly HistoricalStrategyScore[],
  id: string,
): HistoricalStrategyScore {
  const found = scores.find((s) => s.strategyId === id);
  if (!found) throw new Error(`Strategy ${id} not found`);
  return found;
}

describe("computeHistoricalScores", () => {
  it("produces one point per annual", () => {
    const data = makeTickerData([
      makeAnnual({ fiscal_year: 2022 }),
      makeAnnual({ fiscal_year: 2023 }),
      makeAnnual({ fiscal_year: 2024 }),
    ]);
    const points = computeHistoricalScores(data);
    expect(points).toHaveLength(3);
    expect(points[0].fiscalYear).toBe(2022);
    expect(points[2].fiscalYear).toBe(2024);
  });

  it("computes all 4 strategies per point", () => {
    const data = makeTickerData([makeAnnual()]);
    const points = computeHistoricalScores(data);
    const strategyIds = points[0].scores.map((s) => s.strategyId);
    expect(strategyIds).toEqual(["buffett", "dividend", "growth", "lynch"]);
  });
});

describe("Buffett historical scoring", () => {
  it("computes quality, strength, and durability sub-scores", () => {
    const data = makeTickerData([makeAnnual()]);
    const buffett = findStrategy(computeHistoricalScores(data)[0].scores, "buffett");

    expect(buffett.total).toBeGreaterThan(0);
    expect(buffett.isPartial).toBe(true);

    const quality = buffett.subScores.find((s) => s.name === "quality");
    const strength = buffett.subScores.find((s) => s.name === "strength");
    const valuation = buffett.subScores.find((s) => s.name === "valuation");
    const durability = buffett.subScores.find((s) => s.name === "durability");

    expect(quality?.available).toBe(true);
    expect(quality?.value).toBeGreaterThan(0);
    expect(strength?.available).toBe(true);
    expect(strength?.value).toBeGreaterThan(0);
    expect(valuation?.available).toBe(false);
    expect(valuation?.value).toBe(0);
    // Durability not available with 1 year (needs 3+ for ROIC stability, 2+ for CAGR)
    expect(durability).toBeDefined();
  });

  it("handles high ROE and low debt well", () => {
    const annual = makeAnnual();
    annual.ratios.roe; // 0.43 = 43% → high quality
    annual.ratios.debt_to_equity; // 0.29 → low debt → high strength
    const data = makeTickerData([annual]);
    const buffett = findStrategy(computeHistoricalScores(data)[0].scores, "buffett");

    expect(buffett.total).toBeGreaterThan(70);
  });

  it("returns 0 when all data is null", () => {
    const annual = makeAnnual({
      fundamentals: {
        revenue: null,
        net_income: null,
        shareholders_equity: null,
        total_debt: null,
        eps_diluted: null,
        dividends_paid: null,
        operating_cash_flow: null,
        capital_expenditure: null,
        operating_income: null,
        interest_expense: null,
        shares_outstanding: null,
      },
      ratios: {
        roe: null,
        debt_to_equity: null,
        revenue_growth: null,
        eps_growth: null,
        free_cash_flow: null,
        payout_ratio: null,
        operating_margin: null,
      },
    });
    const data = makeTickerData([annual]);
    const buffett = findStrategy(computeHistoricalScores(data)[0].scores, "buffett");
    expect(buffett.total).toBe(0);
  });

  it("coverage is 0.6 with 1 year (quality 0.35 + strength 0.25, durability needs 3+ years)", () => {
    const data = makeTickerData([makeAnnual()]);
    const buffett = findStrategy(computeHistoricalScores(data)[0].scores, "buffett");
    expect(buffett.coverage).toBe(0.6);
  });

  it("coverage is 0.75 with 3+ years (quality + strength + durability)", () => {
    const annuals = [
      makeAnnual({ fiscal_year: 2020 }),
      makeAnnual({ fiscal_year: 2021 }),
      makeAnnual({ fiscal_year: 2022 }),
      makeAnnual({ fiscal_year: 2023 }),
      makeAnnual({ fiscal_year: 2024 }),
    ];
    const data = makeTickerData(annuals);
    const points = computeHistoricalScores(data);
    const buffett = findStrategy(points[points.length - 1].scores, "buffett");
    expect(buffett.coverage).toBe(0.75);
  });
});

describe("Growth historical scoring", () => {
  it("computes momentum and profitability", () => {
    const data = makeTickerData([makeAnnual()]);
    const growth = findStrategy(computeHistoricalScores(data)[0].scores, "growth");

    expect(growth.total).toBeGreaterThan(0);
    const momentum = growth.subScores.find((s) => s.name === "momentum");
    const profitability = growth.subScores.find((s) => s.name === "profitability");
    const scalability = growth.subScores.find((s) => s.name === "scalability");

    expect(momentum?.available).toBe(true);
    expect(profitability?.available).toBe(true);
    expect(scalability?.available).toBe(false);
  });

  it("coverage is 0.75 (momentum 0.5 + profitability 0.25)", () => {
    const data = makeTickerData([makeAnnual()]);
    const growth = findStrategy(computeHistoricalScores(data)[0].scores, "growth");
    expect(growth.coverage).toBe(0.75);
  });

  it("handles strong growth well", () => {
    const annual = makeAnnual({
      ratios: {
        ...makeAnnual().ratios,
        revenue_growth: 0.30, // 30% growth
        eps_growth: 0.35, // 35% growth
      },
    });
    const data = makeTickerData([annual]);
    const growth = findStrategy(computeHistoricalScores(data)[0].scores, "growth");
    expect(growth.total).toBeGreaterThan(70);
  });
});

describe("Lynch historical scoring", () => {
  it("computes growth and quality sub-scores", () => {
    const data = makeTickerData([makeAnnual()]);
    const lynch = findStrategy(computeHistoricalScores(data)[0].scores, "lynch");

    const growthSub = lynch.subScores.find((s) => s.name === "growth");
    const value = lynch.subScores.find((s) => s.name === "value");
    const quality = lynch.subScores.find((s) => s.name === "quality");

    expect(growthSub?.available).toBe(true);
    expect(value?.available).toBe(false);
    expect(quality?.available).toBe(true);
  });

  it("coverage is 0.65 (growth 0.4 + quality 0.25)", () => {
    const data = makeTickerData([makeAnnual()]);
    const lynch = findStrategy(computeHistoricalScores(data)[0].scores, "lynch");
    expect(lynch.coverage).toBe(0.65);
  });
});

describe("Dividend historical scoring", () => {
  it("computes sustainability and stability", () => {
    const data = makeTickerData([makeAnnual()]);
    const dividend = findStrategy(computeHistoricalScores(data)[0].scores, "dividend");

    const yieldSub = dividend.subScores.find((s) => s.name === "yield");
    const sustainability = dividend.subScores.find((s) => s.name === "sustainability");
    const stability = dividend.subScores.find((s) => s.name === "stability");

    expect(yieldSub?.available).toBe(false);
    expect(sustainability?.available).toBe(true);
    expect(stability?.available).toBe(true);
  });

  it("coverage is 0.7 (sustainability 0.35 + stability 0.35)", () => {
    const data = makeTickerData([makeAnnual()]);
    const dividend = findStrategy(computeHistoricalScores(data)[0].scores, "dividend");
    expect(dividend.coverage).toBe(0.7);
  });

  it("tracks dividend growth across years", () => {
    const annuals = [
      makeAnnual({
        fiscal_year: 2020,
        fundamentals: { ...makeAnnual().fundamentals, dividends_paid: 10000 },
      }),
      makeAnnual({
        fiscal_year: 2021,
        fundamentals: { ...makeAnnual().fundamentals, dividends_paid: 12000 },
      }),
      makeAnnual({
        fiscal_year: 2022,
        fundamentals: { ...makeAnnual().fundamentals, dividends_paid: 14000 },
      }),
    ];
    const data = makeTickerData(annuals);
    const points = computeHistoricalScores(data);

    // Last year should have full growing history
    const lastDividend = findStrategy(points[2].scores, "dividend");
    expect(lastDividend.total).toBeGreaterThan(0);
  });
});

describe("getStrategyCoverage", () => {
  it("returns correct coverage info for each strategy", () => {
    const buffett = getStrategyCoverage("buffett");
    expect(buffett.coverage).toBe("75%");
    expect(buffett.excluded.length).toBeGreaterThan(0);

    const growth = getStrategyCoverage("growth");
    expect(growth.coverage).toBe("75%");

    const lynch = getStrategyCoverage("lynch");
    expect(lynch.coverage).toBe("65%");

    const dividend = getStrategyCoverage("dividend");
    expect(dividend.coverage).toBe("52%");
  });
});

describe("partial data handling", () => {
  it("handles years with only some ratios", () => {
    const annual = makeAnnual({
      ratios: {
        roe: 0.35,
        debt_to_equity: null,
        revenue_growth: null,
        eps_growth: 0.15,
        free_cash_flow: 50000000000,
        payout_ratio: null,
        operating_margin: 0.30,
      },
    });
    const data = makeTickerData([annual]);
    const points = computeHistoricalScores(data);

    // Should still produce scores (partial)
    for (const score of points[0].scores) {
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
    }
  });
});

// =============================================================================
// FULL HISTORICAL SCORING (SEC + Yahoo prices)
// =============================================================================

function makeMergedHistory(overrides: Partial<MergedHistory["annuals"][0]>[] = []): MergedHistory {
  const defaultAnnual: MergedHistory["annuals"][0] = {
    fiscalYear: 2024,
    revenue: 245000000000,
    netIncome: 88000000000,
    shareholdersEquity: 206000000000,
    totalDebt: 60000000000,
    epsDiluted: 11.86,
    dividendsPaid: 22000000000,
    operatingCashFlow: 118000000000,
    capitalExpenditure: 44000000000,
    operatingIncome: 109000000000,
    interestExpense: 2300000000,
    sharesOutstanding: 7400000000,
    revenueGrowth: 0.16,
    epsGrowth: 0.22,
    freeCashFlow: 74000000000,
    payoutRatio: 0.25,
    operatingMargin: 0.45,
    price: 421.50,
    priceDate: "2024-12-01",
    marketCap: 421.50 * 7400000000,
    per: 421.50 / 11.86,
    dividendYield: ((22000000000 / 7400000000) / 421.50) * 100,
    fcfYield: ((74000000000 / 7400000000) / 421.50) * 100,
    peg: (421.50 / 11.86) / (0.22 * 100),
    hasPrice: true,
    secCompleteness: 1.0,
  };

  const annuals = overrides.length > 0
    ? overrides.map((o) => ({ ...defaultAnnual, ...o }))
    : [defaultAnnual];

  return {
    ticker: "MSFT",
    companyName: "MICROSOFT CORP",
    annuals,
    priceYearsAvailable: annuals.filter((a) => a.hasPrice).length,
    secYearsAvailable: annuals.length,
  };
}

describe("computeFullHistoricalScores", () => {
  it("produces 4 strategy scores per year", () => {
    const merged = makeMergedHistory();
    const points = computeFullHistoricalScores(merged);
    expect(points).toHaveLength(1);
    expect(points[0].scores).toHaveLength(4);
  });

  it("Buffett: 100% coverage with price data and 5yr history", () => {
    const merged = makeMergedHistory([
      { fiscalYear: 2020 },
      { fiscalYear: 2021 },
      { fiscalYear: 2022 },
      { fiscalYear: 2023 },
      { fiscalYear: 2024 },
    ]);
    const points = computeFullHistoricalScores(merged);
    const buffett = points[points.length - 1].scores.find(
      (s) => s.strategyId === "buffett",
    )!;

    expect(buffett.coverage).toBe(1);
    expect(buffett.isPartial).toBe(false);
    expect(buffett.subScores.every((s) => s.available)).toBe(true);
    expect(buffett.total).toBeGreaterThan(0);
  });

  it("Growth: 100% coverage with price data", () => {
    const merged = makeMergedHistory();
    const growth = computeFullHistoricalScores(merged)[0].scores.find(
      (s) => s.strategyId === "growth",
    )!;

    expect(growth.coverage).toBe(1);
    expect(growth.isPartial).toBe(false);
  });

  it("Lynch: 100% coverage with PEG available", () => {
    const merged = makeMergedHistory();
    const lynch = computeFullHistoricalScores(merged)[0].scores.find(
      (s) => s.strategyId === "lynch",
    )!;

    expect(lynch.coverage).toBe(1);
    expect(lynch.isPartial).toBe(false);
    const valueSub = lynch.subScores.find((s) => s.name === "value");
    expect(valueSub?.available).toBe(true);
  });

  it("Dividend: 100% coverage with yield and FCF coverage", () => {
    const merged = makeMergedHistory();
    const dividend = computeFullHistoricalScores(merged)[0].scores.find(
      (s) => s.strategyId === "dividend",
    )!;

    expect(dividend.coverage).toBeCloseTo(1, 10);
    expect(dividend.isPartial).toBe(false);
  });

  it("falls back to partial scoring when no price", () => {
    const merged = makeMergedHistory([
      {
        fiscalYear: 2024,
        price: null,
        priceDate: null,
        marketCap: null,
        per: null,
        dividendYield: null,
        fcfYield: null,
        peg: null,
        hasPrice: false,
      },
    ]);
    const buffett = computeFullHistoricalScores(merged)[0].scores.find(
      (s) => s.strategyId === "buffett",
    )!;

    expect(buffett.isPartial).toBe(true);
    expect(buffett.coverage).toBeLessThan(1);
    // Valuation should not be available
    const valuation = buffett.subScores.find((s) => s.name === "valuation");
    expect(valuation?.available).toBe(false);
  });
});
