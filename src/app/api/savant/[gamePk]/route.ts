import { NextRequest, NextResponse } from "next/server";
import { fetchSavantGameFeed } from "@/lib/mlb-api";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gamePk: string }> }
) {
  const { gamePk: gamePkStr } = await params;
  const gamePk = Number(gamePkStr);
  if (!gamePk) return NextResponse.json({ error: "invalid gamePk" }, { status: 400 });

  try {
    const data = await fetchSavantGameFeed(gamePk);
    // Return only the relevant slices to keep payload manageable
    return NextResponse.json({
      gamePk,
      game_status: data.game_status,
      game_status_code: data.game_status_code,
      scoreboard: data.scoreboard,
      team_home: data.team_home,
      team_away: data.team_away,
      team_home_id: data.team_home_id,
      team_away_id: data.team_away_id,
      exit_velocity: data.exit_velocity ?? [],
      home_runs: data.home_runs ?? [],
      hit_chart: data.hit_chart ?? [],
      players: data.players ?? {},
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
