// --- Stock model ---

export interface YearlyData {
  readonly year: number;
  readonly revenue: number; // in millions
  readonly eps: number;
  readonly dividendPerShare: number;
}

export interface Stock {
  readonly ticker: string;
  readonly name: string;
  readonly sector: string;
  readonly country: string;
  readonly exchange: string;
  readonly currency: string; // ISO 4217: USD, EUR, GBP, CHF, etc.
  readonly marketCap: number; // in billions (local currency)
  readonly price: number; // local currency
  readonly per: number | null;
  readonly peg: number | null;
  readonly roic: number | null; // percentage — Return on Invested Capital
  readonly debtToOcf: number | null; // ratio — Total Debt / Operating Cash Flow
  readonly operatingMargin: number | null; // percentage
  readonly freeCashFlow: number | null; // in billions
  readonly revenueGrowth: number | null; // percentage YoY
  readonly epsGrowth: number | null; // percentage YoY
  readonly dividendYield: number | null; // percentage
  readonly payoutRatio: number | null; // percentage
  readonly history: readonly YearlyData[];

  // --- Buffett v2 metrics (optional for backward compat) ---
  readonly netIncome?: number | null; // in billions
  readonly operatingIncome?: number | null; // in billions (≈ EBIT)
  readonly enterpriseValue?: number | null; // in billions
  readonly interestCoverage?: number | null; // EBIT / interest expense
  readonly evToEbit?: number | null; // Enterprise Value / EBIT
  // Historical summary (computed from SEC 5yr history)
  readonly roicStability?: number | null; // std dev of ROIC, percentage points
  readonly revenueCagr5y?: number | null; // CAGR percentage
  readonly roicAvg5y?: number | null; // average ROIC percentage
  readonly fcfPositiveYears?: number; // count of positive FCF years (0-5)
  // 5-year valuation averages for historical comparison
  readonly perAvg5y?: number | null;
  readonly evToEbitAvg5y?: number | null;
  readonly priceToFcfAvg5y?: number | null;
}

// --- Strategy ---

export type StrategyId = "buffett" | "lynch" | "growth" | "dividend";

export interface Strategy {
  readonly id: StrategyId;
  readonly name: string;
  readonly subtitle: string;
  readonly description: string;
  readonly philosophy: string;
  readonly icon: string;
  readonly color: string; // tailwind color class
}

// --- Scoring ---

export interface SubScore {
  readonly name: string;
  readonly value: number | null; // 0-100
  readonly weight: number; // 0-1, sum = 1
  readonly label: string;
}

export interface Explanation {
  readonly text: string;
  readonly type: "positive" | "neutral" | "negative";
  readonly metric?: string;
  readonly value?: string;
}

export interface DataCompleteness {
  readonly score: number; // 0-100, percentage of available metrics
  readonly available: readonly string[]; // names of available metrics
  readonly missing: readonly string[]; // names of missing metrics
}

export type ScoreConfidence = "high" | "medium" | "low";

export interface StrategyScore {
  readonly strategyId: StrategyId;
  readonly total: number | null; // 0-100
  readonly subScores: readonly SubScore[];
  readonly explanations: readonly Explanation[];
  readonly confidence: ScoreConfidence;
  readonly dataCompleteness: DataCompleteness;
}

export interface ScoredStock {
  readonly stock: Stock;
  readonly score: StrategyScore;
}

// --- Filters ---

export interface StockFilters {
  readonly sector?: string;
  readonly country?: string;
  readonly marketCapMin?: number;
  readonly marketCapMax?: number;
}

// --- Data metadata ---

export interface DataMeta {
  readonly source: string; // "yahoo" | "mock" | "cache:yahoo" | "cache:mock"
  readonly fetchedAt: number; // unix timestamp ms
  readonly isFallback: boolean; // true if came from fallback provider
  readonly isCached: boolean;
  readonly cacheAgeMs: number; // 0 if not cached
  readonly isStale: boolean; // true if cache expired but serving stale data
}

// --- API responses ---

export interface StrategiesResponse {
  readonly strategies: readonly Strategy[];
}

export interface StocksResponse {
  readonly stocks: readonly ScoredStock[];
  readonly strategy: Strategy;
  readonly filters: {
    readonly sectors: readonly string[];
    readonly countries: readonly string[];
  };
}

export interface StockDetailResponse {
  readonly stock: Stock;
  readonly score: StrategyScore;
  readonly strategy: Strategy;
}
