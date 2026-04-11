import YahooFinance from "yahoo-finance2";
import { Stock, StockFilters } from "../types";
import { DataProvider } from "./provider";
import { createLogger } from "../logger";
import { ALL_TICKERS } from "../tickers";
import { getSecHistory, preloadSecData } from "./sec-history-provider";
import type { SecAnnual } from "@/lib/types/sec-fundamentals";

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
  const shares = annual.fundamentals.shares_outstanding;
  if (divPaid === null || divPaid <= 0 || shares === null || shares <= 0) return 0;
  return parseFloat((divPaid / shares).toFixed(4));
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
  "Communication Services": "Telecom",
  "Basic Materials": "Materiaux",
};

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

    const perRaw = nullableNum(detail?.trailingPE);
    const per = perRaw !== null ? parseFloat(perRaw.toFixed(1)) : null;

    const epsGrowthRaw = nullableNum(financial?.earningsGrowth);
    const epsGrowth = epsGrowthRaw !== null ? parseFloat((epsGrowthRaw * 100).toFixed(1)) : null;

    const pegRaw = nullableNum(stats?.pegRatio);
    // Fallback: compute PEG from P/E and EPS growth when Yahoo doesn't provide it
    const pegComputed = (pegRaw === null && per !== null && epsGrowthRaw !== null && epsGrowthRaw > 0)
      ? per / (epsGrowthRaw * 100)
      : null;
    const pegValue = pegRaw ?? pegComputed;
    const peg = pegValue !== null ? parseFloat(pegValue.toFixed(2)) : null;

    const roeRaw = nullableNum(financial?.returnOnEquity);
    const roe = roeRaw !== null ? parseFloat((roeRaw * 100).toFixed(1)) : null;

    const debtRaw = nullableNum(financial?.debtToEquity);
    const debtToEquity = debtRaw !== null ? parseFloat((debtRaw / 100).toFixed(2)) : null;

    const marginRaw = nullableNum(financial?.operatingMargins);
    const operatingMargin = marginRaw !== null ? parseFloat((marginRaw * 100).toFixed(1)) : null;

    const fcfRaw = nullableNum(financial?.freeCashflow);
    const freeCashFlow = fcfRaw !== null ? parseFloat((fcfRaw / 1_000_000_000).toFixed(1)) : null;

    const revGrowthRaw = nullableNum(financial?.revenueGrowth);
    const revenueGrowth = revGrowthRaw !== null ? parseFloat((revGrowthRaw * 100).toFixed(1)) : null;

    const divYieldRaw = nullableNum(detail?.dividendYield);
    const dividendYield = divYieldRaw !== null ? parseFloat((divYieldRaw * 100).toFixed(2)) : null;

    const payoutRaw = nullableNum(detail?.payoutRatio);
    const payoutRatio = payoutRaw !== null ? Math.round(payoutRaw * 100) : null;

    const rawSector: string = profile?.sector ?? "";
    const rawCountry: string = profile?.country ?? "";

    // Load SEC data for US tickers: history + fallback for missing Yahoo metrics
    let history: Stock["history"] = [];
    const secData = await getSecHistory(ticker);
    let secFallbackRoe = roe;
    let secFallbackDebt = debtToEquity;
    let secFallbackMargin = operatingMargin;
    let secFallbackFcf = freeCashFlow;
    let secFallbackRevGrowth = revenueGrowth;
    let secFallbackEpsGrowth = epsGrowth;
    let secFallbackPer = per;
    let secFallbackDivYield = dividendYield;
    let secFallbackPayout = payoutRatio;

    if (secData && secData.annuals.length > 0) {
      // Build history
      history = secData.annuals
        .filter((a) => a.fundamentals.eps_diluted !== null)
        .map((a) => ({
          year: a.fiscal_year,
          revenue: (a.fundamentals.revenue ?? 0) / 1_000_000,
          eps: a.fundamentals.eps_diluted!,
          dividendPerShare: computeDPS(a),
        }));

      // Use latest SEC annual as fallback for missing Yahoo metrics
      const latest = secData.annuals[secData.annuals.length - 1];
      const r = latest.ratios;
      const f = latest.fundamentals;

      if (secFallbackRoe === null && r.roe !== null) {
        secFallbackRoe = parseFloat((r.roe * 100).toFixed(1));
      }
      if (secFallbackDebt === null && r.debt_to_equity !== null) {
        secFallbackDebt = parseFloat(r.debt_to_equity.toFixed(2));
      }
      if (secFallbackMargin === null && r.operating_margin !== null) {
        secFallbackMargin = parseFloat((r.operating_margin * 100).toFixed(1));
      }
      if (secFallbackFcf === null && r.free_cash_flow !== null) {
        secFallbackFcf = parseFloat((r.free_cash_flow / 1_000_000_000).toFixed(1));
      }
      if (secFallbackRevGrowth === null && r.revenue_growth !== null) {
        secFallbackRevGrowth = parseFloat((r.revenue_growth * 100).toFixed(1));
      }
      if (secFallbackEpsGrowth === null && r.eps_growth !== null) {
        secFallbackEpsGrowth = parseFloat((r.eps_growth * 100).toFixed(1));
      }
      if (secFallbackPayout === null && r.payout_ratio !== null) {
        secFallbackPayout = Math.round(r.payout_ratio * 100);
      }
      if (secFallbackPer === null && currentPrice > 0 && f.eps_diluted !== null && f.eps_diluted > 0) {
        secFallbackPer = parseFloat((currentPrice / f.eps_diluted).toFixed(1));
      }
      if (secFallbackDivYield === null && currentPrice > 0) {
        // dividends_paid null = no dividends = yield 0%
        const divPaid = f.dividends_paid ?? 0;
        const shares = f.shares_outstanding;
        if (shares !== null && shares > 0) {
          const dps = divPaid > 0 ? divPaid / shares : 0;
          secFallbackDivYield = parseFloat(((dps / currentPrice) * 100).toFixed(2));
        }
      }
    }

    // Recompute PEG with potentially SEC-enriched values
    const finalPer = secFallbackPer;
    const finalEpsGrowthRaw = secFallbackEpsGrowth !== null ? secFallbackEpsGrowth / 100 : null;
    let finalPeg = peg;
    if (finalPeg === null && finalPer !== null && finalEpsGrowthRaw !== null && finalEpsGrowthRaw > 0) {
      finalPeg = parseFloat((finalPer / (finalEpsGrowthRaw * 100)).toFixed(2));
    }

    return {
      ticker: price.symbol ?? ticker,
      name: price.shortName ?? price.longName ?? ticker,
      sector: SECTOR_MAP[rawSector] ?? (rawSector || "Autre"),
      country: COUNTRY_MAP[rawCountry] ?? (rawCountry || "Inconnu"),
      exchange: price.exchangeName ?? "N/A",
      currency: (price.currency as string) ?? "USD",
      marketCap,
      price: parseFloat(currentPrice.toFixed(2)),
      per: secFallbackPer,
      peg: finalPeg,
      roe: secFallbackRoe,
      debtToEquity: secFallbackDebt,
      operatingMargin: secFallbackMargin,
      freeCashFlow: secFallbackFcf,
      revenueGrowth: secFallbackRevGrowth,
      epsGrowth: secFallbackEpsGrowth,
      dividendYield: secFallbackDivYield,
      payoutRatio: secFallbackPayout,
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
