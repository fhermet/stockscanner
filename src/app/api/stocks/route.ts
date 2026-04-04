import { NextRequest, NextResponse } from "next/server";
import { getDataProvider, getMeta } from "@/lib/data";
import { YahooDataProvider, MockDataProvider, CachedDataProvider } from "@/lib/data";
import { isValidStrategyId, getStrategy } from "@/lib/strategies";
import { StockFilters } from "@/lib/types";

import "@/lib/scoring/strategies/buffett";
import "@/lib/scoring/strategies/lynch";
import "@/lib/scoring/strategies/growth";
import "@/lib/scoring/strategies/dividend";
import { scoreAndRankStocks } from "@/lib/scoring/engine";
import { UNIVERSE_SIZE } from "@/lib/tickers";
import { getIndexById, isValidIndexId } from "@/lib/indices";

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

  // Determine provider and ticker scope
  let provider;
  let indexMeta: { id: string; name: string; theoreticalCount: number } | null = null;

  if (isQuick) {
    provider = new MockDataProvider();
  } else if (indexParam && isValidIndexId(indexParam)) {
    // Index-scoped: create a Yahoo provider with only the index tickers
    const indexDef = getIndexById(indexParam)!;
    indexMeta = {
      id: indexDef.id,
      name: indexDef.name,
      theoreticalCount: indexDef.theoreticalCount,
    };

    if (process.env.YAHOO_ENABLED === "true") {
      provider = new CachedDataProvider(
        new YahooDataProvider([...indexDef.tickers])
      );
    } else {
      provider = new MockDataProvider();
    }
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
