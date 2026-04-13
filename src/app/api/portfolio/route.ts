import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data";
import { CachedDataProvider, YahooDataProvider, MockDataProvider } from "@/lib/data";
import type { DataProvider } from "@/lib/data/provider";
import type { StockFilters } from "@/lib/types";

import "@/lib/scoring/strategies/buffett";
import "@/lib/scoring/strategies/lynch";
import "@/lib/scoring/strategies/growth";
import "@/lib/scoring/strategies/dividend";
import { scoreAndRankStocks } from "@/lib/scoring/engine";
import { isValidStrategyId } from "@/lib/strategies";
import { getIndexById, isValidIndexId } from "@/lib/indices";
import {
  buildPortfolio,
  checkRebalanceTriggers,
  type PortfolioConfig,
  type PortfolioResult,
  type RebalanceTrigger,
  DEFAULT_PORTFOLIO_CONFIG,
} from "@/lib/scoring/portfolio";

export interface PortfolioResponse {
  readonly portfolio: PortfolioResult;
  readonly triggers: readonly RebalanceTrigger[];
  readonly config: PortfolioConfig;
  readonly error?: string;
}

// Singleton providers per index (shared with /api/stocks)
const indexProviders = new Map<string, CachedDataProvider>();

function getIndexProvider(indexId: string, tickers: readonly string[]): CachedDataProvider {
  const existing = indexProviders.get(indexId);
  if (existing) return existing;
  const inner = process.env.YAHOO_ENABLED === "true"
    ? new YahooDataProvider([...tickers])
    : new MockDataProvider();
  const provider = new CachedDataProvider(inner);
  indexProviders.set(indexId, provider);
  return provider;
}

/**
 * GET /api/portfolio?strategy=buffett&index=sp500
 *
 * Optional query params:
 *   - strategy: scoring strategy (default: buffett)
 *   - index: index universe (default: all)
 *   - minScore: minimum score threshold (default: 40)
 *   - topFraction: fraction of top scores to select (default: 0.20)
 *   - maxPosition: max weight per position (default: 0.10)
 *   - maxSector: max weight per sector (default: 0.35)
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<PortfolioResponse>> {
  const params = request.nextUrl.searchParams;
  const strategyParam = params.get("strategy") ?? "buffett";

  if (!isValidStrategyId(strategyParam)) {
    return NextResponse.json({
      portfolio: emptyPortfolio(),
      triggers: [],
      config: DEFAULT_PORTFOLIO_CONFIG,
      error: `Strategie invalide : ${strategyParam}`,
    });
  }

  // Resolve data provider
  let provider: DataProvider;
  const indexParam = params.get("index");
  if (indexParam && isValidIndexId(indexParam)) {
    const indexDef = getIndexById(indexParam)!;
    provider = getIndexProvider(indexParam, indexDef.tickers);
  } else {
    provider = getDataProvider();
  }

  // Parse config overrides
  const config: PortfolioConfig = {
    topFraction: parseFloat(params.get("topFraction") ?? "") || DEFAULT_PORTFOLIO_CONFIG.topFraction,
    minScore: parseInt(params.get("minScore") ?? "", 10) || DEFAULT_PORTFOLIO_CONFIG.minScore,
    minSectors: DEFAULT_PORTFOLIO_CONFIG.minSectors,
    maxPositionWeight: parseFloat(params.get("maxPosition") ?? "") || DEFAULT_PORTFOLIO_CONFIG.maxPositionWeight,
    maxSectorWeight: parseFloat(params.get("maxSector") ?? "") || DEFAULT_PORTFOLIO_CONFIG.maxSectorWeight,
    fullAllocationCount: DEFAULT_PORTFOLIO_CONFIG.fullAllocationCount,
  };

  try {
    const filters: StockFilters = {};
    const stocks = await provider.getStocks(filters);
    const scored = await scoreAndRankStocks(stocks, strategyParam);

    const portfolio = buildPortfolio(scored, config);
    const triggers = checkRebalanceTriggers(scored, portfolio.positions);

    return NextResponse.json({ portfolio, triggers, config });
  } catch {
    return NextResponse.json({
      portfolio: emptyPortfolio(),
      triggers: [],
      config,
      error: "Erreur lors de la construction du portefeuille.",
    });
  }
}

function emptyPortfolio(): PortfolioResult {
  return {
    positions: [],
    cashWeight: 1,
    sectorWeights: {},
    totalPositions: 0,
    warnings: [],
  };
}
