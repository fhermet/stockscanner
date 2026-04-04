import yahooFinance from "yahoo-finance2";
import { Stock, StockFilters, YearlyData } from "../types";
import { DataProvider } from "./provider";

/**
 * Yahoo Finance data provider (gratuit, sans cle API).
 *
 * Utilise yahoo-finance2 pour recuperer profil, ratios financiers,
 * et historique. Gere les donnees manquantes en retournant des
 * valeurs par defaut (0) plutot qu'en echouant.
 *
 * Limites : pas de vrai screener cote Yahoo. On maintient une
 * liste de tickers connus et on enrichit chacun individuellement.
 */

const DEFAULT_TICKERS = [
  "AAPL", "MSFT", "GOOG", "AMZN", "NVDA", "META", "TSLA",
  "JNJ", "UNH", "ABBV",
  "JPM", "V", "MA",
  "PG", "KO", "PEP", "WMT", "COST", "MCD",
  "HD", "CRM", "AMD", "ASML",
  "T", "O",
];

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && isFinite(value)) return value;
  return fallback;
}

async function fetchStock(ticker: string): Promise<Stock | undefined> {
  try {
    const result = await yahooFinance.quoteSummary(ticker, {
      modules: [
        "price",
        "summaryDetail",
        "defaultKeyStatistics",
        "financialData",
        "earningsTrend",
      ],
    });

    const price = result.price;
    const detail = result.summaryDetail;
    const stats = result.defaultKeyStatistics;
    const financial = result.financialData;

    if (!price || !detail) return undefined;

    const marketCap = safeNumber(price.marketCap) / 1_000_000_000;
    if (marketCap <= 0) return undefined;

    const currentPrice = safeNumber(price.regularMarketPrice);
    const per = safeNumber(detail.trailingPE ?? stats?.trailingEps);
    const forwardPE = safeNumber(detail.forwardPE);
    const epsGrowthRaw = safeNumber(financial?.earningsGrowth) * 100;
    const revenueGrowthRaw = safeNumber(financial?.revenueGrowth) * 100;

    // PEG : forward PE / EPS growth
    let peg = safeNumber(stats?.pegRatio);
    if (peg === 0 && forwardPE > 0 && epsGrowthRaw > 0) {
      peg = parseFloat((forwardPE / epsGrowthRaw).toFixed(2));
    }

    const stock: Stock = {
      ticker: price.symbol ?? ticker,
      name: price.shortName ?? price.longName ?? ticker,
      sector: mapYahooSector(price.quoteType ?? ""),
      country: "USA",
      exchange: price.exchangeName ?? "N/A",
      marketCap: parseFloat(marketCap.toFixed(1)),
      price: parseFloat(currentPrice.toFixed(2)),
      per: Math.round(per),
      peg: parseFloat(peg.toFixed(2)),
      roe: parseFloat((safeNumber(financial?.returnOnEquity) * 100).toFixed(1)),
      debtToEquity: parseFloat(
        (safeNumber(financial?.debtToEquity) / 100).toFixed(2)
      ),
      operatingMargin: parseFloat(
        (safeNumber(financial?.operatingMargins) * 100).toFixed(1)
      ),
      freeCashFlow: parseFloat(
        (safeNumber(financial?.freeCashflow) / 1_000_000_000).toFixed(1)
      ),
      revenueGrowth: parseFloat(revenueGrowthRaw.toFixed(1)),
      epsGrowth: parseFloat(epsGrowthRaw.toFixed(1)),
      dividendYield: parseFloat(
        (safeNumber(detail.dividendYield) * 100).toFixed(2)
      ),
      payoutRatio: Math.round(safeNumber(detail.payoutRatio) * 100),
      history: [],
    };

    return stock;
  } catch {
    return undefined;
  }
}

function mapYahooSector(quoteType: string): string {
  // Yahoo ne renvoie pas toujours le secteur via quoteSummary.
  // On utilise quoteType comme fallback minimal.
  const sectorMap: Record<string, string> = {
    EQUITY: "Actions",
    ETF: "ETF",
    MUTUALFUND: "Fonds",
  };
  return sectorMap[quoteType] ?? "Autre";
}

export class YahooDataProvider implements DataProvider {
  readonly name = "yahoo";
  private readonly tickers: readonly string[];

  constructor(tickers?: readonly string[]) {
    this.tickers = tickers ?? DEFAULT_TICKERS;
  }

  async getStocks(filters?: StockFilters): Promise<readonly Stock[]> {
    const results = await Promise.allSettled(
      this.tickers.map((t) => fetchStock(t))
    );

    let stocks = results
      .filter(
        (r): r is PromiseFulfilledResult<Stock | undefined> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value)
      .filter((s): s is Stock => s !== undefined);

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
    return [
      "Technologie",
      "Sante",
      "Finance",
      "Consommation de base",
      "Consommation cyclique",
      "Telecom",
      "Immobilier",
      "Automobile",
    ];
  }

  async getCountries(): Promise<readonly string[]> {
    return ["USA", "Pays-Bas"];
  }
}
