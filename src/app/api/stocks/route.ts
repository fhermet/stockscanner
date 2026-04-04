import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data";
import { isValidStrategyId, getStrategy } from "@/lib/strategies";
import { StockFilters } from "@/lib/types";

import "@/lib/scoring/strategies/buffett";
import "@/lib/scoring/strategies/lynch";
import "@/lib/scoring/strategies/growth";
import "@/lib/scoring/strategies/dividend";
import { scoreAndRankStocks } from "@/lib/scoring/engine";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const strategyParam = searchParams.get("strategy") ?? "buffett";

  if (!isValidStrategyId(strategyParam)) {
    return NextResponse.json(
      { error: `Invalid strategy: ${strategyParam}` },
      { status: 400 }
    );
  }

  const provider = getDataProvider();

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

  return NextResponse.json({
    stocks: scored,
    strategy,
    filters: { sectors, countries },
  });
}
