import { NextResponse } from "next/server";
import { STRATEGIES } from "@/lib/strategies";
import { StrategiesResponse } from "@/lib/types";

export async function GET(): Promise<NextResponse<StrategiesResponse>> {
  return NextResponse.json({ strategies: STRATEGIES });
}
