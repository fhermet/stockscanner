import { NextRequest, NextResponse } from "next/server";
import { getStockByTicker } from "@/lib/mock-data";
import { isValidStrategyId, getStrategy } from "@/lib/strategies";
import { scoreStock } from "@/lib/scoring";
import { StockDetailResponse } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
): Promise<NextResponse<StockDetailResponse | { error: string }>> {
  const { ticker } = await params;
  const searchParams = request.nextUrl.searchParams;
  const strategyParam = searchParams.get("strategy") ?? "buffett";

  if (!isValidStrategyId(strategyParam)) {
    return NextResponse.json(
      { error: `Invalid strategy: ${strategyParam}` },
      { status: 400 }
    );
  }

  const stock = getStockByTicker(ticker);

  if (!stock) {
    return NextResponse.json(
      { error: `Stock not found: ${ticker}` },
      { status: 404 }
    );
  }

  const score = scoreStock(stock, strategyParam);
  const strategy = getStrategy(strategyParam);

  return NextResponse.json({ stock, score, strategy });
}
