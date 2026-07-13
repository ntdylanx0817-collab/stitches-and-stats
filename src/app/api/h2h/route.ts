import { NextRequest, NextResponse } from "next/server";
import { getOrSet } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const STATS_API = "https://statsapi.mlb.com/api";

interface H2HGame {
  gamePk: number;
  date: string;
  awayAbbr: string;
  homeAbbr: string;
  awayScore: number;
  homeScore: number;
  winner: "away" | "home";
}

interface H2HData {
  team1Id: number;
  team1Abbr: string;
  team2Id: number;
  team2Abbr: string;
  recentGames: H2HGame[];
  team1Wins: number;
  team2Wins: number;
  team1AvgRuns: number;
  team2AvgRuns: number;
  insight: string;
  preGameWinProb: number; // team1 win probability (0-100)
}

export async function GET(req: NextRequest) {
  const team1Id = Number(req.nextUrl.searchParams.get("team1Id"));
  const team2Id = Number(req.nextUrl.searchParams.get("team2Id"));

  if (!team1Id || !team2Id) {
    return NextResponse.json({ error: "team1Id and team2Id required" }, { status: 400 });
  }

  const cacheKey = `h2h:${team1Id}:${team2Id}`;
  const data = await getOrSet(cacheKey, 300_000, async () => {
    return await fetchH2H(team1Id, team2Id);
  });

  if (!data) {
    return NextResponse.json({ error: "H2H data not available" }, { status: 404 });
  }

  return NextResponse.json(data);
}

async function fetchH2H(team1Id: number, team2Id: number): Promise<H2HData | null> {
  try {
    // Fetch team abbreviations
    const [t1Res, t2Res] = await Promise.all([
      fetch(`${STATS_API}/v1/teams/${team1Id}`, { signal: AbortSignal.timeout(8_000) }),
      fetch(`${STATS_API}/v1/teams/${team2Id}`, { signal: AbortSignal.timeout(8_000) }),
    ]);
    const t1Data = await t1Res.json();
    const t2Data = await t2Res.json();
    const team1Abbr = t1Data?.teams?.[0]?.abbreviation ?? "T1";
    const team2Abbr = t2Data?.teams?.[0]?.abbreviation ?? "T2";

    // Fetch H2H games from current + previous 2 seasons (need 6 games)
    const currentYear = new Date().getFullYear();
    const seasons = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
    const allGames: H2HGame[] = [];

    for (const season of seasons) {
      if (allGames.length >= 6) break;
      try {
        const url = `${STATS_API}/v1/schedule?sportId=1&teamId=${team1Id}&opponentId=${team2Id}&season=${season}&gameType=R&hydrate=team`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
        const sched = await res.json();
        for (const dateEntry of sched?.dates ?? []) {
          for (const g of dateEntry?.games ?? []) {
            if (g.status?.abstractGameState === "Final") {
              const awayTeam = g.teams?.away?.team;
              const homeTeam = g.teams?.home?.team;
              const awayScore = g.teams?.away?.score ?? 0;
              const homeScore = g.teams?.home?.score ?? 0;
              const winner = awayScore > homeScore ? "away" : "home";

              allGames.push({
                gamePk: g.gamePk,
                date: dateEntry.date,
                awayAbbr: awayTeam?.abbreviation ?? "?",
                homeAbbr: homeTeam?.abbreviation ?? "?",
                awayScore,
                homeScore,
                winner,
              });
            }
          }
        }
      } catch {}
    }

    // Sort by date descending and take last 6
    allGames.sort((a, b) => b.date.localeCompare(a.date));
    const recentGames = allGames.slice(0, 6);

    // Calculate win counts and average runs
    let team1Wins = 0;
    let team2Wins = 0;
    let team1Runs = 0;
    let team2Runs = 0;

    for (const g of recentGames) {
      const team1IsAway = g.awayAbbr === team1Abbr;
      const team1Won = (g.winner === "away" && team1IsAway) || (g.winner === "home" && !team1IsAway);
      if (team1Won) {
        team1Wins++;
        team1Runs += team1IsAway ? g.awayScore : g.homeScore;
        team2Runs += team1IsAway ? g.homeScore : g.awayScore;
      } else {
        team2Wins++;
        team1Runs += team1IsAway ? g.awayScore : g.homeScore;
        team2Runs += team1IsAway ? g.homeScore : g.awayScore;
      }
    }

    const team1AvgRuns = recentGames.length > 0 ? team1Runs / recentGames.length : 0;
    const team2AvgRuns = recentGames.length > 0 ? team2Runs / recentGames.length : 0;

    // Calculate pre-game win probability from H2H record
    // Base: 50% + H2H win differential * 5% + run differential * 2%
    const winDiff = team1Wins - team2Wins;
    const runDiff = team1AvgRuns - team2AvgRuns;
    let preGameWinProb = 50 + (winDiff * 5) + (runDiff * 2);

    // Clamp to 20-80%
    preGameWinProb = Math.max(20, Math.min(80, preGameWinProb));

    // Generate insight
    let insight = `Last ${recentGames.length} meetings: ${team1Abbr} ${team1Wins}-${team2Wins} ${team2Abbr}. `;
    insight += `${team1Abbr} avg ${team1AvgRuns.toFixed(1)} runs/g, ${team2Abbr} avg ${team2AvgRuns.toFixed(1)} runs/g. `;
    if (team1Wins > team2Wins) {
      insight += `${team1Abbr} has the edge.`;
    } else if (team2Wins > team1Wins) {
      insight += `${team2Abbr} has the edge.`;
    } else {
      insight += `Even matchup.`;
    }

    return {
      team1Id, team1Abbr, team2Id, team2Abbr,
      recentGames, team1Wins, team2Wins,
      team1AvgRuns, team2AvgRuns,
      insight, preGameWinProb,
    };
  } catch (err) {
    console.error("[h2h] Error:", err);
    return null;
  }
}
