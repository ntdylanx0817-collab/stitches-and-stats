/**
 * League standings, shared by the Standings tab and the Morning Recap.
 *
 * This used to live inline in src/app/api/standings/route.ts. The recap needs
 * the same division/wild-card derivation — and needs it as of a past date —
 * so the fetch and the shaping moved here rather than being copied.
 */

import { getOrSet } from "./cache";
import { assertOk } from "./api-errors";

const STATS_API = "https://statsapi.mlb.com/api";

export interface TeamStanding {
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

export interface DivisionStanding {
  division: string;
  teams: TeamStanding[];
}

export interface StandingsPayload {
  season: number;
  /** The date the standings are current as of, when one was requested. */
  date?: string;
  divisions: DivisionStanding[];
  wildCard: { AL: TeamStanding[]; NL: TeamStanding[] };
  allTeams: TeamStanding[];
}

/** Games back sorts as a number; "-" means the team is the leader. */
function gamesBackValue(raw: string): number {
  if (!raw || raw === "-") return 0;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

/**
 * Fetch and shape the standings.
 *
 * `date` asks MLB for the standings as they stood that morning, which is what
 * makes a recap of last Tuesday show last Tuesday's playoff picture instead of
 * today's. Omit it for the live standings.
 */
export function fetchStandings(season: number, date?: string): Promise<StandingsPayload> {
  const cacheKey = date ? `standings:${season}:${date}` : `standings:${season}`;
  // A past date's standings never change, so they are worth holding much
  // longer than the live ones.
  const ttl = date ? 6 * 60 * 60_000 : 300_000;

  return getOrSet(cacheKey, ttl, async () => {
    const params = new URLSearchParams({
      leagueId: "103,104",
      season: String(season),
      standingsTypes: "regularSeason",
      hydrate: "team,league,division",
    });
    if (date) params.set("date", date);

    const res = await fetch(`${STATS_API}/v1/standings?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    await assertOk(res, "standings");
    const raw = await res.json();

    const divisions: DivisionStanding[] = [];
    const allTeams: TeamStanding[] = [];

    for (const record of raw?.records ?? []) {
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

    const wildCardFor = (league: string) =>
      allTeams
        .filter((t) => t.league === league && t.divisionRank !== "1")
        .sort((a, b) => gamesBackValue(a.wildCardGamesBack) - gamesBackValue(b.wildCardGamesBack));

    return {
      season,
      date,
      divisions,
      wildCard: {
        AL: wildCardFor("American League"),
        NL: wildCardFor("National League"),
      },
      allTeams,
    };
  });
}

// ---------------------------------------------------------------------------
// Playoff picture
// ---------------------------------------------------------------------------

export interface LeaguePicture {
  league: string;
  /** The three division winners, best record first. */
  divisionLeaders: TeamStanding[];
  /** The three wild-card holders. */
  wildCard: TeamStanding[];
  /** The next three teams on the outside, closest first. */
  chasing: TeamStanding[];
}

export interface PlayoffPicture {
  AL: LeaguePicture;
  NL: LeaguePicture;
}

/** Three division winners plus three wild cards — the current postseason field. */
export const WILD_CARD_SPOTS = 3;

function pictureFor(allTeams: TeamStanding[], league: string): LeaguePicture {
  const inLeague = allTeams.filter((t) => t.league === league);

  const divisionLeaders = inLeague
    .filter((t) => t.divisionRank === "1")
    .sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct));

  const contenders = inLeague
    .filter((t) => t.divisionRank !== "1")
    .sort((a, b) => gamesBackValue(a.wildCardGamesBack) - gamesBackValue(b.wildCardGamesBack));

  return {
    league,
    divisionLeaders,
    wildCard: contenders.slice(0, WILD_CARD_SPOTS),
    chasing: contenders.slice(WILD_CARD_SPOTS, WILD_CARD_SPOTS + 3),
  };
}

export function buildPlayoffPicture(allTeams: TeamStanding[]): PlayoffPicture {
  return {
    AL: pictureFor(allTeams, "American League"),
    NL: pictureFor(allTeams, "National League"),
  };
}
