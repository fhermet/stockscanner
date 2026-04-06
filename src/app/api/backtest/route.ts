import { NextRequest, NextResponse } from "next/server";
import { isValidStrategyId } from "@/lib/strategies";
import {
  runBacktest,
  getAvailableYears,
  type BacktestResult,
} from "@/lib/backtest/backtest-engine";

export interface BacktestResponse {
  readonly result: BacktestResult | null;
  readonly availableYears: readonly number[];
  readonly error?: string;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<BacktestResponse>> {
  const searchParams = request.nextUrl.searchParams;
  const strategyParam = searchParams.get("strategy") ?? "buffett";
  const startYearParam = searchParams.get("startYear");
  const topNParam = searchParams.get("topN");

  const availableYears = await getAvailableYears();

  if (!isValidStrategyId(strategyParam)) {
    return NextResponse.json({
      result: null,
      availableYears,
      error: `Stratégie invalide : ${strategyParam}`,
    });
  }

  const startYear = startYearParam ? parseInt(startYearParam, 10) : null;
  if (startYear === null || isNaN(startYear)) {
    return NextResponse.json({
      result: null,
      availableYears,
      error: "Paramètre startYear requis.",
    });
  }

  const topN = topNParam ? Math.min(Math.max(parseInt(topNParam, 10) || 5, 3), 10) : 5;

  try {
    const result = await runBacktest(strategyParam, startYear, topN);
    return NextResponse.json({ result, availableYears });
  } catch {
    return NextResponse.json({
      result: null,
      availableYears,
      error: "Erreur lors du calcul du backtest.",
    });
  }
}
