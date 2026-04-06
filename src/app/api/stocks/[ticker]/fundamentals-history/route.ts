import { NextResponse } from "next/server";

import { getSecHistory } from "@/lib/data/sec-history-provider";
import type { FundamentalsHistoryResponse } from "@/lib/types/sec-fundamentals";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> }
): Promise<NextResponse<FundamentalsHistoryResponse>> {
  const { ticker } = await params;
  const data = await getSecHistory(ticker);

  if (data === null) {
    return NextResponse.json({
      available: false,
      data: null,
      message:
        "Historique fondamental indisponible pour cette action. Disponible uniquement pour les entreprises US couvertes par SEC/EDGAR.",
    });
  }

  return NextResponse.json({
    available: true,
    data,
  });
}
