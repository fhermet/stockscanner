import { NextRequest, NextResponse } from "next/server";
import { getDataProvider, getMeta } from "@/lib/data";
import { YahooDataProvider, MockDataProvider, CachedDataProvider } from "@/lib/data";
import { DataProvider } from "@/lib/data";
import { isValidStrategyId, getStrategy } from "@/lib/strategies";
import { StockFilters } from "@/lib/types";

import "@/lib/scoring/strategies/buffett";
import "@/lib/scoring/strategies/lynch";
import "@/lib/scoring/strategies/growth";
import "@/lib/scoring/strategies/dividend";
import { scoreAndRankStocks } from "@/lib/scoring/engine";
import { UNIVERSE_SIZE } from "@/lib/tickers";
import { getIndexById, isValidIndexId } from "@/lib/indices";

// Singleton cache: one provider per index, persists across requests
const indexProviders = new Map<string, DataProvider>();

function getIndexProvider(indexId: string, tickers: readonly string[]): DataProvider {
  const existing = indexProviders.get(indexId);
  if (existing) return existing;

  const inner = process.env.YAHOO_ENABLED === "true"
    ? new YahooDataProvider([...tickers])
    : new MockDataProvider();

  const provider = new CachedDataProvider(inner);
  indexProviders.set(indexId, provider);
  return provider;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const strategyParam = searchParams.get("strategy") ?? "buffett";

  if (!isValidStrategyId(strategyParam)) {
    return NextResponse.json(
      { error: `Invalid strategy: ${strategyParam}` },
      { status: 400 }
    );
  }

  const isQuick = searchParams.get("quick") === "true";
  const indexParam = searchParams.get("index");

  let provider: DataProvider;
  let indexMeta: { id: string; name: string; theoreticalCount: number } | null = null;

  if (isQuick) {
    provider = new MockDataProvider();
  } else if (indexParam && isValidIndexId(indexParam)) {
    const indexDef = getIndexById(indexParam)!;
    indexMeta = {
      id: indexDef.id,
      name: indexDef.name,
      theoreticalCount: indexDef.theoreticalCount,
    };
    provider = getIndexProvider(indexParam, indexDef.tickers);
  } else {
    provider = getDataProvider();
  }

  const filters: StockFilters = {
    sector: searchParams.get("sector") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    marketCapMin: searchParams.has("marketCapMin")
      ? Number(searchParams.get("marketCapMin"))
      : undefined,
    marketCapMax: searchParams.has("marketCapMax")
      ? Number(searchParams.get("marketCapMax"))
      : undefined,
  };

  const [stocks, sectors, countries] = await Promise.all([
    provider.getStocks(filters),
    provider.getSectors(),
    provider.getCountries(),
  ]);

  const scored = await scoreAndRankStocks(stocks, strategyParam);
  const strategy = getStrategy(strategyParam);
  const meta = getMeta();

  return NextResponse.json({
    stocks: scored,
    strategy,
    filters: { sectors, countries },
    meta,
    universe: {
      total: indexMeta?.theoreticalCount ?? UNIVERSE_SIZE,
      fetched: stocks.length,
      displayed: scored.length,
    },
    index: indexMeta,
    isQuick,
  });
}
