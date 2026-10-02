import { NextRequest, NextResponse } from "next/server";
import { assertOk, errorResponse } from "@/lib/api-errors";
import { integerParam } from "@/lib/api-params";
import { getOrSet } from "@/lib/cache";
import { fetchStandings, type TeamStanding } from "@/lib/standings";
import {
  POSTSEASON_ROUNDS,
  buildSeriesScenario,
  predictPostseasonGame,
  roundFor,
  seriesWinProbability,
  type PostseasonGame,
  type PostseasonPayload,
  type PostseasonPitcher,
  type PostseasonRoundCode,
  type PostseasonSeries,
  type SeriesProjection,
  type PostseasonTeam,
} from "@/lib/postseason";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const STATS_API = "https://statsapi.mlb.com/api";
const POSTSEASON_TYPES = new Set<PostseasonRoundCode>(["F", "D", "L", "W"]);

interface RawTeamSide {
  team?: { id?: number; name?: string; abbreviation?: string };
  leagueRecord?: { wins?: number; losses?: number; pct?: string };
  score?: number;
  isWinner?: boolean;
  probablePitcher?: { id?: number; fullName?: string };
}

interface RawGame {
  gamePk?: number;
  gameDate?: string;
  officialDate?: string;
  gameType?: string;
  gameNumber?: number;
  gamesInSeries?: number;
  seriesDescription?: string;
  seriesStatus?: { seriesNumber?: number };
  status?: { abstractGameState?: string; detailedState?: string; statusCode?: string };
  venue?: { name?: string };
  teams?: { away?: RawTeamSide; home?: RawTeamSide };
}

function numeric(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function teamFrom(side: RawTeamSide, standings: Map<number, TeamStanding>): PostseasonTeam {
  const id = side.team?.id ?? 0;
  const standing = standings.get(id);
  const wins = standing?.wins ?? side.leagueRecord?.wins ?? 0;
  const losses = standing?.losses ?? side.leagueRecord?.losses ?? 0;
  return {
    id,
    name: standing?.name ?? side.team?.name ?? "TBD",
    abbreviation: standing?.abbr ?? side.team?.abbreviation ?? "TBD",
    wins,
    losses,
    pct: numeric(standing?.pct ?? side.leagueRecord?.pct) ?? (wins + losses > 0 ? wins / (wins + losses) : 0.5),
    runDifferential: standing?.runDifferential ?? 0,
    league: standing?.league ?? "MLB",
  };
}

async function fetchPitcherStats(id: number, name: string, season: number): Promise<PostseasonPitcher> {
  return getOrSet(`postseason-pitcher:${id}:${season}`, 6 * 60 * 60_000, async () => {
    const params = new URLSearchParams({ stats: "season", group: "pitching", season: String(season) });
    const res = await fetch(`${STATS_API}/v1/people/${id}/stats?${params}`, {
      signal: AbortSignal.timeout(8_000),
    });
    await assertOk(res, "probable pitcher stats");
    const data = await res.json();
    const stat = data?.stats?.[0]?.splits?.[0]?.stat ?? {};
    return {
      id,
      name,
      era: numeric(stat.era),
      whip: numeric(stat.whip),
      strikeoutsPer9: numeric(stat.strikeoutsPer9Inn),
      inningsPitched: stat.inningsPitched ? String(stat.inningsPitched) : null,
    };
  });
}

export async function GET(req: NextRequest) {
  const currentYear = new Date().getFullYear();
  const rawSeason = req.nextUrl.searchParams.get("season");
  const season = rawSeason === null
    ? currentYear
    : integerParam(rawSeason, { min: 1876, max: currentYear + 1 });

  if (season === null) {
    return NextResponse.json({ error: "season must be a valid MLB season" }, { status: 400 });
  }

  try {
    const data = await getOrSet(`postseason:${season}`, 60_000, async (): Promise<PostseasonPayload> => {
      const scheduleParams = new URLSearchParams({
        sportId: "1",
        season: String(season),
        gameTypes: "F,D,L,W",
        startDate: `${season}-09-20`,
        endDate: `${season}-11-15`,
        hydrate: "team,probablePitcher,linescore,seriesStatus",
      });

      const [scheduleResult, standingsResult] = await Promise.allSettled([
        fetch(`${STATS_API}/v1/schedule?${scheduleParams}`, { signal: AbortSignal.timeout(12_000) }).then(async (res) => {
          await assertOk(res, "postseason schedule");
          return res.json();
        }),
        fetchStandings(season),
      ]);

      if (scheduleResult.status === "rejected") throw scheduleResult.reason;
      const standings = new Map<number, TeamStanding>();
      if (standingsResult.status === "fulfilled") {
        for (const team of standingsResult.value.allTeams) standings.set(team.id, team);
      }

      const rawGames: RawGame[] = (scheduleResult.value?.dates ?? [])
        .flatMap((date: { games?: RawGame[] }) => date.games ?? [])
        .filter((game: RawGame) => POSTSEASON_TYPES.has(game.gameType as PostseasonRoundCode))
        .sort((a: RawGame, b: RawGame) => String(a.gameDate).localeCompare(String(b.gameDate)));

      const pitcherNames = new Map<number, string>();
      for (const game of rawGames) {
        for (const side of [game.teams?.away, game.teams?.home]) {
          const id = side?.probablePitcher?.id;
          if (id) pitcherNames.set(id, side?.probablePitcher?.fullName ?? "Probable starter");
        }
      }

      const pitcherEntries = await Promise.all(
        [...pitcherNames.entries()].map(async ([id, name]) => {
          try {
            return [id, await fetchPitcherStats(id, name, season)] as const;
          } catch {
            return [id, { id, name, era: null, whip: null, strikeoutsPer9: null, inningsPitched: null }] as const;
          }
        })
      );
      const pitchers = new Map<number, PostseasonPitcher>(pitcherEntries);

      const seriesMap = new Map<string, { round: PostseasonRoundCode; games: PostseasonGame[] }>();
      for (const raw of rawGames) {
        const round = raw.gameType as PostseasonRoundCode;
        const awaySide = raw.teams?.away ?? {};
        const homeSide = raw.teams?.home ?? {};
        const away = teamFrom(awaySide, standings);
        const home = teamFrom(homeSide, standings);
        if (!away.id || !home.id) continue;
        const awayPitcherId = awaySide.probablePitcher?.id;
        const homePitcherId = homeSide.probablePitcher?.id;
        const awayPitcher = awayPitcherId ? pitchers.get(awayPitcherId) ?? null : null;
        const homePitcher = homePitcherId ? pitchers.get(homePitcherId) ?? null : null;
        const abstractState = raw.status?.abstractGameState ?? "Preview";
        const game: PostseasonGame = {
          gamePk: raw.gamePk ?? 0,
          gameDate: raw.gameDate ?? "",
          officialDate: raw.officialDate ?? "",
          gameNumber: raw.gameNumber ?? 1,
          status: {
            abstractGameState: abstractState,
            detailedState: raw.status?.detailedState ?? "Scheduled",
            statusCode: raw.status?.statusCode ?? "S",
          },
          venue: raw.venue?.name ?? "TBD",
          away: { team: away, score: awaySide.score ?? null, isWinner: !!awaySide.isWinner, probablePitcher: awayPitcher },
          home: { team: home, score: homeSide.score ?? null, isWinner: !!homeSide.isWinner, probablePitcher: homePitcher },
          prediction: abstractState === "Final" ? null : predictPostseasonGame({ away, home, awayPitcher, homePitcher }),
        };

        const pair = [away.id, home.id].sort((a, b) => a - b).join("-");
        const seriesNumber = raw.seriesStatus?.seriesNumber;
        const key = `${round}-${seriesNumber ?? pair}`;
        const bucket = seriesMap.get(key) ?? { round, games: [] };
        bucket.games.push(game);
        seriesMap.set(key, bucket);
      }

      const series: PostseasonSeries[] = [...seriesMap.entries()].map(([id, bucket]) => {
        const games = bucket.games.sort((a, b) => a.gameDate.localeCompare(b.gameDate));
        const first = games[0];
        const teamA = first.away.team;
        const teamB = first.home.team;
        const winsNeeded = roundFor(bucket.round)?.winsNeeded ?? 4;
        let teamAWins = 0;
        let teamBWins = 0;
        for (const game of games) {
          if (game.status.abstractGameState !== "Final") continue;
          const winnerId = game.away.isWinner
            ? game.away.team.id
            : game.home.isWinner
              ? game.home.team.id
              : game.away.score != null && game.home.score != null && game.away.score !== game.home.score
                ? game.away.score > game.home.score ? game.away.team.id : game.home.team.id
                : 0;
          if (winnerId === teamA.id) teamAWins++;
          if (winnerId === teamB.id) teamBWins++;
        }

        const isComplete = teamAWins >= winsNeeded || teamBWins >= winsNeeded;
        const nextGame = games.find((game) => game.status.abstractGameState !== "Final");
        let projection: SeriesProjection | null = null;
        if (isComplete) {
          const teamAWon = teamAWins > teamBWins;
          projection = {
            favoredTeamId: teamAWon ? teamA.id : teamB.id,
            favoredTeamName: teamAWon ? teamA.name : teamB.name,
            teamAWinProbability: teamAWon ? 100 : 0,
            teamBWinProbability: teamAWon ? 0 : 100,
            pitcherAdjusted: false,
            summary: `${teamAWon ? teamA.name : teamB.name} won the series ${Math.max(teamAWins, teamBWins)}-${Math.min(teamAWins, teamBWins)}.`,
          };
        } else if (nextGame?.prediction) {
          const teamAIsAway = nextGame.away.team.id === teamA.id;
          const teamAGameProbability = (teamAIsAway
            ? nextGame.prediction.awayWinProbability
            : nextGame.prediction.homeWinProbability) / 100;
          const teamASeries = Math.round(seriesWinProbability(teamAGameProbability, teamAWins, teamBWins, winsNeeded) * 100);
          const teamBSeries = 100 - teamASeries;
          const aFavored = teamASeries >= teamBSeries;
          projection = {
            favoredTeamId: aFavored ? teamA.id : teamB.id,
            favoredTeamName: aFavored ? teamA.name : teamB.name,
            teamAWinProbability: teamASeries,
            teamBWinProbability: teamBSeries,
            pitcherAdjusted: nextGame.prediction.pitcherAdjusted,
            summary: `${aFavored ? teamA.name : teamB.name} projects at ${Math.max(teamASeries, teamBSeries)}% to advance${nextGame.prediction.pitcherAdjusted ? " with the next confirmed starters included" : " before both next starters are confirmed"}.`,
          };
        }

        const leagueName = teamA.league === teamB.league ? teamA.league : "MLB";
        const league = leagueName.includes("American") ? "AL" : leagueName.includes("National") ? "NL" : "MLB";
        return {
          id,
          round: bucket.round,
          roundLabel: roundFor(bucket.round)?.label ?? "Postseason",
          league,
          teamA,
          teamB,
          teamAWins,
          teamBWins,
          winsNeeded,
          isComplete,
          games,
          projection,
          scenario: buildSeriesScenario(teamA.name, teamB.name, teamAWins, teamBWins, winsNeeded),
        };
      });

      series.sort((a, b) => {
        const roundOrder = POSTSEASON_ROUNDS.findIndex((round) => round.code === a.round) - POSTSEASON_ROUNDS.findIndex((round) => round.code === b.round);
        if (roundOrder !== 0) return roundOrder;
        return a.league.localeCompare(b.league);
      });
      const allGames = series.flatMap((item) => item.games);
      const upcoming = allGames
        .filter((game) => game.status.abstractGameState !== "Final")
        .sort((a, b) => a.gameDate.localeCompare(b.gameDate));

      return {
        season,
        generatedAt: Date.now(),
        rounds: POSTSEASON_ROUNDS,
        series,
        liveGames: upcoming.filter((game) => game.status.abstractGameState === "Live"),
        nextGames: upcoming.slice(0, 12),
        completedGames: allGames.filter((game) => game.status.abstractGameState === "Final").length,
        methodology: "Model estimates combine regular-season winning percentage, run differential, a modest home-field adjustment, and—when both are confirmed—the probable starters’ ERA, WHIP, and strikeout rate. Baseball remains high-variance; these are fan projections, not betting advice.",
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
