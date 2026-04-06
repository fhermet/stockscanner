/**
 * Merged history: combines SEC fundamentals with Yahoo historical prices.
 *
 * For each fiscal year, produces a complete set of metrics including
 * market-derived values (PER, dividend yield, PEG, market cap, FCF yield)
 * that are impossible to compute from SEC data alone.
 */

import type { SecAnnual, SecTickerData } from "@/lib/types/sec-fundamentals";
import type { YearlyPrice } from "./yahoo-history-provider";

// --- Types ---

export interface MergedAnnual {
  readonly fiscalYear: number;

  // SEC fundamentals (pass-through)
  readonly revenue: number | null;
  readonly netIncome: number | null;
  readonly shareholdersEquity: number | null;
  readonly totalDebt: number | null;
  readonly epsDiluted: number | null;
  readonly dividendsPaid: number | null;
  readonly operatingCashFlow: number | null;
  readonly capitalExpenditure: number | null;
  readonly operatingIncome: number | null;
  readonly sharesOutstanding: number | null;

  // SEC ratios (pass-through)
  readonly roe: number | null;
  readonly debtToEquity: number | null;
  readonly revenueGrowth: number | null;
  readonly epsGrowth: number | null;
  readonly freeCashFlow: number | null;
  readonly payoutRatio: number | null;
  readonly operatingMargin: number | null;

  // Market-derived (computed from Yahoo + SEC)
  readonly price: number | null;
  readonly priceDate: string | null;
  readonly marketCap: number | null; // in absolute value (not billions)
  readonly per: number | null;
  readonly dividendYield: number | null; // percentage
  readonly fcfYield: number | null; // percentage
  readonly peg: number | null;

  // Data source flags
  readonly hasPrice: boolean;
  readonly secCompleteness: number; // 0-1
}

export interface MergedHistory {
  readonly ticker: string;
  readonly companyName: string;
  readonly annuals: readonly MergedAnnual[];
  readonly priceYearsAvailable: number;
  readonly secYearsAvailable: number;
}

// --- Merge logic ---

export function mergeHistory(
  secData: SecTickerData,
  yearlyPrices: readonly YearlyPrice[],
): MergedHistory {
  const priceByYear = new Map<number, YearlyPrice>();
  for (const p of yearlyPrices) {
    priceByYear.set(p.year, p);
  }

  const annuals: MergedAnnual[] = secData.annuals.map((sec) => {
    const priceEntry = priceByYear.get(sec.fiscal_year);
    const price = priceEntry?.close ?? null;
    const hasPrice = price !== null;

    return {
      fiscalYear: sec.fiscal_year,

      // SEC pass-through
      revenue: sec.fundamentals.revenue,
      netIncome: sec.fundamentals.net_income,
      shareholdersEquity: sec.fundamentals.shareholders_equity,
      totalDebt: sec.fundamentals.total_debt,
      epsDiluted: sec.fundamentals.eps_diluted,
      dividendsPaid: sec.fundamentals.dividends_paid,
      operatingCashFlow: sec.fundamentals.operating_cash_flow,
      capitalExpenditure: sec.fundamentals.capital_expenditure,
      operatingIncome: sec.fundamentals.operating_income,
      sharesOutstanding: sec.fundamentals.shares_outstanding,

      roe: sec.ratios.roe,
      debtToEquity: sec.ratios.debt_to_equity,
      revenueGrowth: sec.ratios.revenue_growth,
      epsGrowth: sec.ratios.eps_growth,
      freeCashFlow: sec.ratios.free_cash_flow,
      payoutRatio: sec.ratios.payout_ratio,
      operatingMargin: sec.ratios.operating_margin,

      // Market-derived
      price,
      priceDate: priceEntry?.date ?? null,
      marketCap: computeMarketCap(price, sec.fundamentals.shares_outstanding),
      per: computePER(price, sec.fundamentals.eps_diluted),
      dividendYield: computeDividendYield(
        price,
        sec.fundamentals.dividends_paid,
        sec.fundamentals.shares_outstanding,
      ),
      fcfYield: computeFCFYield(
        price,
        sec.ratios.free_cash_flow,
        sec.fundamentals.shares_outstanding,
      ),
      peg: computePEG(price, sec.fundamentals.eps_diluted, sec.ratios.eps_growth),

      hasPrice,
      secCompleteness: sec.completeness.completeness_ratio,
    };
  });

  return {
    ticker: secData.ticker,
    companyName: secData.company_name,
    annuals,
    priceYearsAvailable: annuals.filter((a) => a.hasPrice).length,
    secYearsAvailable: secData.annuals.length,
  };
}

// --- Derived metric calculations ---

export function computeMarketCap(
  price: number | null,
  sharesOutstanding: number | null,
): number | null {
  if (price === null || sharesOutstanding === null || sharesOutstanding <= 0) {
    return null;
  }
  return price * sharesOutstanding;
}

export function computePER(
  price: number | null,
  epsDiluted: number | null,
): number | null {
  if (price === null || epsDiluted === null || epsDiluted <= 0) {
    return null;
  }
  return Math.round((price / epsDiluted) * 100) / 100;
}

export function computeDividendYield(
  price: number | null,
  dividendsPaid: number | null,
  sharesOutstanding: number | null,
): number | null {
  if (
    price === null ||
    price <= 0 ||
    dividendsPaid === null ||
    dividendsPaid <= 0 ||
    sharesOutstanding === null ||
    sharesOutstanding <= 0
  ) {
    return null;
  }
  const dps = dividendsPaid / sharesOutstanding;
  return Math.round((dps / price) * 10000) / 100; // percentage with 2 decimals
}

export function computeFCFYield(
  price: number | null,
  freeCashFlow: number | null,
  sharesOutstanding: number | null,
): number | null {
  if (
    price === null ||
    price <= 0 ||
    freeCashFlow === null ||
    sharesOutstanding === null ||
    sharesOutstanding <= 0
  ) {
    return null;
  }
  const fcfPerShare = freeCashFlow / sharesOutstanding;
  return Math.round((fcfPerShare / price) * 10000) / 100;
}

export function computePEG(
  price: number | null,
  epsDiluted: number | null,
  epsGrowth: number | null,
): number | null {
  const per = computePER(price, epsDiluted);
  if (per === null || epsGrowth === null || epsGrowth <= 0) {
    return null;
  }
  const growthPercent = epsGrowth * 100;
  if (growthPercent <= 0) return null;
  return Math.round((per / growthPercent) * 100) / 100;
}
