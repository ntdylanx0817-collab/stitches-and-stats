import { NextRequest, NextResponse } from "next/server";
import { fetchPlayer, fetchLeaderboard, computePercentiles } from "@/lib/mlb-api";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId: playerIdStr } = await params;
  const playerId = Number(playerIdStr);
  if (!playerId) return NextResponse.json({ error: "invalid playerId" }, { status: 400 });

  const type = (req.nextUrl.searchParams.get("type") as "batter" | "pitcher") ?? "batter";
  const requestedYear = req.nextUrl.searchParams.get("year")
    ? Number(req.nextUrl.searchParams.get("year"))
    : null;

  try {
    const player = await fetchPlayer(playerId);
    if (!player) return NextResponse.json({ error: "player not found" }, { status: 404 });

    // Find the latest year with leaderboard data for this player.
    // Prefer the current ongoing MLB season, then fall back to prior years.
    const now = new Date();
    const month = now.getMonth();
    const currentYear = now.getFullYear();
    const inSeason = month >= 2 && month <= 10; // March–November
    const fallbackYear = inSeason ? currentYear : currentYear - 1;
    const yearsToTry = requestedYear
      ? [requestedYear]
      : [fallbackYear, fallbackYear - 1, fallbackYear - 2, fallbackYear - 3];

    let playerRow: any = null;
    let leaderboard: any[] = [];
    let year = yearsToTry[0];
    for (const y of yearsToTry) {
      const lb = await fetchLeaderboard({ type, year: y, min: 1 });
      const found = lb.find((r) => r.player_id === playerId);
      if (found) {
        playerRow = found;
        leaderboard = lb;
        year = y;
        break;
      }
    }

    // Refilter leaderboard to qualified players for percentile computation
    const qualified = leaderboard.filter((r) => (Number(r.pa) || Number(r.p_pa) || 0) >= 50);
    const percentiles = playerRow
      ? computePercentiles(playerRow, qualified.length > 0 ? qualified : leaderboard, type)
      : [];

    return NextResponse.json({
      player: {
        id: player.id,
        fullName: player.fullName,
        primaryNumber: player.primaryNumber,
        birthDate: player.birthDate,
        currentAge: player.currentAge,
        height: player.height,
        weight: player.weight,
        birthCity: player.birthCity,
        birthCountry: player.birthCountry,
        primaryPosition: player.primaryPosition,
        batSide: player.batSide,
        pitchHand: player.pitchHand,
        currentTeam: player.currentTeam,
      },
      stats: playerRow ?? null,
      percentiles,
      type,
      year,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
