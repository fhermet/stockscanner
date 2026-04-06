import { NextResponse } from "next/server";

import { getSecHistory } from "@/lib/data/sec-history-provider";
import { getYearlyPrices } from "@/lib/data/yahoo-history-provider";
import { mergeHistory } from "@/lib/data/merged-history";
import { isValidTicker } from "@/lib/validation";
import {
  computeFullHistoricalScores,
  type HistoricalScorePoint,
} from "@/lib/scoring/sec-historical-score";

export interface HistoricalScoresResponse {
  readonly available: boolean;
  readonly ticker: string;
  readonly companyName: string;
  readonly points: readonly HistoricalScorePoint[];
  readonly meta: {
    readonly secYears: number;
    readonly priceYears: number;
    readonly source: string;
  };
  readonly message?: string;
}

const EMPTY_RESPONSE = (ticker: string, message: string): HistoricalScoresResponse => ({
  available: false,
  ticker,
  companyName: "",
  points: [],
  meta: { secYears: 0, priceYears: 0, source: "none" },
  message,
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
): Promise<NextResponse<HistoricalScoresResponse>> {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();

  if (!isValidTicker(ticker)) {
    return NextResponse.json(EMPTY_RESPONSE(upperTicker, "Ticker invalide."));
  }

  try {
    const secData = await getSecHistory(upperTicker);

    if (secData === null) {
      return NextResponse.json(
        EMPTY_RESPONSE(
          upperTicker,
          "Historique indisponible pour cette action. Disponible uniquement pour les entreprises US couvertes par SEC/EDGAR.",
        ),
      );
    }

    const yearlyPrices = await getYearlyPrices(upperTicker);
    const merged = mergeHistory(secData, yearlyPrices);
    const points = computeFullHistoricalScores(merged);

    return NextResponse.json({
      available: true,
      ticker: upperTicker,
      companyName: merged.companyName,
      points,
      meta: {
        secYears: merged.secYearsAvailable,
        priceYears: merged.priceYearsAvailable,
        source:
          merged.priceYearsAvailable > 0
            ? "SEC/EDGAR + Yahoo Finance"
            : "SEC/EDGAR uniquement",
      },
    });
  } catch {
    return NextResponse.json(
      EMPTY_RESPONSE(upperTicker, "Erreur lors du calcul des scores historiques."),
    );
  }
}
