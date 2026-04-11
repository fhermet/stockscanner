import YahooFinance from "yahoo-finance2";
import { Stock, StockFilters } from "../types";
import { DataProvider } from "./provider";
import { createLogger } from "../logger";
import { ALL_TICKERS } from "../tickers";
import { getSecHistory, preloadSecData } from "./sec-history-provider";
import type { SecAnnual } from "@/lib/types/sec-fundamentals";
import type { YearlyData } from "../types";

const log = createLogger("yahoo-provider");

/**
 * Yahoo Finance data provider (gratuit, sans cle API).
 *
 * Utilise yahoo-finance2 v3 pour recuperer profil, ratios financiers,
 * et secteur reel. Gere les donnees manquantes avec safeNum().
 *
 * Ticker universe: ~340 actions (S&P 500 + NASDAQ 100 + CAC 40 +
 * DAX 40 + FTSE 100) via le module tickers/.
 *
 * Parallel batching: 3 groupes de 20 en parallele pour ~15s cold load.
 */

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
});

function safeNum(value: unknown, fallback = 0): number {
  if (typeof value === "number" && isFinite(value)) return value;
  return fallback;
}

function nullableNum(value: unknown): number | null {
  if (typeof value === "number" && isFinite(value)) return value;
  return null;
}

function computeDPS(annual: SecAnnual): number {
  const divPaid = annual.fundamentals.dividends_paid;
  let shares = annual.fundamentals.shares_outstanding;
  if (divPaid === null || divPaid <= 0 || shares === null || shares <= 0) return 0;
  // Guard: some SEC filings report shares in millions instead of units.
  // Detect by checking if net_income / shares is absurdly high (> $10K per share).
  const ni = annual.fundamentals.net_income;
  if (ni !== null && Math.abs(ni) > 1e6 && shares < 100000 && Math.abs(ni / shares) > 10000) {
    shares = shares * 1_000_000;
  }
  return parseFloat((divPaid / shares).toFixed(4));
}

interface SplitEvent {
  readonly date: Date;
  readonly ratio: number; // e.g. 7 for a 7:1 split
}

/**
 * Fetch stock split history from Yahoo Finance.
 * Returns split events sorted by date (oldest first).
 */
async function fetchSplits(ticker: string): Promise<readonly SplitEvent[]> {
  try {
    const result = await yf.chart(ticker, {
      period1: new Date("2000-01-01"),
      period2: new Date(),
      interval: "1mo",
      events: "splits",
    });
    const splits = (result.events?.splits ?? []) as Array<{
      date: Date | string;
      numerator: number;
      denominator: number;
    }>;
    return splits
      .filter((s) => s.numerator > 0 && s.denominator > 0)
      .map((s) => ({
        date: new Date(s.date),
        ratio: s.numerator / s.denominator,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  } catch {
    return [];
  }
}

/**
 * Adjust SEC historical per-share metrics (EPS, DPS) for stock splits.
 * Applies cumulative split factors so all values are in current-share terms.
 */
function adjustHistoryForSplits(
  history: YearlyData[],
  splits: readonly SplitEvent[],
): YearlyData[] {
  if (splits.length === 0) return history;

  // Compute cumulative split factor for each year
  // A split in June 2014 (ratio 7) means all data before 2014 must be divided by 7
  // We work backwards: the most recent year has factor 1.0
  return history.map((entry) => {
    let factor = 1;
    for (const split of splits) {
      // If the fiscal year ends before the split date, the per-share data is pre-split
      const fiscalYearEnd = new Date(entry.year, 11, 31); // Dec 31 of fiscal year
      if (fiscalYearEnd < split.date) {
        factor *= split.ratio;
      }
    }
    if (factor === 1) return entry;
    return {
      year: entry.year,
      revenue: entry.revenue,
      eps: parseFloat((entry.eps / factor).toFixed(4)),
      dividendPerShare: parseFloat((entry.dividendPerShare / factor).toFixed(4)),
    };
  });
}

const SECTOR_MAP: Record<string, string> = {
  Technology: "Technologie",
  Healthcare: "Sante",
  "Financial Services": "Finance",
  "Consumer Defensive": "Consommation de base",
  "Consumer Cyclical": "Consommation cyclique",
  Industrials: "Industrie",
  Energy: "Energie",
  "Real Estate": "Immobilier",
  Utilities: "Services publics",
  "Basic Materials": "Materiaux",
  // "Communication Services" is split based on industry — see mapSector()
};

/**
 * Map Yahoo sector+industry to our sector taxonomy.
 * "Communication Services" needs special handling: it contains both
 * tech companies (GOOG, META, NFLX) and telecom operators (VZ, T, TMUS).
 */
function mapSector(rawSector: string, rawIndustry: string): string {
  if (rawSector === "Communication Services") {
    return rawIndustry === "Telecom Services" ? "Telecom" : "Technologie";
  }
  return SECTOR_MAP[rawSector] ?? (rawSector || "Autre");
}

const COUNTRY_MAP: Record<string, string> = {
  "United States": "USA",
  "United Kingdom": "Royaume-Uni",
  France: "France",
  Germany: "Allemagne",
  Netherlands: "Pays-Bas",
  Denmark: "Danemark",
  Switzerland: "Suisse",
  Ireland: "Irlande",
  Japan: "Japon",
  Sweden: "Suede",
};

async function fetchStock(ticker: string): Promise<Stock | undefined> {
  try {
    const result: any = await (yf as any).quoteSummary(ticker, {
      modules: [
        "price",
        "summaryDetail",
        "defaultKeyStatistics",
        "financialData",
        "assetProfile",
      ],
    }, { validateResult: false });

    const price = result.price;
    const detail = result.summaryDetail;
    const stats = result.defaultKeyStatistics;
    const financial = result.financialData;
    const profile = result.assetProfile;

    if (!price) return undefined;

    const marketCapRaw = safeNum(price.marketCap);
    if (marketCapRaw <= 0) return undefined;

    const marketCap = parseFloat((marketCapRaw / 1_000_000_000).toFixed(1));
    const currentPrice = safeNum(price.regularMarketPrice);

    // --- Yahoo: only used for price-derived metrics and metadata ---
    const perYahoo = nullableNum(detail?.trailingPE);
    const per = perYahoo !== null ? parseFloat(perYahoo.toFixed(1)) : null;

    const rawSector: string = profile?.sector ?? "";
    const rawIndustry: string = profile?.industry ?? "";
    const rawCountry: string = profile?.country ?? "";

    // --- SEC: primary source for all fundamental metrics ---
    let history: Stock["history"] = [];
    const secData = await getSecHistory(ticker);

    // Start with null for all fundamentals — SEC fills them, Yahoo is last resort
    let roe: number | null = null;
    let debtToEquity: number | null = null;
    let operatingMargin: number | null = null;
    let freeCashFlow: number | null = null;
    let revenueGrowth: number | null = null;
    let epsGrowth: number | null = null;
    let dividendYield: number | null = null;
    let payoutRatio: number | null = null;

    if (secData && secData.annuals.length > 0) {
      // Build history and adjust for stock splits
      const rawHistory: YearlyData[] = secData.annuals
        .filter((a) => a.fundamentals.eps_diluted !== null)
        .map((a) => ({
          year: a.fiscal_year,
          revenue: (a.fundamentals.revenue ?? 0) / 1_000_000,
          eps: a.fundamentals.eps_diluted!,
          dividendPerShare: computeDPS(a),
        }));
      const splits = await fetchSplits(ticker);
      history = adjustHistoryForSplits(rawHistory, splits);

      // SEC is primary source — audited 10-K data
      const latest = secData.annuals[secData.annuals.length - 1];
      const r = latest.ratios;
      const f = latest.fundamentals;

      if (r.roe !== null) {
        // ROE > 100% with very small equity is an artifact, not a signal.
        // Colgate (CL) has equity=54M with NI=2.1B → ROE=3950%. Not meaningful.
        const roePercent = r.roe * 100;
        const equityTooSmall = f.net_income !== null && f.shareholders_equity !== null
          && f.shareholders_equity > 0
          && f.shareholders_equity < Math.abs(f.net_income) * 0.1;
        roe = equityTooSmall ? null : parseFloat(roePercent.toFixed(1));
      }
      if (r.debt_to_equity !== null) {
        // Same logic: D/E > 10 with tiny equity is not meaningful
        const deTooExtreme = f.shareholders_equity !== null && f.shareholders_equity > 0
          && f.net_income !== null
          && f.shareholders_equity < Math.abs(f.net_income) * 0.1;
        debtToEquity = deTooExtreme ? null : parseFloat(r.debt_to_equity.toFixed(2));
      }
      if (r.operating_margin !== null) {
        operatingMargin = parseFloat((r.operating_margin * 100).toFixed(1));
      }
      if (r.free_cash_flow !== null) {
        freeCashFlow = parseFloat((r.free_cash_flow / 1_000_000_000).toFixed(1));
      }
      if (r.revenue_growth !== null) {
        revenueGrowth = parseFloat((r.revenue_growth * 100).toFixed(1));
      }
      if (r.eps_growth !== null) {
        epsGrowth = parseFloat((r.eps_growth * 100).toFixed(1));
      }
      if (r.payout_ratio !== null) {
        payoutRatio = Math.round(r.payout_ratio * 100);
      }
      // PER from current price / SEC EPS (more reliable than Yahoo trailing PE)
      if (per === null && currentPrice > 0 && f.eps_diluted !== null && f.eps_diluted > 0) {
        // Only as fallback — Yahoo PER uses more recent earnings data
      }
      // Dividend yield from SEC DPS / current price
      if (currentPrice > 0) {
        const divPaid = f.dividends_paid ?? 0;
        let shares = f.shares_outstanding;
        if (shares !== null && shares > 0) {
          // Guard: detect shares reported in millions
          const ni = f.net_income;
          if (ni !== null && Math.abs(ni) > 1e6 && shares < 100000 && Math.abs(ni / shares) > 10000) {
            shares = shares * 1_000_000;
          }
          const dps = divPaid > 0 ? divPaid / shares : 0;
          dividendYield = parseFloat(((dps / currentPrice) * 100).toFixed(2));
        }
      }
    }

    // --- Yahoo fallback: only for tickers without SEC data (European stocks) ---
    // When SEC data exists, don't override with Yahoo — SEC nulls are intentional
    // (e.g. ROE/D/E null because equity is negative).
    const hasSec = secData !== null && secData.annuals.length > 0;
    if (roe === null && !hasSec) {
      const roeRaw = nullableNum(financial?.returnOnEquity);
      roe = roeRaw !== null ? parseFloat((roeRaw * 100).toFixed(1)) : null;
    }
    if (debtToEquity === null && !hasSec) {
      const debtRaw = nullableNum(financial?.debtToEquity);
      debtToEquity = debtRaw !== null ? parseFloat((debtRaw / 100).toFixed(2)) : null;
    }
    if (operatingMargin === null && !hasSec) {
      const marginRaw = nullableNum(financial?.operatingMargins);
      operatingMargin = marginRaw !== null ? parseFloat((marginRaw * 100).toFixed(1)) : null;
    }
    if (freeCashFlow === null && !hasSec) {
      const fcfRaw = nullableNum(financial?.freeCashflow);
      freeCashFlow = fcfRaw !== null ? parseFloat((fcfRaw / 1_000_000_000).toFixed(1)) : null;
    }
    if (revenueGrowth === null && !hasSec) {
      const revGrowthRaw = nullableNum(financial?.revenueGrowth);
      revenueGrowth = revGrowthRaw !== null ? parseFloat((revGrowthRaw * 100).toFixed(1)) : null;
    }
    if (epsGrowth === null && !hasSec) {
      const epsGrowthRaw = nullableNum(financial?.earningsGrowth);
      epsGrowth = epsGrowthRaw !== null ? parseFloat((epsGrowthRaw * 100).toFixed(1)) : null;
    }
    if (dividendYield === null && !hasSec) {
      const divYieldRaw = nullableNum(detail?.dividendYield);
      dividendYield = divYieldRaw !== null ? parseFloat((divYieldRaw * 100).toFixed(2)) : null;
    }
    if (payoutRatio === null && !hasSec) {
      const payoutRaw = nullableNum(detail?.payoutRatio);
      payoutRatio = payoutRaw !== null ? Math.round(payoutRaw * 100) : null;
    }

    // PEG = PER / eps_growth (always computed, never from Yahoo)
    let peg: number | null = null;
    if (per !== null && epsGrowth !== null && epsGrowth > 0) {
      peg = parseFloat((per / epsGrowth).toFixed(2));
    }

    return {
      ticker: price.symbol ?? ticker,
      name: price.shortName ?? price.longName ?? ticker,
      sector: mapSector(rawSector, rawIndustry),
      country: COUNTRY_MAP[rawCountry] ?? (rawCountry || "Inconnu"),
      exchange: price.exchangeName ?? "N/A",
      currency: (price.currency as string) ?? "USD",
      marketCap,
      price: parseFloat(currentPrice.toFixed(2)),
      per,
      peg,
      roe,
      debtToEquity,
      operatingMargin,
      freeCashFlow,
      revenueGrowth,
      epsGrowth,
      dividendYield,
      payoutRatio,
      history,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    log.error("fetchStock failed", { ticker, error: msg });
    return undefined;
  }
}

/**
 * Fetch tickers in parallel waves for throughput.
 * Each wave runs `parallelGroups` batches of `batchSize` concurrently.
 *
 * With 340 tickers, batchSize=20, parallelGroups=3:
 *  → 60 per wave, ~6 waves, ~15-20s cold load
 */
async function fetchAll(tickers: readonly string[]): Promise<Stock[]> {
  // Pre-load all SEC data into memory before batch fetching
  await preloadSecData();

  // Deduplicate tickers before fetching
  const uniqueTickers = [...new Set(tickers)];

  const batchSize = 20;
  const parallelGroups = 3;
  const waveSize = batchSize * parallelGroups;
  const allStocks: Stock[] = [];
  const seen = new Set<string>();
  let failures = 0;
  const start = Date.now();

  for (let i = 0; i < uniqueTickers.length; i += waveSize) {
    const wave = uniqueTickers.slice(i, i + waveSize);

    // Split wave into parallel batches
    const batches: string[][] = [];
    for (let j = 0; j < wave.length; j += batchSize) {
      batches.push(wave.slice(j, j + batchSize));
    }

    // Run batches in parallel
    const batchResults = await Promise.all(
      batches.map((batch) =>
        Promise.allSettled(batch.map((t) => fetchStock(t)))
      )
    );

    for (const results of batchResults) {
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          if (!seen.has(r.value.ticker)) {
            seen.add(r.value.ticker);
            allStocks.push(r.value);
          }
        } else {
          failures++;
        }
      }
    }
  }

  log.info("fetchAll complete", {
    total: uniqueTickers.length,
    fetched: allStocks.length,
    failures,
    durationMs: Date.now() - start,
  });

  return allStocks;
}

export class YahooDataProvider implements DataProvider {
  readonly name = "yahoo";
  private readonly tickers: readonly string[];

  constructor(tickers?: readonly string[]) {
    this.tickers = tickers ?? ALL_TICKERS;
  }

  async getStocks(filters?: StockFilters): Promise<readonly Stock[]> {
    let stocks = await fetchAll(this.tickers);

    if (filters?.sector) {
      stocks = stocks.filter((s) => s.sector === filters.sector);
    }
    if (filters?.country) {
      stocks = stocks.filter((s) => s.country === filters.country);
    }
    if (filters?.marketCapMin !== undefined) {
      stocks = stocks.filter((s) => s.marketCap >= filters.marketCapMin!);
    }
    if (filters?.marketCapMax !== undefined) {
      stocks = stocks.filter((s) => s.marketCap <= filters.marketCapMax!);
    }

    return stocks;
  }

  async getStock(ticker: string): Promise<Stock | undefined> {
    return fetchStock(ticker.toUpperCase());
  }

  async getSectors(): Promise<readonly string[]> {
    return Object.values(SECTOR_MAP).sort();
  }

  async getCountries(): Promise<readonly string[]> {
    return Object.values(COUNTRY_MAP).sort();
  }
}
