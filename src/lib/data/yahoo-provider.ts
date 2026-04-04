import YahooFinance from "yahoo-finance2";
import { Stock, StockFilters } from "../types";
import { DataProvider } from "./provider";

/**
 * Yahoo Finance data provider (gratuit, sans cle API).
 *
 * Utilise yahoo-finance2 v3 pour recuperer profil, ratios financiers,
 * et secteur reel. Gere les donnees manquantes avec safeNumber().
 *
 * ~100 tickers couvrant US large/mid caps + quelques europeens.
 */

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// ~100 tickers diversifies : tech, sante, finance, conso, industrie, energie, immo, telecom
const DEFAULT_TICKERS = [
  // Tech US
  "AAPL", "MSFT", "GOOG", "AMZN", "NVDA", "META", "TSLA", "CRM",
  "AMD", "INTC", "ORCL", "ADBE", "CSCO", "AVGO", "QCOM", "NOW",
  "UBER", "SQ", "SHOP", "PLTR", "SNOW", "NET", "CRWD", "PANW",
  // Sante
  "JNJ", "UNH", "ABBV", "PFE", "LLY", "MRK", "TMO", "ABT", "AMGN",
  // Finance
  "JPM", "V", "MA", "BAC", "GS", "BLK", "SCHW", "AXP",
  // Conso base
  "PG", "KO", "PEP", "WMT", "COST", "CL", "MDLZ", "KHC",
  // Conso cyclique
  "HD", "MCD", "NKE", "SBUX", "TJX", "LOW", "BKNG",
  // Industrie
  "CAT", "HON", "UPS", "GE", "RTX", "DE", "LMT", "BA",
  // Energie
  "XOM", "CVX", "COP", "SLB", "EOG",
  // Telecom
  "T", "VZ", "TMUS",
  // Immobilier
  "O", "AMT", "PLD", "SPG",
  // Europe
  "ASML", "SAP", "NVO", "AZN", "SHEL", "TTE", "MC.PA", "OR.PA",
  "SIE.DE", "ALV.DE",
];

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
};

async function fetchStock(ticker: string): Promise<Stock | undefined> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.quoteSummary(ticker, {
      modules: [
        "price",
        "summaryDetail",
        "defaultKeyStatistics",
        "financialData",
        "assetProfile",
      ],
    });

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

    // Yahoo retourne ROE en decimal (1.52 = 152%)
    const roe = parseFloat((safeNum(financial?.returnOnEquity) * 100).toFixed(1));

    // Yahoo retourne debtToEquity deja en % (102.63 = ratio 1.03)
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
      history: [], // Yahoo quoteSummary ne fournit pas l'historique EPS simplement
    };
  } catch {
    return undefined;
  }
}

export class YahooDataProvider implements DataProvider {
  readonly name = "yahoo";
  private readonly tickers: readonly string[];

  constructor(tickers?: readonly string[]) {
    this.tickers = tickers ?? DEFAULT_TICKERS;
  }

  async getStocks(filters?: StockFilters): Promise<readonly Stock[]> {
    // Fetch par batch de 10 pour eviter de surcharger Yahoo
    const batchSize = 10;
    const allStocks: Stock[] = [];

    for (let i = 0; i < this.tickers.length; i += batchSize) {
      const batch = this.tickers.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((t) => fetchStock(t))
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          allStocks.push(r.value);
        }
      }
    }

    let stocks = allStocks;

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
