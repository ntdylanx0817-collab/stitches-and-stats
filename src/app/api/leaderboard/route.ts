import { NextRequest, NextResponse } from "next/server";
import { fetchLeaderboard, computePercentiles } from "@/lib/mlb-api";
import { errorResponse } from "@/lib/api-errors";
import type { LeaderboardRow } from "@/lib/types";
import { enumParam, integerParam, stringParam } from "@/lib/api-params";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = enumParam(sp.get("type"), ["batter", "pitcher"] as const, "batter");
  const requestedYear = integerParam(sp.get("year"), { min: 2008, max: new Date().getFullYear() });
  const min = integerParam(sp.get("min"), { defaultValue: 50, min: 0, max: 1000 });
  const position = stringParam(sp.get("position"), { maxLength: 3, pattern: /^[A-Za-z0-9]*$/ });
  const team = stringParam(sp.get("team"), { maxLength: 40, pattern: /^[A-Za-z0-9 .'-]*$/ });
  const gameType = enumParam(sp.get("gameType"), ["Regular", "Postseason", "Spring Training"] as const, "Regular");
  const playerId = integerParam(sp.get("playerId"), { min: 1 });
  if (type === null || min === null || position === null || team === null || gameType === null || (sp.has("year") && requestedYear === null) || (sp.has("playerId") && playerId === null)) {
    return NextResponse.json({ error: "invalid leaderboard parameters" }, { status: 400 });
  }

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

    let rows: LeaderboardRow[] = [];
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
  } catch (err) {
    return errorResponse(err);
  }
}
