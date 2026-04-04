import { Stock, StockFilters, YearlyData } from "../types";
import { DataProvider } from "./provider";

/**
 * Implementation Financial Modeling Prep du DataProvider.
 *
 * Necessite une cle API FMP dans FMP_API_KEY.
 * Plan gratuit : 250 requetes/jour.
 * Plan starter : 29$/mois, illimite.
 *
 * Endpoints utilises :
 * - /api/v3/stock-screener          → liste d'actions avec filtres
 * - /api/v3/profile/{ticker}        → profil de l'entreprise
 * - /api/v3/ratios/{ticker}         → ratios financiers
 * - /api/v3/income-statement/{ticker} → historique CA/EPS
 */

const FMP_BASE = "https://financialmodelingprep.com/api/v3";

interface FMPProfile {
  symbol: string;
  companyName: string;
  sector: string;
  country: string;
  exchangeShortName: string;
  mktCap: number;
  price: number;
  lastDiv: number;
}

interface FMPRatios {
  peRatioTTM: number;
  pegRatioTTM: number;
  returnOnEquityTTM: number;
  debtEquityRatioTTM: number;
  operatingProfitMarginTTM: number;
  freeCashFlowPerShareTTM: number;
  dividendYieldTTM: number;
  payoutRatioTTM: number;
}

interface FMPGrowth {
  revenueGrowth: number;
  epsgrowth: number;
}

interface FMPIncomeStatement {
  calendarYear: string;
  revenue: number;
  eps: number;
}

export class FMPDataProvider implements DataProvider {
  readonly name = "fmp";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const separator = endpoint.includes("?") ? "&" : "?";
    const url = `${FMP_BASE}${endpoint}${separator}apikey=${this.apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`FMP API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  private async buildStock(ticker: string): Promise<Stock | undefined> {
    try {
      const [profiles, ratiosArr, growthArr, incomeArr] = await Promise.all([
        this.fetch<FMPProfile[]>(`/profile/${ticker}`),
        this.fetch<FMPRatios[]>(`/ratios-ttm/${ticker}`),
        this.fetch<FMPGrowth[]>(`/financial-growth/${ticker}?limit=1`),
        this.fetch<FMPIncomeStatement[]>(
          `/income-statement/${ticker}?limit=4`
        ),
      ]);

      const profile = profiles[0];
      const ratios = ratiosArr[0];
      const growth = growthArr[0];

      if (!profile || !ratios) return undefined;

      const history: YearlyData[] = (incomeArr ?? [])
        .slice(0, 4)
        .reverse()
        .map((inc) => ({
          year: parseInt(inc.calendarYear, 10),
          revenue: Math.round(inc.revenue / 1_000_000),
          eps: inc.eps,
          dividendPerShare: profile.lastDiv ?? 0,
        }));

      return {
        ticker: profile.symbol,
        name: profile.companyName,
        sector: profile.sector ?? "Autre",
        country: profile.country ?? "Inconnu",
        exchange: profile.exchangeShortName ?? "N/A",
        marketCap: Math.round(profile.mktCap / 1_000_000_000),
        price: profile.price,
        per: Math.round(ratios.peRatioTTM ?? 0),
        peg: parseFloat((ratios.pegRatioTTM ?? 0).toFixed(2)),
        roe: parseFloat(((ratios.returnOnEquityTTM ?? 0) * 100).toFixed(1)),
        debtToEquity: parseFloat(
          (ratios.debtEquityRatioTTM ?? 0).toFixed(2)
        ),
        operatingMargin: parseFloat(
          ((ratios.operatingProfitMarginTTM ?? 0) * 100).toFixed(1)
        ),
        freeCashFlow: parseFloat(
          (
            (ratios.freeCashFlowPerShareTTM ?? 0) *
            (profile.mktCap / profile.price / 1_000_000_000)
          ).toFixed(1)
        ),
        revenueGrowth: parseFloat(
          ((growth?.revenueGrowth ?? 0) * 100).toFixed(1)
        ),
        epsGrowth: parseFloat(
          ((growth?.epsgrowth ?? 0) * 100).toFixed(1)
        ),
        dividendYield: parseFloat(
          ((ratios.dividendYieldTTM ?? 0) * 100).toFixed(2)
        ),
        payoutRatio: Math.round((ratios.payoutRatioTTM ?? 0) * 100),
        history,
      };
    } catch {
      return undefined;
    }
  }

  async getStocks(filters?: StockFilters): Promise<readonly Stock[]> {
    // FMP stock screener endpoint with filters
    const params = new URLSearchParams();
    if (filters?.sector) params.set("sector", filters.sector);
    if (filters?.country) params.set("country", filters.country);
    if (filters?.marketCapMin) {
      params.set(
        "marketCapMoreThan",
        String(filters.marketCapMin * 1_000_000_000)
      );
    }
    if (filters?.marketCapMax) {
      params.set(
        "marketCapLowerThan",
        String(filters.marketCapMax * 1_000_000_000)
      );
    }
    params.set("limit", "50");

    const tickers = await this.fetch<{ symbol: string }[]>(
      `/stock-screener?${params.toString()}`
    );

    const stocks = await Promise.all(
      tickers.slice(0, 50).map((t) => this.buildStock(t.symbol))
    );

    return stocks.filter((s): s is Stock => s !== undefined);
  }

  async getStock(ticker: string): Promise<Stock | undefined> {
    return this.buildStock(ticker.toUpperCase());
  }

  async getSectors(): Promise<readonly string[]> {
    // FMP provides a sector list endpoint
    return [
      "Technology",
      "Healthcare",
      "Financial Services",
      "Consumer Defensive",
      "Consumer Cyclical",
      "Industrials",
      "Energy",
      "Real Estate",
      "Utilities",
      "Communication Services",
      "Basic Materials",
    ];
  }

  async getCountries(): Promise<readonly string[]> {
    return ["US", "GB", "FR", "DE", "NL", "JP", "CH"];
  }
}
