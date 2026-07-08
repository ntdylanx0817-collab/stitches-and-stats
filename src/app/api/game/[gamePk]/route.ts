import { NextRequest, NextResponse } from "next/server";
import { fetchEnrichedPitches } from "@/lib/mlb-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gamePk: string }> }
) {
  const { gamePk: gamePkStr } = await params;
  const gamePk = Number(gamePkStr);
  if (!gamePk) return NextResponse.json({ error: "invalid gamePk" }, { status: 400 });

  try {
    const data = await fetchEnrichedPitches(gamePk);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
