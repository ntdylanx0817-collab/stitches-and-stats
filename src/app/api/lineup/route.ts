import { NextRequest, NextResponse } from "next/server";
import { fetchLiveFeed } from "@/lib/mlb-api";
import { getOrSet } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 15;

export interface LineupPlayer {
  id: number;
  name: string;
  position: string;
  battingOrder: string;
  orderNumber: number;
  isSubstitute: boolean;
  isPinchHitter: boolean;
  isPinchRunner: boolean;
  status: string;
  team: string;
  teamSide: "away" | "home";
}

export interface LineupChange {
  type: "starting_lineup" | "pitching_change" | "pinch_hit" | "pinch_run" | "defensive_sub" | "scratch";
  player: LineupPlayer;
  replacedPlayer?: LineupPlayer;
  description: string;
  inning?: number;
  timestamp: string;
}

export interface LineupData {
  gamePk: number;
  awayTeam: string;
  homeTeam: string;
  awayLineup: LineupPlayer[];
  homeLineup: LineupPlayer[];
  awayPitchers: LineupPlayer[];
  homePitchers: LineupPlayer[];
  currentAwayPitcher?: LineupPlayer;
  currentHomePitcher?: LineupPlayer;
  changes: LineupChange[];
  lastUpdated: number;
}

/**
 * Extract lineup data from the MLB live feed.
 * Detects:
 * - Starting lineups (battingOrder 100-900)
 * - Substitutions (battingOrder 1XX, 2XX, etc.)
 * - Pinch hitters (position "PH")
 * - Pinch runners (position "PR")
 * - Pitching changes (multiple pitchers with gameStatus flags)
 * - Scratched players (status code "S")
 */
function extractLineup(feed: any): LineupData | null {
  if (!feed?.liveData?.boxscore?.teams) return null;

  const teams = feed.liveData.boxscore.teams;
  const gameData = feed.gameData;
  const awayTeamName = gameData?.teams?.away?.name ?? "Away";
  const homeTeamName = gameData?.teams?.home?.name ?? "Home";

  const extractTeam = (side: "away" | "home", teamName: string): {
    lineup: LineupPlayer[];
    pitchers: LineupPlayer[];
    currentPitcher?: LineupPlayer;
  } => {
    const teamData = teams[side];
    if (!teamData?.players) return { lineup: [], pitchers: [] };

    const lineup: LineupPlayer[] = [];
    const pitchers: LineupPlayer[] = [];
    let currentPitcher: LineupPlayer | undefined;

    for (const [key, p] of Object.entries(teamData.players) as [string, any][]) {
      const name = p.person?.fullName ?? "Unknown";
      const position = p.position?.abbreviation ?? "—";
      const battingOrder = p.battingOrder;
      const status = p.status?.code ?? "A";
      const gameStatus = p.gameStatus || {};

      const player: LineupPlayer = {
        id: p.person?.id ?? 0,
        name,
        position,
        battingOrder: battingOrder ?? "",
        orderNumber: battingOrder ? Math.floor(parseInt(battingOrder) / 100) : 0,
        isSubstitute: battingOrder ? parseInt(battingOrder) % 100 !== 0 : false,
        isPinchHitter: position === "PH",
        isPinchRunner: position === "PR",
        status,
        team: teamName,
        teamSide: side,
      };

      // Check for scratches (status code "S" = scratched)
      if (status === "S") {
        player.status = "Scratched";
      }

      if (position === "P") {
        pitchers.push(player);
        if (gameStatus.isCurrentPitcher || gameStatus.isPitcher) {
          currentPitcher = player;
        }
      } else if (battingOrder) {
        lineup.push(player);
      }
    }

    // Sort lineup by batting order
    lineup.sort((a, b) => {
      if (a.orderNumber !== b.orderNumber) return a.orderNumber - b.orderNumber;
      return parseInt(a.battingOrder) - parseInt(b.battingOrder);
    });

    return { lineup, pitchers, currentPitcher };
  };

  const away = extractTeam("away", awayTeamName);
  const home = extractTeam("home", homeTeamName);

  // Build changes list from substitutions
  const changes: LineupChange[] = [];

  // Detect pitching changes (more than 1 pitcher = at least one change)
  if (away.pitchers.length > 1) {
    for (let i = 1; i < away.pitchers.length; i++) {
      changes.push({
        type: "pitching_change",
        player: away.pitchers[i],
        replacedPlayer: away.pitchers[i - 1],
        description: `${away.pitchers[i].name} replaces ${away.pitchers[i - 1].name} on the mound for ${awayTeamName}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
  if (home.pitchers.length > 1) {
    for (let i = 1; i < home.pitchers.length; i++) {
      changes.push({
        type: "pitching_change",
        player: home.pitchers[i],
        replacedPlayer: home.pitchers[i - 1],
        description: `${home.pitchers[i].name} replaces ${home.pitchers[i - 1].name} on the mound for ${homeTeamName}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Detect pinch hitters and runners
  for (const p of [...away.lineup, ...home.lineup]) {
    if (p.isPinchHitter) {
      changes.push({
        type: "pinch_hit",
        player: p,
        description: `Pinch hitter: ${p.name} enters the game for ${p.team}`,
        timestamp: new Date().toISOString(),
      });
    }
    if (p.isPinchRunner) {
      changes.push({
        type: "pinch_run",
        player: p,
        description: `Pinch runner: ${p.name} enters the game for ${p.team}`,
        timestamp: new Date().toISOString(),
      });
    }
    // Detect defensive substitutions (non-PH/PR subs)
    if (p.isSubstitute && !p.isPinchHitter && !p.isPinchRunner) {
      changes.push({
        type: "defensive_sub",
        player: p,
        description: `Defensive substitution: ${p.name} (${p.position}) enters for ${p.team}`,
        timestamp: new Date().toISOString(),
      });
    }
    // Detect scratches
    if (p.status === "Scratched") {
      changes.push({
        type: "scratch",
        player: p,
        description: `⚠️ ${p.name} scratched from the lineup for ${p.team}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Also check pitchers for scratches
  for (const p of [...away.pitchers, ...home.pitchers]) {
    if (p.status === "Scratched") {
      changes.push({
        type: "scratch",
        player: p,
        description: `⚠️ ${p.name} scratched from the game for ${p.team}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return {
    gamePk: feed.gamePk,
    awayTeam: awayTeamName,
    homeTeam: homeTeamName,
    awayLineup: away.lineup,
    homeLineup: home.lineup,
    awayPitchers: away.pitchers,
    homePitchers: home.pitchers,
    currentAwayPitcher: away.currentPitcher,
    currentHomePitcher: home.currentPitcher,
    changes,
    lastUpdated: Date.now(),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gamePk: string }> }
) {
  // Note: this route is at /api/lineup/[gamePk] but we also support /api/lineup?gamePk=X
  // For the [gamePk] version, params would have gamePk. But we're using query params.
  const gamePk = Number(_req.nextUrl.searchParams.get("gamePk"));
  if (!gamePk) return NextResponse.json({ error: "gamePk required" }, { status: 400 });

  try {
    const cacheKey = `lineup:${gamePk}`;
    const data = await getOrSet(cacheKey, 15_000, async () => {
      const feed = await fetchLiveFeed(gamePk);
      if (!feed) return null;
      return extractLineup(feed);
    });

    if (!data) {
      return NextResponse.json({ error: "Lineup data not available" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
