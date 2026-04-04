import YahooFinance from "yahoo-finance2";
import { Stock, StockFilters } from "../types";
import { DataProvider } from "./provider";
import { createLogger } from "../logger";
import { ALL_TICKERS } from "../tickers";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    const per = parseFloat(safeNum(detail?.trailingPE).toFixed(1));
    const peg = parseFloat(safeNum(stats?.pegRatio).toFixed(2));
    const roe = parseFloat((safeNum(financial?.returnOnEquity) * 100).toFixed(1));
    const debtToEquity = parseFloat(
      (safeNum(financial?.debtToEquity) / 100).toFixed(2)
    );
    const operatingMargin = parseFloat(
      (safeNum(financial?.operatingMargins) * 100).toFixed(1)
    );
    const freeCashFlow = parseFloat(
      (safeNum(financial?.freeCashflow) / 1_000_000_000).toFixed(1)
    );
    const revenueGrowth = parseFloat(
      (safeNum(financial?.revenueGrowth) * 100).toFixed(1)
    );
    const epsGrowth = parseFloat(
      (safeNum(financial?.earningsGrowth) * 100).toFixed(1)
    );
    const dividendYield = parseFloat(
      (safeNum(detail?.dividendYield) * 100).toFixed(2)
    );
    const payoutRatio = Math.round(safeNum(detail?.payoutRatio) * 100);

    const rawSector: string = profile?.sector ?? "";
    const rawCountry: string = profile?.country ?? "";

    return {
      ticker: price.symbol ?? ticker,
      name: price.shortName ?? price.longName ?? ticker,
      sector: SECTOR_MAP[rawSector] ?? (rawSector || "Autre"),
      country: COUNTRY_MAP[rawCountry] ?? (rawCountry || "Inconnu"),
      exchange: price.exchangeName ?? "N/A",
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
      history: [],
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
  const batchSize = 20;
  const parallelGroups = 3;
  const waveSize = batchSize * parallelGroups;
  const allStocks: Stock[] = [];
  let failures = 0;
  const start = Date.now();

  for (let i = 0; i < tickers.length; i += waveSize) {
    const wave = tickers.slice(i, i + waveSize);

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
          allStocks.push(r.value);
        } else {
          failures++;
        }
      }
    }
  }

  log.info("fetchAll complete", {
    total: tickers.length,
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
