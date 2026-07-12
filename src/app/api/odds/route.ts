import { NextRequest, NextResponse } from "next/server";
import { getOrSet } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 300;

interface TeamStats {
  id: number;
  abbr: string;
  name: string;
  wins: number;
  losses: number;
  runsScored: number;
  runsAllowed: number;
  gamesPlayed: number;
  runsPerGame: number;
  runsAllowedPerGame: number;
  pythagoreanWinPct: number;
}

interface GameOdds {
  gamePk: number;
  awayTeam: string;
  homeTeam: string;
  awayAbbr: string;
  homeAbbr: string;
  awayWinProb: number;
  homeWinProb: number;
  projectedTotal: number;
  awayProjectedRuns: number;
  homeProjectedRuns: number;
  awayMoneyline: number;
  homeMoneyline: number;
  runLine: number;
  insight: string;
}

const STATS_API = "https://statsapi.mlb.com/api";

export async function GET(req: NextRequest) {
  const gamePk = Number(req.nextUrl.searchParams.get("gamePk"));
  const awayTeamId = Number(req.nextUrl.searchParams.get("awayTeamId"));
  const homeTeamId = Number(req.nextUrl.searchParams.get("homeTeamId"));

  if (!awayTeamId || !homeTeamId) {
    return NextResponse.json({ error: "awayTeamId and homeTeamId required" }, { status: 400 });
  }

  const cacheKey = `odds:${awayTeamId}:${homeTeamId}`;
  const data = await getOrSet(cacheKey, 300_000, async () => {
    return await calculateOdds(awayTeamId, homeTeamId, gamePk);
  });

  if (!data) {
    return NextResponse.json({ error: "Odds calculation failed" }, { status: 502 });
  }

  return NextResponse.json(data);
}

async function calculateOdds(awayTeamId: number, homeTeamId: number, gamePk: number): Promise<GameOdds | null> {
  try {
    // Fetch standings data for both teams
    const season = new Date().getFullYear();
    const standingsUrl = `${STATS_API}/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team`;
    const res = await fetch(standingsUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;

    const standings = await res.json();
    const records = standings?.records ?? [];

    let awayStats: TeamStats | null = null;
    let homeStats: TeamStats | null = null;

    for (const rec of records) {
      for (const t of rec.teamRecords ?? []) {
        const teamId = t.team?.id;
        if (teamId === awayTeamId) {
          awayStats = parseTeamStats(t);
        } else if (teamId === homeTeamId) {
          homeStats = parseTeamStats(t);
        }
      }
    }

    if (!awayStats || !homeStats) return null;

    // Calculate projected runs using a simple runs model:
    // Expected runs = (team RPG + opponent RAG) / 2
    // Home team gets a slight boost (~4%)
    const awayProjectedRuns = (awayStats.runsPerGame + homeStats.runsAllowedPerGame) / 2;
    const homeProjectedRuns = ((homeStats.runsPerGame + awayStats.runsAllowedPerGame) / 2) * 1.04; // Home advantage

    const projectedTotal = awayProjectedRuns + homeProjectedRuns;

    // Calculate win probability using Pythagorean expectation + home advantage
    // Adjusted for the specific matchup
    const awayPyth = awayStats.pythagoreanWinPct;
    const homePyth = homeStats.pythagoreanWinPct;

    // Blend Pythagorean with projected runs
    const awayRunAdvantage = awayProjectedRuns / (awayProjectedRuns + homeProjectedRuns);
    const homeRunAdvantage = homeProjectedRuns / (awayProjectedRuns + homeProjectedRuns);

    // Weight: 60% projected runs, 40% Pythagorean
    let awayWinProb = (awayRunAdvantage * 0.6 + awayPyth * 0.4) * 100;
    let homeWinProb = (homeRunAdvantage * 0.6 + homePyth * 0.4) * 100;

    // Normalize
    const total = awayWinProb + homeWinProb;
    awayWinProb = (awayWinProb / total) * 100;
    homeWinProb = (homeWinProb / total) * 100;

    // Convert to American moneyline
    const awayMoneyline = probToMoneyline(awayWinProb / 100);
    const homeMoneyline = probToMoneyline(homeWinProb / 100);

    // Run line: typically -1.5 for the favorite
    const runLine = awayWinProb > homeWinProb ? -1.5 : 1.5;

    // Generate insight
    const favorite = awayWinProb > homeWinProb ? awayStats.abbr : homeStats.abbr;
    const underdog = awayWinProb > homeWinProb ? homeStats.abbr : awayStats.abbr;
    const insight = `${favorite} favored (${Math.max(awayWinProb, homeWinProb).toFixed(0)}% win prob) over ${underdog}. Projected total: ${projectedTotal.toFixed(1)} runs. ${projectedTotal > 9 ? "High-scoring affair expected." : projectedTotal < 7.5 ? "Pitcher's duel expected." : "Average scoring expected."}`;

    return {
      gamePk,
      awayTeam: awayStats.name,
      homeTeam: homeStats.name,
      awayAbbr: awayStats.abbr,
      homeAbbr: homeStats.abbr,
      awayWinProb,
      homeWinProb,
      projectedTotal,
      awayProjectedRuns,
      homeProjectedRuns,
      awayMoneyline,
      homeMoneyline,
      runLine,
      insight,
    };
  } catch (err) {
    console.error("[odds] Error:", err);
    return null;
  }
}

function parseTeamStats(t: any): TeamStats {
  const rs = t.runsScored ?? 0;
  const ra = t.runsAllowed ?? 0;
  const gp = t.gamesPlayed ?? 1;
  const pyth = (rs * rs) / (rs * rs + ra * ra);

  return {
    id: t.team?.id ?? 0,
    abbr: t.team?.abbreviation ?? "???",
    name: t.team?.name ?? "Unknown",
    wins: t.wins ?? 0,
    losses: t.losses ?? 0,
    runsScored: rs,
    runsAllowed: ra,
    gamesPlayed: gp,
    runsPerGame: rs / gp,
    runsAllowedPerGame: ra / gp,
    pythagoreanWinPct: pyth,
  };
}

/** Convert win probability (0-1) to American moneyline odds */
function probToMoneyline(prob: number): number {
  if (prob <= 0 || prob >= 1) return 0;
  if (prob >= 0.5) {
    // Favorite: negative odds
    return -Math.round((prob / (1 - prob)) * 100);
  } else {
    // Underdog: positive odds
    return Math.round(((1 - prob) / prob) * 100);
  }
}
