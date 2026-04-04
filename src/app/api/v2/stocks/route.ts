import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data";
import { isValidStrategyId, getStrategy } from "@/lib/strategies";
import { StockFilters } from "@/lib/types";

// Import strategies to register them
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
      { success: false, data: null, error: `Strategie invalide: ${strategyParam}` },
      { status: 400 }
    );
  }

  try {
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
      success: true,
      data: {
        stocks: scored,
        strategy,
        filters: { sectors, countries },
      },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 500 }
    );
  }
}
