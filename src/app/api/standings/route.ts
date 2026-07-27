import { NextRequest, NextResponse } from "next/server";
import { getOrSet } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const STATS_API = "https://statsapi.mlb.com/api";

interface TeamStanding {
  id: number;
  abbr: string;
  name: string;
  wins: number;
  losses: number;
  pct: string;
  gamesBack: string;
  wildCardGamesBack: string;
  streak: string;
  divisionRank: string;
  leagueRank: string;
  runsScored: number;
  runsAllowed: number;
  runDifferential: number;
  division: string;
  league: string;
}

interface DivisionStanding {
  division: string;
  teams: TeamStanding[];
}

export async function GET(req: NextRequest) {
  const cacheKey = "standings:2026";
  const data = await getOrSet(cacheKey, 300_000, async () => {
    const season = new Date().getFullYear();
    const url = `${STATS_API}/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team,league,division`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`standings fetch failed: ${res.status}`);
    const sched = await res.json();

    const divisions: DivisionStanding[] = [];
    const allTeams: TeamStanding[] = [];

    for (const record of sched?.records ?? []) {
      const divisionName = record.division?.name ?? "Unknown";
      const teams: TeamStanding[] = [];

      for (const t of record.teamRecords ?? []) {
        const team = t.team ?? {};
        const standing: TeamStanding = {
          id: team.id ?? 0,
          abbr: team.abbreviation ?? "???",
          name: team.name ?? "Unknown",
          wins: t.wins ?? 0,
          losses: t.losses ?? 0,
          pct: t.winningPercentage ?? "0.000",
          gamesBack: t.divisionGamesBack ?? "0.0",
          wildCardGamesBack: t.wildCardGamesBack ?? "0.0",
          streak: t.streak?.streakCode ?? "",
          divisionRank: t.divisionRank ?? "0",
          leagueRank: t.leagueRank ?? "0",
          runsScored: t.runsScored ?? 0,
          runsAllowed: t.runsAllowed ?? 0,
          runDifferential: t.runDifferential ?? 0,
          division: divisionName,
          league: record.league?.name ?? "Unknown",
        };
        teams.push(standing);
        allTeams.push(standing);
      }

      divisions.push({ division: divisionName, teams });
    }

    // Build wild card standings (non-division-leaders sorted by record)
    const wildCardAL = allTeams
      .filter(t => t.league === "American League" && t.divisionRank !== "1")
      .sort((a, b) => parseFloat(a.wildCardGamesBack) - parseFloat(b.wildCardGamesBack));
    const wildCardNL = allTeams
      .filter(t => t.league === "National League" && t.divisionRank !== "1")
      .sort((a, b) => parseFloat(a.wildCardGamesBack) - parseFloat(b.wildCardGamesBack));

    return {
      season,
      divisions,
      wildCard: { AL: wildCardAL, NL: wildCardNL },
      allTeams,
    };
  });

  return NextResponse.json(data);
}
