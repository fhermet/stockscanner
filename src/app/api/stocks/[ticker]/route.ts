import { NextRequest, NextResponse } from "next/server";
import { getDataProvider, getMeta } from "@/lib/data";
import { isValidStrategyId, getStrategy } from "@/lib/strategies";

import "@/lib/scoring/strategies/buffett";
import "@/lib/scoring/strategies/lynch";
import "@/lib/scoring/strategies/growth";
import "@/lib/scoring/strategies/dividend";
import { scoreStock } from "@/lib/scoring/engine";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const searchParams = request.nextUrl.searchParams;
  const strategyParam = searchParams.get("strategy") ?? "buffett";

  if (!isValidStrategyId(strategyParam)) {
    return NextResponse.json(
      { error: `Invalid strategy: ${strategyParam}` },
      { status: 400 }
    );
  }

  const provider = getDataProvider();
  const stock = await provider.getStock(ticker);

  if (!stock) {
    return NextResponse.json(
      { error: `Stock not found: ${ticker}` },
      { status: 404 }
    );
  }

  const score = scoreStock(stock, strategyParam);
  const strategy = getStrategy(strategyParam);
  const meta = getMeta();

  return NextResponse.json({ stock, score, strategy, meta });
}
