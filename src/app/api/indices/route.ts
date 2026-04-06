import { NextRequest, NextResponse } from "next/server";
import { getIndicesForCountry, ALL_INDICES } from "@/lib/indices";

export async function GET(request: NextRequest) {
  try {
    const country = request.nextUrl.searchParams.get("country");

    const indices = country
      ? getIndicesForCountry(country)
      : ALL_INDICES;

    return NextResponse.json({
      indices: indices.map((idx) => ({
        id: idx.id,
        name: idx.name,
        shortName: idx.shortName,
        country: idx.country,
        countryCode: idx.countryCode,
        description: idx.description,
        theoreticalCount: idx.theoreticalCount,
        tickerCount: idx.tickers.length,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch indices" },
      { status: 500 }
    );
  }
}
