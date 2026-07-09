import { NextRequest, NextResponse } from "next/server";
import { fetchLeaderboard, computePercentiles } from "@/lib/mlb-api";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = (sp.get("type") as "batter" | "pitcher") ?? "batter";
  const requestedYear = sp.get("year") ? Number(sp.get("year")) : null;
  const min = sp.get("min") ? Number(sp.get("min")) : 50;
  const position = sp.get("position") ?? "";
  const team = sp.get("team") ?? "";
  const gameType = sp.get("gameType") ?? "Regular";
  const playerId = sp.get("playerId") ? Number(sp.get("playerId")) : null;

  try {
    // Determine the year to use — prefer the current ongoing MLB season.
    // MLB regular season runs ~April–October. During the season, use the current
    // year. Offseason (Nov–Mar), use the most recent completed season.
    const now = new Date();
    const month = now.getMonth(); // 0 = Jan, 6 = July
    const currentYear = now.getFullYear();
    const inSeason = month >= 2 && month <= 10; // March–November
    const fallbackYear = inSeason ? currentYear : currentYear - 1;
    const yearsToTry = requestedYear
      ? [requestedYear]
      : [fallbackYear, fallbackYear - 1, fallbackYear - 2];

    let rows: any[] = [];
    let year = yearsToTry[0];
    for (const y of yearsToTry) {
      const r = await fetchLeaderboard({ type, year: y, min, position, team, gameType });
      if (r.length > 0) {
        rows = r;
        year = y;
        break;
      }
    }

    // If a playerId is provided, also return that player's percentile rankings
    if (playerId) {
      const player = rows.find((r) => r.player_id === playerId);
      if (player) {
        const percentiles = computePercentiles(player, rows, type);
        return NextResponse.json({
          total: rows.length,
          year,
          type,
          player,
          percentiles,
          rows,
        });
      } else {
        return NextResponse.json({
          total: rows.length,
          year,
          type,
          player: null,
          percentiles: [],
          rows,
        });
      }
    }

    return NextResponse.json({
      total: rows.length,
      year,
      type,
      rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
