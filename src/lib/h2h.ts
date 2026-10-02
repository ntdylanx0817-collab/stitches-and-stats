import { assertOk } from "./api-errors";
import { getOrSet } from "./cache";
import { logger, serializeError } from "./logger";

const STATS_API = "https://statsapi.mlb.com/api";
const log = logger.child({ component: "h2h" });

export interface H2HGame {
  gamePk: number;
  date: string;
  awayAbbr: string;
  homeAbbr: string;
  awayScore: number;
  homeScore: number;
  winner: "away" | "home";
}

export interface H2HData {
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
  preGameWinProb: number;
}

/** Shared cached H2H lookup used by both API routes without a server-side self-request. */
export function getHeadToHeadData(team1Id: number, team2Id: number): Promise<H2HData | null> {
  return getOrSet(`h2h:${team1Id}:${team2Id}`, 300_000, () => fetchHeadToHeadData(team1Id, team2Id));
}

async function fetchHeadToHeadData(team1Id: number, team2Id: number): Promise<H2HData | null> {
  try {
    const [team1Response, team2Response] = await Promise.all([
      fetch(`${STATS_API}/v1/teams/${team1Id}`, { signal: AbortSignal.timeout(8_000) }),
      fetch(`${STATS_API}/v1/teams/${team2Id}`, { signal: AbortSignal.timeout(8_000) }),
    ]);
    await Promise.all([
      assertOk(team1Response, "first H2H team"),
      assertOk(team2Response, "second H2H team"),
    ]);
    const team1Data = await team1Response.json();
    const team2Data = await team2Response.json();
    const team1Abbr = team1Data?.teams?.[0]?.abbreviation ?? "T1";
    const team2Abbr = team2Data?.teams?.[0]?.abbreviation ?? "T2";

    const currentYear = new Date().getFullYear();
    const seasons = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
    const allGames: H2HGame[] = [];

    for (const season of seasons) {
      if (allGames.length >= 6) break;
      try {
        const params = new URLSearchParams({
          sportId: "1",
          teamId: String(team1Id),
          opponentId: String(team2Id),
          season: String(season),
          gameType: "R",
          hydrate: "team",
        });
        const response = await fetch(`${STATS_API}/v1/schedule?${params}`, { signal: AbortSignal.timeout(8_000) });
        await assertOk(response, `H2H schedule ${season}`);
        const schedule = await response.json();
        for (const dateEntry of schedule?.dates ?? []) {
          for (const game of dateEntry?.games ?? []) {
            if (game.status?.abstractGameState !== "Final") continue;
            const awayTeam = game.teams?.away?.team;
            const homeTeam = game.teams?.home?.team;
            const awayScore = game.teams?.away?.score ?? 0;
            const homeScore = game.teams?.home?.score ?? 0;
            allGames.push({
              gamePk: game.gamePk,
              date: dateEntry.date,
              awayAbbr: awayTeam?.abbreviation ?? "?",
              homeAbbr: homeTeam?.abbreviation ?? "?",
              awayScore,
              homeScore,
              winner: awayScore > homeScore ? "away" : "home",
            });
          }
        }
      } catch (error) {
        log.warn("H2H season unavailable", { season, ...serializeError(error) });
      }
    }

    allGames.sort((a, b) => b.date.localeCompare(a.date));
    const recentGames = allGames.slice(0, 6);
    let team1Wins = 0;
    let team2Wins = 0;
    let team1Runs = 0;
    let team2Runs = 0;

    for (const game of recentGames) {
      const team1IsAway = game.awayAbbr === team1Abbr;
      const team1Won = (game.winner === "away" && team1IsAway) || (game.winner === "home" && !team1IsAway);
      if (team1Won) team1Wins++;
      else team2Wins++;
      team1Runs += team1IsAway ? game.awayScore : game.homeScore;
      team2Runs += team1IsAway ? game.homeScore : game.awayScore;
    }

    const team1AvgRuns = recentGames.length > 0 ? team1Runs / recentGames.length : 0;
    const team2AvgRuns = recentGames.length > 0 ? team2Runs / recentGames.length : 0;
    const winDiff = team1Wins - team2Wins;
    const runDiff = team1AvgRuns - team2AvgRuns;
    const preGameWinProb = Math.max(20, Math.min(80, 50 + winDiff * 5 + runDiff * 2));
    const edge = team1Wins > team2Wins
      ? `${team1Abbr} has the edge.`
      : team2Wins > team1Wins
        ? `${team2Abbr} has the edge.`
        : "Even matchup.";
    const insight = `Last ${recentGames.length} meetings: ${team1Abbr} ${team1Wins}-${team2Wins} ${team2Abbr}. ${team1Abbr} avg ${team1AvgRuns.toFixed(1)} runs/g, ${team2Abbr} avg ${team2AvgRuns.toFixed(1)} runs/g. ${edge}`;

    return {
      team1Id,
      team1Abbr,
      team2Id,
      team2Abbr,
      recentGames,
      team1Wins,
      team2Wins,
      team1AvgRuns,
      team2AvgRuns,
      insight,
      preGameWinProb,
    };
  } catch (error) {
    log.error("H2H computation failed", serializeError(error));
    return null;
  }
}
