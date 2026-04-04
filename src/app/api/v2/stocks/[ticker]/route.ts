import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data";
import { isValidStrategyId, getStrategy } from "@/lib/strategies";

// Import strategies to register them
import "@/lib/scoring/strategies/buffett";
import "@/lib/scoring/strategies/lynch";
import "@/lib/scoring/strategies/growth";
import "@/lib/scoring/strategies/dividend";

import { scoreStock, scoreStockAllStrategies } from "@/lib/scoring/engine";
import { generateSummary } from "@/lib/scoring/explain";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const searchParams = request.nextUrl.searchParams;
  const strategyParam = searchParams.get("strategy") ?? "buffett";
  const allStrategies = searchParams.get("all") === "true";

  if (!isValidStrategyId(strategyParam)) {
    return NextResponse.json(
      { success: false, data: null, error: `Strategie invalide: ${strategyParam}` },
      { status: 400 }
    );
  }

  try {
    const provider = getDataProvider();
    const stock = await provider.getStock(ticker);

    if (!stock) {
      return NextResponse.json(
        { success: false, data: null, error: `Action non trouvee: ${ticker}` },
        { status: 404 }
      );
    }

    const strategy = getStrategy(strategyParam);
    const score = scoreStock(stock, strategyParam);
    const summary = generateSummary(
      stock,
      score.total,
      score.explanations,
      strategy.name
    );

    const responseData: Record<string, unknown> = {
      stock,
      score,
      strategy,
      summary,
    };

    // Si ?all=true, ajouter les scores de toutes les strategies
    if (allStrategies) {
      responseData.allScores = scoreStockAllStrategies(stock);
    }

    return NextResponse.json({
      success: true,
      data: responseData,
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
