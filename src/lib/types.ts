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
  readonly marketCap: number; // in billions
  readonly price: number;
  readonly per: number;
  readonly peg: number;
  readonly roe: number; // percentage
  readonly debtToEquity: number; // ratio
  readonly operatingMargin: number; // percentage
  readonly freeCashFlow: number; // in billions
  readonly revenueGrowth: number; // percentage YoY
  readonly epsGrowth: number; // percentage YoY
  readonly dividendYield: number; // percentage
  readonly payoutRatio: number; // percentage
  readonly history: readonly YearlyData[];
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
  readonly value: number; // 0-100
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
  readonly total: number; // 0-100
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
