import YahooFinance from "yahoo-finance2";
import { Stock, StockFilters } from "../types";
import { DataProvider } from "./provider";
import { createLogger } from "../logger";
import { ALL_TICKERS } from "../tickers";
import { getSecHistory, preloadSecData } from "./sec-history-provider";
import { getYearlyPrices } from "./yahoo-history-provider";
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

/**
 * Compute historical ROIC values (percentage) from SEC annuals.
 * Uses last 5 years. ROIC = net_income / (equity + debt).
 */
function computeHistoricalRoics(annuals: readonly SecAnnual[]): number[] {
  const recent = annuals.slice(-5);
  const values: number[] = [];
  for (const a of recent) {
    const ni = a.fundamentals.net_income;
    const eq = a.fundamentals.shareholders_equity ?? 0;
    const debt = a.fundamentals.total_debt ?? 0;
    const ic = eq + debt;
    if (ni !== null && ic > 0) {
      values.push((ni / ic) * 100);
    }
  }
  return values;
}

/**
 * Compute 5-year average valuation multiples from SEC annuals + yearly prices.
 * Returns averages of PER, EV/EBIT, and Price/FCF over available years (min 2).
 */
interface ValuationAvg5y {
  perAvg5y: number | null;
  evToEbitAvg5y: number | null;
  priceToFcfAvg5y: number | null;
}

function computeValuationAverages(
  annuals: readonly SecAnnual[],
  yearlyPrices: ReadonlyMap<number, number>,
): ValuationAvg5y {
  const recent = annuals.slice(-5);
  const perValues: number[] = [];
  const evEbitValues: number[] = [];
  const pFcfValues: number[] = [];

  for (const a of recent) {
    const price = yearlyPrices.get(a.fiscal_year);
    if (price === undefined || price <= 0) continue;

    const f = a.fundamentals;
    const shares = f.shares_outstanding;
    if (shares === null || shares <= 0) continue;
    const mktCap = price * shares;

    // PER
    if (f.eps_diluted !== null && f.eps_diluted > 0) {
      perValues.push(price / f.eps_diluted);
    }

    // EV/EBIT — simplified EV = marketCap + totalDebt
    if (f.operating_income !== null && f.operating_income > 0) {
      const ev = mktCap + (f.total_debt ?? 0);
      evEbitValues.push(ev / f.operating_income);
    }

    // Price/FCF
    const fcf = a.ratios.free_cash_flow;
    if (fcf !== null && fcf > 0) {
      pFcfValues.push(mktCap / fcf);
    }
  }

  const avg = (arr: number[]): number | null =>
    arr.length >= 2 ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;

  return {
    perAvg5y: avg(perValues),
    evToEbitAvg5y: avg(evEbitValues),
    priceToFcfAvg5y: avg(pFcfValues),
  };
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
    let per = perYahoo !== null ? parseFloat(perYahoo.toFixed(1)) : null;

    const rawSector: string = profile?.sector ?? "";
    const rawIndustry: string = profile?.industry ?? "";
    const rawCountry: string = profile?.country ?? "";

    // --- SEC: primary source for all fundamental metrics ---
    let history: Stock["history"] = [];
    const secData = await getSecHistory(ticker);

    // Start with null for all fundamentals — SEC fills them, Yahoo is last resort
    let roic: number | null = null;
    let debtToOcf: number | null = null;
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

      if (r.operating_margin !== null) {
        operatingMargin = parseFloat((r.operating_margin * 100).toFixed(1));
      }
      if (r.free_cash_flow !== null) {
        freeCashFlow = parseFloat((r.free_cash_flow / 1_000_000_000).toFixed(1));
      }
      // ROIC = Net Income / Invested Capital (equity + debt)
      // Works even when equity is negative (MCD, SBUX, HD)
      if (f.net_income !== null) {
        const equity = f.shareholders_equity ?? 0;
        const debt = f.total_debt ?? 0;
        const investedCapital = equity + debt;
        if (investedCapital > 0) {
          roic = parseFloat(((f.net_income / investedCapital) * 100).toFixed(1));
        }
      }
      // Debt/OCF = years of operating cash flow to repay all debt
      if (f.total_debt !== null && f.operating_cash_flow !== null && f.operating_cash_flow > 0) {
        debtToOcf = parseFloat((f.total_debt / f.operating_cash_flow).toFixed(1));
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
        per = parseFloat((currentPrice / f.eps_diluted).toFixed(1));
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
    // When SEC data exists, don't override with Yahoo — SEC nulls are intentional.
    const hasSec = secData !== null && secData.annuals.length > 0;
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

    // --- Yahoo shares fallback for PER ---
    // Some companies (V, BRK-B, ERIE) don't tag EPS or shares in XBRL.
    // When SEC has net_income but no eps_diluted, use Yahoo's sharesOutstanding
    // to compute EPS and PER.
    if (per === null && currentPrice > 0 && hasSec) {
      const latestFund = secData!.annuals[secData!.annuals.length - 1].fundamentals;
      if (latestFund.net_income !== null && latestFund.net_income > 0 && latestFund.eps_diluted === null) {
        const yahooShares = nullableNum(stats?.sharesOutstanding);
        if (yahooShares !== null && yahooShares > 0) {
          const computedEps = latestFund.net_income / yahooShares;
          if (computedEps > 0) {
            per = parseFloat((currentPrice / computedEps).toFixed(1));
          }
        }
      }
    }

    // PEG = PER / eps_growth (always computed, never from Yahoo)
    let peg: number | null = null;
    if (per !== null && epsGrowth !== null && epsGrowth > 0) {
      peg = parseFloat((per / epsGrowth).toFixed(2));
    }

    // --- Buffett v2 metrics (from SEC + Yahoo) ---
    let netIncome: number | null = null;
    let operatingIncome: number | null = null;
    let enterpriseValue: number | null = null;
    let interestCoverage: number | null = null;
    let evToEbit: number | null = null;
    let roicStability: number | null = null;
    let revenueCagr5y: number | null = null;
    let roicAvg5y: number | null = null;
    let fcfPositiveYears: number | undefined = undefined;

    if (secData && secData.annuals.length > 0) {
      const latest = secData.annuals[secData.annuals.length - 1];

      // Net income (in billions)
      if (latest.fundamentals.net_income !== null) {
        netIncome = parseFloat((latest.fundamentals.net_income / 1_000_000_000).toFixed(2));
      }

      // Operating income / EBIT (in billions)
      if (latest.fundamentals.operating_income !== null) {
        operatingIncome = parseFloat((latest.fundamentals.operating_income / 1_000_000_000).toFixed(2));
      }

      // Enterprise Value from Yahoo (in billions)
      const evRaw = nullableNum(stats?.enterpriseValue);
      if (evRaw !== null && evRaw > 0) {
        enterpriseValue = parseFloat((evRaw / 1_000_000_000).toFixed(1));
      }

      // Interest Coverage: EBIT / interest_expense
      if (
        latest.fundamentals.operating_income !== null &&
        latest.fundamentals.interest_expense !== null &&
        latest.fundamentals.interest_expense > 0
      ) {
        interestCoverage = parseFloat(
          (latest.fundamentals.operating_income / latest.fundamentals.interest_expense).toFixed(1),
        );
      } else if (
        latest.fundamentals.operating_income !== null &&
        latest.fundamentals.operating_income > 0 &&
        (latest.fundamentals.interest_expense === null || latest.fundamentals.interest_expense === 0)
      ) {
        // No interest expense with positive EBIT → effectively no debt cost → max score
        interestCoverage = 999;
      }

      // EV/EBIT: Enterprise Value / Operating Income
      if (enterpriseValue !== null && operatingIncome !== null && operatingIncome > 0) {
        evToEbit = parseFloat((enterpriseValue / operatingIncome).toFixed(1));
      }

      // Historical ROIC stability (std dev over available years, min 3)
      const roicValues = computeHistoricalRoics(secData.annuals);
      if (roicValues.length >= 3) {
        const mean = roicValues.reduce((a, b) => a + b, 0) / roicValues.length;
        const variance = roicValues.reduce((a, v) => a + (v - mean) ** 2, 0) / roicValues.length;
        roicStability = parseFloat(Math.sqrt(variance).toFixed(1));
        roicAvg5y = parseFloat(mean.toFixed(1));
      }

      // Revenue CAGR 5yr
      const annuals = secData.annuals;
      if (annuals.length >= 2) {
        const recent = annuals.slice(-5);
        const first = recent[0].fundamentals.revenue;
        const last = recent[recent.length - 1].fundamentals.revenue;
        if (first !== null && first > 0 && last !== null && last > 0) {
          const years = recent.length - 1;
          const cagr = (Math.pow(last / first, 1 / years) - 1) * 100;
          revenueCagr5y = parseFloat(cagr.toFixed(1));
        }
      }

      // FCF positive years (count over last 5 years)
      const recentAnnuals = annuals.slice(-5);
      fcfPositiveYears = recentAnnuals.filter(
        (a) => a.ratios.free_cash_flow !== null && a.ratios.free_cash_flow > 0,
      ).length;
    }

    // --- 5-year valuation averages (SEC fundamentals + Yahoo historical prices) ---
    let perAvg5y: number | null = null;
    let evToEbitAvg5y: number | null = null;
    let priceToFcfAvg5y: number | null = null;

    if (secData && secData.annuals.length >= 2) {
      const yearlyPrices = await getYearlyPrices(ticker);
      if (yearlyPrices.length > 0) {
        const priceByYear = new Map<number, number>();
        for (const yp of yearlyPrices) {
          priceByYear.set(yp.year, yp.close);
        }
        const avgs = computeValuationAverages(secData.annuals, priceByYear);
        perAvg5y = avgs.perAvg5y;
        evToEbitAvg5y = avgs.evToEbitAvg5y;
        priceToFcfAvg5y = avgs.priceToFcfAvg5y;
      }
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
      roic,
      debtToOcf,
      operatingMargin,
      freeCashFlow,
      revenueGrowth,
      epsGrowth,
      dividendYield,
      payoutRatio,
      history,
      // Buffett v2
      netIncome,
      operatingIncome,
      enterpriseValue,
      interestCoverage,
      evToEbit,
      roicStability,
      revenueCagr5y,
      roicAvg5y,
      fcfPositiveYears,
      perAvg5y,
      evToEbitAvg5y,
      priceToFcfAvg5y,
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
  const parallelGroups = 10;
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
