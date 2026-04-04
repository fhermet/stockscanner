import { NextResponse } from "next/server";
import { getCountries } from "@/lib/indices";

export async function GET() {
  return NextResponse.json({ countries: getCountries() });
}
