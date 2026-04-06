import { describe, it, expect, vi, beforeEach } from "vitest";
import { promises as fs } from "fs";

import {
  getSecHistory,
  hasSecData,
  getAvailableTickers,
  resetCache,
} from "../sec-history-provider";

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

const mockReadFile = vi.mocked(fs.readFile);

const SAMPLE_INDEX = JSON.stringify({
  schema_version: "1.0",
  last_updated: "2026-04-06",
  tickers: ["AAPL", "MSFT"],
  count: 2,
});

const SAMPLE_TICKER = JSON.stringify({
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
});

beforeEach(() => {
  vi.clearAllMocks();
  resetCache();
});

describe("hasSecData", () => {
  it("returns true for a ticker in the index", async () => {
    mockReadFile.mockResolvedValueOnce(SAMPLE_INDEX as never);
    const result = await hasSecData("MSFT");
    expect(result).toBe(true);
  });

  it("returns false for a ticker not in the index", async () => {
    mockReadFile.mockResolvedValueOnce(SAMPLE_INDEX as never);
    const result = await hasSecData("GOOG");
    expect(result).toBe(false);
  });

  it("returns false when index file is missing", async () => {
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));
    const result = await hasSecData("MSFT");
    expect(result).toBe(false);
  });

  it("handles case-insensitive ticker lookup", async () => {
    mockReadFile.mockResolvedValueOnce(SAMPLE_INDEX as never);
    const result = await hasSecData("msft");
    expect(result).toBe(true);
  });
});

describe("getSecHistory", () => {
  it("returns ticker data when available", async () => {
    // First call reads _index.json
    mockReadFile.mockResolvedValueOnce(SAMPLE_INDEX as never);
    // Second call reads MSFT.json
    mockReadFile.mockResolvedValueOnce(SAMPLE_TICKER as never);

    const result = await getSecHistory("MSFT");
    expect(result).not.toBeNull();
    expect(result!.ticker).toBe("MSFT");
    expect(result!.annuals).toHaveLength(1);
    expect(result!.annuals[0].fiscal_year).toBe(2024);
  });

  it("returns null for unknown ticker", async () => {
    mockReadFile.mockResolvedValueOnce(SAMPLE_INDEX as never);
    const result = await getSecHistory("UNKNOWN");
    expect(result).toBeNull();
  });

  it("returns null when JSON file read fails", async () => {
    mockReadFile.mockResolvedValueOnce(SAMPLE_INDEX as never);
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));
    const result = await getSecHistory("MSFT");
    expect(result).toBeNull();
  });
});

describe("getAvailableTickers", () => {
  it("returns list of tickers from index", async () => {
    mockReadFile.mockResolvedValueOnce(SAMPLE_INDEX as never);
    const result = await getAvailableTickers();
    expect(result).toEqual(["AAPL", "MSFT"]);
  });

  it("returns empty array when index is missing", async () => {
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));
    const result = await getAvailableTickers();
    expect(result).toEqual([]);
  });
});
