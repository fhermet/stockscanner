import { NextRequest, NextResponse } from "next/server";
import { STOCKS, getAvailableSectors, getAvailableCountries } from "@/lib/mock-data";
import { isValidStrategyId } from "@/lib/strategies";
import { getStrategy } from "@/lib/strategies";
import { scoreAndRankStocks } from "@/lib/scoring";
import { StockFilters, StocksResponse } from "@/lib/types";

export async function GET(
  request: NextRequest
): Promise<NextResponse<StocksResponse | { error: string }>> {
  const searchParams = request.nextUrl.searchParams;
  const strategyParam = searchParams.get("strategy") ?? "buffett";

  if (!isValidStrategyId(strategyParam)) {
    return NextResponse.json(
      { error: `Invalid strategy: ${strategyParam}` },
      { status: 400 }
    );
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

  const stocks = scoreAndRankStocks(STOCKS, strategyParam, filters);
  const strategy = getStrategy(strategyParam);

  return NextResponse.json({
    stocks,
    strategy,
    filters: {
      sectors: getAvailableSectors(),
      countries: getAvailableCountries(),
    },
  });
}
