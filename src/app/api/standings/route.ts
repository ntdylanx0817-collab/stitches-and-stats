import { NextResponse } from "next/server";
import { fetchStandings } from "@/lib/standings";
import { errorResponse } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  // Derive the season we request from the clock — a hardcoded one would serve
  // last season's standings indefinitely once the year rolls over.
  const season = new Date().getFullYear();
  try {
    return NextResponse.json(await fetchStandings(season));
  } catch (err) {
    return errorResponse(err);
  }
}
