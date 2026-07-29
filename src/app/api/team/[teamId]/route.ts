import { NextRequest, NextResponse } from "next/server";
import { getOrSet } from "@/lib/cache";
import { assertOk, errorResponse } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const STATS_API = "https://statsapi.mlb.com/api";

interface TeamGameResult {
  date: string;
  opponent: string;
  opponentName: string;
  myScore: number;
  oppScore: number;
  won: boolean;
  isHome: boolean;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId: teamIdStr } = await params;
  const teamId = Number(teamIdStr);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return NextResponse.json({ error: "invalid teamId", status: 400 }, { status: 400 });
  }

  const season = new Date().getFullYear();
  const cacheKey = `team:${teamId}:${season}`;
  try {
    const data = await getOrSet(cacheKey, 300_000, async () => {
      // Fetch team info + roster + last 10 games
      const [teamRes, rosterRes] = await Promise.all([
        fetch(`${STATS_API}/v1/teams/${teamId}?hydrate=league,division,sport`, { signal: AbortSignal.timeout(8_000) }),
        fetch(`${STATS_API}/v1/teams/${teamId}/roster?season=${season}`, { signal: AbortSignal.timeout(8_000) }),
      ]);

      // An error page from the upstream is HTML, so `.json()` would throw an
      // opaque parse error — check status first and fail with a useful message.
      await assertOk(teamRes, "team");
      await assertOk(rosterRes, "roster");

      const teamData = await teamRes.json();
      const rosterData = await rosterRes.json();
      const team = teamData?.teams?.[0] ?? {};

      // Fetch last 10 game results
      const schedRes = await fetch(
        `${STATS_API}/v1/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R&hydrate=team,linescore&limit=10`,
        { signal: AbortSignal.timeout(8_000) }
      );
      await assertOk(schedRes, "team schedule");
      const sched = await schedRes.json();
      const allGames: TeamGameResult[] = [];
      for (const dateEntry of sched?.dates ?? []) {
        for (const g of dateEntry?.games ?? []) {
          if (g.status?.abstractGameState === "Final") {
            const isHome = g.teams?.home?.team?.id === teamId;
            const opp = isHome ? g.teams?.away : g.teams?.home;
            const myScore = isHome ? g.teams?.home?.score : g.teams?.away?.score;
            const oppScore = isHome ? g.teams?.away?.score : g.teams?.home?.score;
            allGames.push({
              date: dateEntry.date,
              opponent: opp?.team?.abbreviation ?? "?",
              opponentName: opp?.team?.name ?? "?",
              myScore: myScore ?? 0,
              oppScore: oppScore ?? 0,
              won: (myScore ?? 0) > (oppScore ?? 0),
              isHome,
            });
          }
        }
      }
      const last10 = allGames.slice(-10).reverse();
      const wins10 = last10.filter((g) => g.won).length;
      const losses10 = last10.length - wins10;

      // Build roster
      const roster = (rosterData?.roster ?? []).map((p: any) => ({
        id: p.person?.id ?? 0,
        name: p.person?.fullName ?? "Unknown",
        position: p.position?.abbreviation ?? "?",
        status: p.status?.code ?? "A",
        number: p.jerseyNumber ?? "",
      }));

      return {
        team: {
          id: team.id,
          name: team.name,
          abbreviation: team.abbreviation,
          locationName: team.locationName,
          teamName: team.teamName,
          league: team.league?.name,
          division: team.division?.name,
          firstYearOfPlay: team.firstYearOfPlay,
        },
        roster,
        last10,
        last10Record: `${wins10}-${losses10}`,
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
