import { describe, it, expect } from "vitest";
import {
  ALL_INDICES,
  getCountries,
  getIndicesForCountry,
  getIndexById,
  getIndexTickers,
  getAllTickersForCountry,
  isValidIndexId,
} from "../index";

describe("indices registry", () => {
  it("has 9 indices", () => {
    expect(ALL_INDICES.length).toBe(9);
  });

  it("all indices have required fields", () => {
    for (const idx of ALL_INDICES) {
      expect(idx.id).toBeTruthy();
      expect(idx.name).toBeTruthy();
      expect(idx.countryCode).toBeTruthy();
      expect(idx.tickers.length).toBeGreaterThanOrEqual(0);
      expect(idx.theoreticalCount).toBeGreaterThan(0);
    }
  });

  it("no duplicate index ids", () => {
    const ids = ALL_INDICES.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getCountries", () => {
  it("returns 6 countries", () => {
    expect(getCountries().length).toBe(6);
  });

  it("each country has a flag and indexCount > 0", () => {
    for (const c of getCountries()) {
      expect(c.flag).toBeTruthy();
      expect(c.indexCount).toBeGreaterThan(0);
    }
  });
});

describe("getIndicesForCountry", () => {
  it("returns 4 indices for US", () => {
    const us = getIndicesForCountry("us");
    expect(us.length).toBe(4);
    expect(us.map((i) => i.id)).toContain("sp500");
    expect(us.map((i) => i.id)).toContain("sp400");
    expect(us.map((i) => i.id)).toContain("nasdaq100");
    expect(us.map((i) => i.id)).toContain("dowjones");
  });

  it("returns 1 index for France", () => {
    expect(getIndicesForCountry("fr").length).toBe(1);
  });

  it("returns empty for unknown country", () => {
    expect(getIndicesForCountry("xx").length).toBe(0);
  });
});

describe("getIndexById", () => {
  it("finds sp500", () => {
    const idx = getIndexById("sp500");
    expect(idx).toBeDefined();
    expect(idx!.name).toBe("S&P 500");
    expect(idx!.tickers.length).toBeGreaterThan(100);
  });

  it("finds cac40", () => {
    const idx = getIndexById("cac40");
    expect(idx).toBeDefined();
    expect(idx!.tickers.length).toBeGreaterThan(20);
  });

  it("returns undefined for unknown", () => {
    expect(getIndexById("unknown")).toBeUndefined();
  });
});

describe("getIndexTickers", () => {
  it("returns tickers for dowjones", () => {
    const tickers = getIndexTickers("dowjones");
    expect(tickers.length).toBeGreaterThanOrEqual(29);
    expect(tickers).toContain("AAPL");
    expect(tickers).toContain("MSFT");
  });
});

describe("getAllTickersForCountry", () => {
  it("US tickers are deduplicated across indices", () => {
    const tickers = getAllTickersForCountry("us");
    expect(new Set(tickers).size).toBe(tickers.length);
    // Should be less than sum of all US index tickers (overlaps)
    const rawSum = getIndicesForCountry("us").reduce(
      (acc, idx) => acc + idx.tickers.length,
      0
    );
    expect(tickers.length).toBeLessThanOrEqual(rawSum);
  });
});

describe("isValidIndexId", () => {
  it("validates known indices", () => {
    expect(isValidIndexId("sp500")).toBe(true);
    expect(isValidIndexId("cac40")).toBe(true);
    expect(isValidIndexId("ftse100")).toBe(true);
  });

  it("rejects unknown indices", () => {
    expect(isValidIndexId("unknown")).toBe(false);
    expect(isValidIndexId("")).toBe(false);
  });
});

describe("coverage transparency", () => {
  it("S&P 500 covers at least 500 tickers (dynamically loaded from SEC manifest)", () => {
    const idx = getIndexById("sp500")!;
    expect(idx.tickers.length).toBeGreaterThanOrEqual(idx.theoreticalCount);
  });

  it("NASDAQ 100 covers at least 80% of theoretical (some tickers lack SEC data)", () => {
    const idx = getIndexById("nasdaq100")!;
    expect(idx.tickers.length).toBeGreaterThanOrEqual(idx.theoreticalCount * 0.8);
  });

  it("Dow Jones covers at least 90% of theoretical (some tickers lack SEC data)", () => {
    const idx = getIndexById("dowjones")!;
    expect(idx.tickers.length).toBeGreaterThanOrEqual(idx.theoreticalCount * 0.9);
  });
});
