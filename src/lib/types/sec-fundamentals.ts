/**
 * Types for SEC/EDGAR historical fundamentals data.
 * Maps to the JSON schema exported by stock-scanner-data (schema_version 1.0).
 */

export interface SecFundamentals {
  readonly revenue: number | null;
  readonly net_income: number | null;
  readonly shareholders_equity: number | null;
  readonly total_debt: number | null;
  readonly eps_diluted: number | null;
  readonly dividends_paid: number | null;
  readonly operating_cash_flow: number | null;
  readonly capital_expenditure: number | null;
  readonly operating_income: number | null;
  readonly shares_outstanding: number | null;
}

export interface SecRatios {
  readonly roe: number | null;
  readonly debt_to_equity: number | null;
  readonly revenue_growth: number | null;
  readonly eps_growth: number | null;
  readonly free_cash_flow: number | null;
  readonly payout_ratio: number | null;
  readonly operating_margin: number | null;
}

export interface SecCompleteness {
  readonly present_field_count: number;
  readonly missing_field_count: number;
  readonly missing_field_names: readonly string[];
  readonly completeness_ratio: number;
}

export interface SecAnnual {
  readonly fiscal_year: number;
  readonly fundamentals: SecFundamentals;
  readonly ratios: SecRatios;
  readonly completeness: SecCompleteness;
}

export interface SecTickerData {
  readonly ticker: string;
  readonly company_name: string;
  readonly cik: string;
  readonly schema_version: string;
  readonly last_updated: string;
  readonly annuals: readonly SecAnnual[];
}

export interface SecIndex {
  readonly schema_version: string;
  readonly last_updated: string;
  readonly tickers: readonly string[];
  readonly count: number;
}

/** API response for GET /api/stocks/[ticker]/fundamentals-history */
export interface FundamentalsHistoryResponse {
  readonly available: boolean;
  readonly data: SecTickerData | null;
  readonly message?: string;
}
