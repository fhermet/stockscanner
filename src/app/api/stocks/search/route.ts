import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data";
import { isValidStrategyId, getStrategy } from "@/lib/strategies";
import { isValidTicker } from "@/lib/validation";

import "@/lib/scoring/strategies/buffett";
import "@/lib/scoring/strategies/lynch";
import "@/lib/scoring/strategies/growth";
import "@/lib/scoring/strategies/dividend";
import { scoreStock } from "@/lib/scoring/engine";

/**
 * GET /api/stocks/search?q=AAPL&strategy=buffett
 *
 * Recherche une action par ticker et la score.
 * Fonctionne pour N'IMPORTE quel ticker (pas limité à l'univers).
 * Utilise getStock() du provider qui appelle Yahoo directement.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim().toUpperCase();
  const strategyParam = searchParams.get("strategy") ?? "buffett";

  if (!query || !isValidTicker(query)) {
    return NextResponse.json(
      { error: "Paramètre 'q' requis (ticker valide, ex: AAPL)" },
      { status: 400 }
    );
  }

  if (!isValidStrategyId(strategyParam)) {
    return NextResponse.json(
      { error: `Invalid strategy: ${strategyParam}` },
      { status: 400 }
    );
  }

  try {
    const provider = getDataProvider();
    const stock = await provider.getStock(query);

    if (!stock) {
      return NextResponse.json(
        { error: `Action non trouvée : ${query}` },
        { status: 404 }
      );
    }

    const score = scoreStock(stock, strategyParam);
    const strategy = getStrategy(strategyParam);

    return NextResponse.json({ stock, score, strategy });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
