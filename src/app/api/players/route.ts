import { NextRequest, NextResponse } from "next/server";
import { searchPlayers } from "@/lib/mlb-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json({ players: [] });
  try {
    const players = await searchPlayers(q, 12);
    return NextResponse.json({
      players: players.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        primaryNumber: p.primaryNumber,
        primaryPosition: p.primaryPosition?.abbreviation,
        currentTeam: p.currentTeam?.name,
        batSide: p.batSide?.code,
        pitchHand: p.pitchHand?.code,
        currentAge: p.currentAge,
        height: p.height,
        weight: p.weight,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
