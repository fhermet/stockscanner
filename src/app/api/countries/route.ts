import { NextResponse } from "next/server";
import { getCountries } from "@/lib/indices";

export async function GET() {
  try {
    return NextResponse.json({ countries: getCountries() });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch countries" },
      { status: 500 }
    );
  }
}
