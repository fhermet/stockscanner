import { describe, it, expect } from "vitest";

import type {
  SecTickerData,
  SecAnnual,
  FundamentalsHistoryResponse,
} from "../sec-fundamentals";

describe("SecFundamentals types", () => {
  it("conforms to expected schema_version 1.0 structure", () => {
    const data: SecTickerData = {
      ticker: "MSFT",
      company_name: "MICROSOFT CORP",
      cik: "0000789019",
      schema_version: "1.0",
      last_updated: "2026-04-06",
      annuals: [
        {
          fiscal_year: 2024,
          fundamentals: {
            revenue: 245122000000,
            net_income: 88136000000,
            shareholders_equity: 206223000000,
            total_debt: 59965000000,
            eps_diluted: 11.86,
            dividends_paid: 22259000000,
            operating_cash_flow: 118548000000,
            capital_expenditure: 44477000000,
            operating_income: 109433000000,
            shares_outstanding: 7431000000,
          },
          ratios: {
            roe: 0.4273,
            debt_to_equity: 0.2908,
            revenue_growth: 0.1582,
            eps_growth: 0.2184,
            free_cash_flow: 74071000000,
            payout_ratio: 0.2525,
            operating_margin: 0.446438,
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

    expect(data.ticker).toBe("MSFT");
    expect(data.schema_version).toBe("1.0");
    expect(data.annuals).toHaveLength(1);
    expect(data.annuals[0].fiscal_year).toBe(2024);
    expect(data.annuals[0].ratios.operating_margin).toBe(0.446438);
    expect(data.annuals[0].completeness.completeness_ratio).toBe(1.0);
  });

  it("handles nullable fundamentals fields", () => {
    const annual: SecAnnual = {
      fiscal_year: 2015,
      fundamentals: {
        revenue: 100000000,
        net_income: null,
        shareholders_equity: null,
        total_debt: null,
        eps_diluted: null,
        dividends_paid: null,
        operating_cash_flow: 50000000,
        capital_expenditure: null,
        operating_income: null,
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
      completeness: {
        present_field_count: 2,
        missing_field_count: 6,
        missing_field_names: [
          "net_income",
          "shareholders_equity",
          "total_debt",
          "eps_diluted",
          "dividends_paid",
          "capital_expenditure",
        ],
        completeness_ratio: 0.25,
      },
    };

    expect(annual.fundamentals.net_income).toBeNull();
    expect(annual.ratios.roe).toBeNull();
    expect(annual.completeness.missing_field_count).toBe(6);
  });

  it("FundamentalsHistoryResponse with unavailable data", () => {
    const response: FundamentalsHistoryResponse = {
      available: false,
      data: null,
      message: "Historique fondamental indisponible pour cette action.",
    };

    expect(response.available).toBe(false);
    expect(response.data).toBeNull();
    expect(response.message).toBeDefined();
  });

  it("FundamentalsHistoryResponse with available data", () => {
    const response: FundamentalsHistoryResponse = {
      available: true,
      data: {
        ticker: "AAPL",
        company_name: "APPLE INC",
        cik: "0000320193",
        schema_version: "1.0",
        last_updated: "2026-04-06",
        annuals: [],
      },
    };

    expect(response.available).toBe(true);
    expect(response.data).not.toBeNull();
    expect(response.data!.ticker).toBe("AAPL");
  });
});
