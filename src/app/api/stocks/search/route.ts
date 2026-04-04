import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data";
import { isValidStrategyId, getStrategy } from "@/lib/strategies";

import "@/lib/scoring/strategies/buffett";
import "@/lib/scoring/strategies/lynch";
import "@/lib/scoring/strategies/growth";
import "@/lib/scoring/strategies/dividend";
import { scoreStock } from "@/lib/scoring/engine";

/**
 * GET /api/stocks/search?q=AAPL&strategy=buffett
 *
 * Recherche une action par ticker et la score.
 * Fonctionne pour N'IMPORTE quel ticker (pas limite a l'univers).
 * Utilise getStock() du provider qui appelle Yahoo directement.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim().toUpperCase();
  const strategyParam = searchParams.get("strategy") ?? "buffett";

  if (!query || query.length < 1) {
    return NextResponse.json(
      { error: "Parameter 'q' is required" },
      { status: 400 }
    );
  }

  if (!isValidStrategyId(strategyParam)) {
    return NextResponse.json(
      { error: `Invalid strategy: ${strategyParam}` },
      { status: 400 }
    );
  }

  const provider = getDataProvider();
  const stock = await provider.getStock(query);

  if (!stock) {
    return NextResponse.json(
      { error: `Action non trouvee : ${query}` },
      { status: 404 }
    );
  }

  const score = scoreStock(stock, strategyParam);
  const strategy = getStrategy(strategyParam);

  return NextResponse.json({
    stock,
    score,
    strategy,
  });
}
