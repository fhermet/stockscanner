import { NextRequest, NextResponse } from "next/server";
import { isValidStrategyId } from "@/lib/strategies";
import {
  runBacktest,
  runRollingBacktest,
  getAvailableYears,
  type BacktestResult,
  type RollingBacktestResult,
} from "@/lib/backtest/backtest-engine";

export interface BacktestResponse {
  readonly result: BacktestResult | null;
  readonly rollingResult?: RollingBacktestResult | null;
  readonly availableYears: readonly number[];
  readonly error?: string;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<BacktestResponse>> {
  const searchParams = request.nextUrl.searchParams;
  const strategyParam = searchParams.get("strategy") ?? "buffett";
  const topNParam = searchParams.get("topN");
  const mode = searchParams.get("mode"); // "rolling" or null (single-year)

  const availableYears = await getAvailableYears();

  if (!isValidStrategyId(strategyParam)) {
    return NextResponse.json({
      result: null,
      availableYears,
      error: `Stratégie invalide : ${strategyParam}`,
    });
  }

  const topN = topNParam ? Math.min(Math.max(parseInt(topNParam, 10) || 5, 3), 10) : 5;

  // --- Rolling mode: annual rebalancing over full available range ---
  if (mode === "rolling") {
    try {
      const rollingResult = await runRollingBacktest(strategyParam, topN);
      return NextResponse.json({ result: null, rollingResult, availableYears });
    } catch {
      return NextResponse.json({
        result: null,
        rollingResult: null,
        availableYears,
        error: "Erreur lors du calcul du backtest rolling.",
      });
    }
  }

  // --- Single-year mode (existing behavior) ---
  const startYearParam = searchParams.get("startYear");
  const startYear = startYearParam ? parseInt(startYearParam, 10) : null;
  if (startYear === null || isNaN(startYear)) {
    return NextResponse.json({
      result: null,
      availableYears,
      error: "Paramètre startYear requis.",
    });
  }

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
