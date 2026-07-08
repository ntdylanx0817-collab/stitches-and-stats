import {
  MLBGame,
  MLBSchedule,
  LiveGameFeed,
  SavantGameFeed,
  StatcastPitch,
  LeaderboardRow,
  MLBPlayer,
} from "./types";
import { getOrSet, getCached, setCached } from "./cache";

const STATS_API = "https://statsapi.mlb.com/api";
const SAVANT_API = "https://baseballsavant.mlb.com";

const ONE_MINUTE = 60_000;
const FIVE_MINUTES = 5 * 60_000;
const ONE_HOUR = 60 * 60_000;
const ONE_DAY = 24 * 60 * 60_000;

/** Format a Date as YYYY-MM-DD in America/Chicago (user tz). */
export function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Fetch today's schedule (or any date). Live games are cached for 30s, others for 5m.
 */
export async function fetchSchedule(dateStr?: string): Promise<MLBSchedule> {
  const date = dateStr ?? ymd(new Date());
  const cacheKey = `schedule:${date}`;
  const ttl = ONE_MINUTE; // refresh schedule quickly so live status updates

  return getOrSet(cacheKey, ttl, async () => {
    const url = `${STATS_API}/v1/schedule?sportId=1&date=${encodeURIComponent(date)}&hydrate=team,linescore,probablePitcher,game(content(summary))`;
    const res = await fetch(url, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`schedule fetch failed: ${res.status}`);
    return (await res.json()) as MLBSchedule;
  });
}

/** Get a single game's live feed (plays + linescore + game data). */
export async function fetchLiveFeed(gamePk: number): Promise<LiveGameFeed> {
  const cacheKey = `live:${gamePk}`;
  const cached = getCached<LiveGameFeed>(cacheKey);
  if (cached) return cached;

  const url = `${STATS_API}/v1.1/game/${gamePk}/feed/live`;
  const res = await fetch(url, {
    next: { revalidate: 10 },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`live feed fetch failed: ${res.status}`);
  const data = (await res.json()) as LiveGameFeed;
  const state = data.gameData?.status?.abstractGameState ?? "Final";
  const ttl = state === "Live" ? ONE_MINUTE : ONE_HOUR;
  setCached(cacheKey, data, ttl);
  return data;
}

/**
 * Fetch Statcast per-pitch metrics from Baseball Savant's game feed.
 * This is the key Statcast data source — exit velocity, launch angle,
 * spin rate, barrel, xBA, etc., per pitch.
 */
export async function fetchSavantGameFeed(gamePk: number): Promise<SavantGameFeed> {
  const cacheKey = `savant:${gamePk}`;
  return getOrSet(cacheKey, ONE_MINUTE, async () => {
    const url = `${SAVANT_API}/gf?game_pk=${gamePk}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Accept": "application/json",
        "Referer": "https://baseballsavant.mlb.com/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (!res.ok) throw new Error(`savant fetch failed: ${res.status}`);
    return (await res.json()) as SavantGameFeed;
  });
}

/** Combined "enriched" pitch list = MLB live feed pitch events + Statcast metrics. */
export interface EnrichedPitch {
  playId?: string;
  atBatIndex: number;
  inning: number;
  halfInning: "top" | "bottom";
  pitchNumber: number;
  isPitch: boolean;
  batterId?: number;
  batterName: string;
  batterSide?: string;
  pitcherId?: number;
  pitcherName: string;
  pitchHand?: string;
  description: string;
  playResult: string;
  call?: string;
  callDescription?: string;
  pitchType?: string;
  pitchName?: string;
  startSpeed?: number;
  endSpeed?: number;
  spinRate?: number;
  breakX?: number;
  breakZ?: number;
  inducedBreakZ?: number;
  extension?: number;
  plateTime?: number;
  pX?: number;
  pZ?: number;
  zone?: number;
  szTop?: number;
  szBot?: number;
  isStrike: boolean;
  isBall: boolean;
  isInPlay: boolean;
  isBarrel?: boolean;
  isSword?: boolean;
  exitVelocity?: number | null;
  launchAngle?: number | null;
  hitDistance?: number | null;
  xBA?: number | null;
  batSpeed?: number | null;
  balls: number;
  strikes: number;
  outs: number;
  homeScore: number;
  awayScore: number;
  timestamp?: string;
  result?: string;
  resultDescription?: string;
}

/**
 * Build an enriched pitch list by merging the MLB live feed's pitch events
 * with the corresponding Statcast pitch metrics. Each pitch gets both the
 * MLB pitch coordinates (pX, pZ) and Statcast metrics (EV, launch angle, etc.).
 */
export async function fetchEnrichedPitches(gamePk: number): Promise<{
  pitches: EnrichedPitch[];
  linescore: LiveGameFeed["liveData"]["linescore"];
  status: LiveGameFeed["gameData"]["status"];
  teams: LiveGameFeed["gameData"]["teams"];
}> {
  // Parallel fetch — both are cached.
  const [feed, savant] = await Promise.all([
    fetchLiveFeed(gamePk).catch(() => null),
    fetchSavantGameFeed(gamePk).catch(() => null),
  ]);

  const pitches: EnrichedPitch[] = [];

  if (feed) {
    // Build a lookup from savant: key = `${inning}-${halfInning}-${ab_number}-${pitch_number}`
    const savantMap = new Map<string, StatcastPitch>();
    if (savant?.exit_velocity) {
      for (const sp of savant.exit_velocity) {
        const k = `${sp.inning}-${sp.half_inning}-${sp.ab_number}-${sp.pitch_number ?? 0}`;
        savantMap.set(k, sp);
      }
    }

    for (const play of feed.liveData.plays.allPlays) {
      const inning = play.about.inning;
      const halfInning = play.about.halfInning;
      const abNumber = play.atBatIndex + 1;

      for (const ev of play.playEvents) {
        if (!ev.isPitch) continue;
        const key = `${inning}-${halfInning}-${abNumber}-${ev.pitchNumber ?? 0}`;
        const sp = savantMap.get(key);
        const coords = ev.pitchData?.coordinates;
        pitches.push({
          playId: ev.playId,
          atBatIndex: play.atBatIndex,
          inning,
          halfInning,
          pitchNumber: ev.pitchNumber ?? 0,
          isPitch: true,
          batterId: play.matchup.batter.id,
          batterName: play.matchup.batter.fullName,
          batterSide: play.matchup.batterSide?.code,
          pitcherId: play.matchup.pitcher.id,
          pitcherName: play.matchup.pitcher.fullName,
          pitchHand: play.matchup.pitchHand?.code,
          description: ev.details.description ?? "",
          playResult: play.result.event,
          call: ev.details.call?.code,
          callDescription: ev.details.call?.description,
          pitchType: sp?.pitch_type ?? ev.details.type?.code,
          pitchName: sp?.pitch_name ?? ev.details.type?.description,
          startSpeed: sp?.start_speed ?? ev.pitchData?.startSpeed,
          endSpeed: sp?.end_speed ?? ev.pitchData?.endSpeed,
          spinRate: sp?.spin_rate ?? ev.pitchData?.spinRate,
          breakX: sp?.breakX ?? ev.pitchData?.breakX,
          breakZ: sp?.breakZ ?? ev.pitchData?.breakZ,
          inducedBreakZ: sp?.inducedBreakZ,
          extension: sp?.extension ?? ev.pitchData?.extension,
          plateTime: sp?.plateTime ?? ev.pitchData?.plateTime,
          pX: sp?.px ?? sp?.plate_x ?? coords?.pX,
          pZ: sp?.pz ?? sp?.plate_z ?? coords?.pZ,
          zone: sp?.zone ?? ev.pitchData?.zone,
          szTop: sp?.sz_top ?? ev.pitchData?.strikeZoneTop,
          szBot: sp?.sz_bot ?? ev.pitchData?.strikeZoneBottom,
          isStrike: !!ev.details.isStrike,
          isBall: !!ev.details.isBall,
          isInPlay: !!ev.details.isInPlay,
          isBarrel: sp?.is_barrel === 1,
          isSword: !!sp?.isSword,
          exitVelocity: sp?.hit_speed != null && sp.hit_speed !== "" ? parseFloat(String(sp.hit_speed)) : null,
          launchAngle: sp?.hit_angle != null && sp.hit_angle !== "" ? parseFloat(String(sp.hit_angle)) : null,
          hitDistance: sp?.hit_distance != null && sp.hit_distance !== "" ? parseFloat(String(sp.hit_distance)) : null,
          xBA: sp?.xba != null && sp.xba !== "" ? parseFloat(String(sp.xba)) : null,
          batSpeed: sp?.batSpeed != null ? Number(sp.batSpeed) : null,
          balls: ev.count?.balls ?? play.count.balls,
          strikes: ev.count?.strikes ?? play.count.strikes,
          outs: ev.count?.outs ?? play.count.outs,
          homeScore: play.result.homeScore,
          awayScore: play.result.awayScore,
          timestamp: ev.endTime ?? play.playEndTime,
          result: sp?.result,
          resultDescription: sp?.des,
        });
      }
    }
  }

  return {
    pitches,
    linescore: feed?.liveData.linescore ?? savant?.scoreboard.linescore ?? { innings: [] },
    status: feed?.gameData.status ?? { abstractGameState: savant?.game_status ?? "Final", codedGameState: "", detailedState: savant?.game_status ?? "Final", statusCode: savant?.game_status_code ?? "F" },
    teams: feed?.gameData.teams ?? {
      away: { id: savant?.team_away_id ?? 0, name: savant?.team_away ?? "", abbreviation: savant?.away_team_data?.abbreviation ?? "" },
      home: { id: savant?.team_home_id ?? 0, name: savant?.team_home ?? "", abbreviation: savant?.home_team_data?.abbreviation ?? "" },
    },
  };
}

/**
 * Fetch the season leaderboards (batters or pitchers) from Baseball Savant's
 * CSV leaderboard endpoint. Cached for 5 minutes.
 */
const LEADERBOARD_SELECTIONS_BATTER = [
  "player_name", "player_id", "year", "ab", "pa", "hit", "single", "double", "triple",
  "home_run", "k_percent", "bb_percent", "batting_avg", "slg_percent", "on_base_percent",
  "woba", "xwoba", "xba", "xslg", "hard_hit_percent", "barrel_brea", "sweet_spot_percent",
  "avg_hit_speed", "max_hit_speed", "swing_percent", "whiff_percent", "launch_angle_average",
  "poz_swing_percent", "oz_swing_percent",
].join(",");

const LEADERBOARD_SELECTIONS_PITCHER = [
  "player_name", "player_id", "year", "p_ip", "p_pa", "p_k", "p_bb", "p_era",
  "p_whip", "p_avg", "p_slg", "p_obp", "p_woba", "p_xwoba", "p_xba",
  "p_k_percent", "p_bb_percent", "p_hard_hit_percent", "p_barrel_brea",
  "p_avg_hit_speed", "p_max_hit_speed", "p_sweet_spot_percent", "p_whiff_percent",
  "p_oz_swing_percent", "p_csw_percent",
].join(",");

export async function fetchLeaderboard(opts: {
  type?: "batter" | "pitcher";
  year?: number;
  min?: number;
  position?: string;
  team?: string;
  gameType?: string;
} = {}): Promise<LeaderboardRow[]> {
  const type = opts.type ?? "batter";
  const year = opts.year ?? new Date().getFullYear();
  const min = opts.min ?? 50;
  const position = opts.position ?? "";
  const team = opts.team ?? "";
  const gameType = opts.gameType ?? "Regular";

  const cacheKey = `leaderboard:${type}:${year}:${min}:${position}:${team}:${gameType}`;
  return getOrSet(cacheKey, FIVE_MINUTES, async () => {
    const selections = type === "batter" ? LEADERBOARD_SELECTIONS_BATTER : LEADERBOARD_SELECTIONS_PITCHER;
    const url = `${SAVANT_API}/leaderboard/custom?year=${year}&type=${type}&filter=${encodeURIComponent(position)}&min=${min}&selections=${encodeURIComponent(selections)}&team=${encodeURIComponent(team)}&gameType=${encodeURIComponent(gameType)}&html=true&csv=true`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Accept": "text/csv, */*",
        "Referer": "https://baseballsavant.mlb.com/leaderboard/custom",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (!res.ok) throw new Error(`leaderboard fetch failed: ${res.status}`);
    const csv = await res.text();
    return parseLeaderboardCSV(csv);
  });
}

/** Parse the savant leaderboard CSV into rows of typed records. */
export function parseLeaderboardCSV(csv: string): LeaderboardRow[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  // Parse header — savant uses quoted "last_name, first_name" as first column
  const header = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: LeaderboardRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const row: any = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j];
      let value: any = cells[j] ?? "";
      // Strip surrounding quotes
      if (typeof value === "string") value = value.replace(/^"|"$/g, "");
      // Convert numbers
      if (value !== "" && value != null && !isNaN(Number(value)) && /^-?[\d.]+$/.test(value)) {
        value = Number(value);
      }
      row[key] = value;
    }
    // Normalize: ensure player_id is a number
    if (row.player_id != null) {
      row.player_id = Number(row.player_id);
      rows.push(row as LeaderboardRow);
    }
  }
  return rows;
}

/** Minimal CSV line parser that handles quoted fields with commas inside. */
function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

/** Search active players by name. Uses MLB Stats API player registry. */
export async function searchPlayers(query: string, limit = 12): Promise<MLBPlayer[]> {
  if (!query || query.length < 2) return [];
  const season = new Date().getFullYear();
  const cacheKey = `players:${season}`;
  const all = await getOrSet(cacheKey, ONE_DAY, async () => {
    const url = `${STATS_API}/v1/sports/1/players?season=${season}`;
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`players fetch failed: ${res.status}`);
    const data = await res.json();
    return data.people as MLBPlayer[];
  });
  const q = query.toLowerCase();
  return all
    .filter((p) => p.fullName.toLowerCase().includes(q))
    .slice(0, limit);
}

/** Get a single player's bio from MLB Stats API. */
export async function fetchPlayer(playerId: number): Promise<MLBPlayer | null> {
  const cacheKey = `player:${playerId}`;
  return getOrSet(cacheKey, ONE_DAY, async () => {
    const url = `${STATS_API}/v1/people/${playerId}`;
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.people?.[0] as MLBPlayer) ?? null;
  });
}

/**
 * Compute percentile rankings for a player by comparing their stats against
 * the rest of the leaderboard for a given metric.
 */
export function computePercentiles(
  player: LeaderboardRow,
  leaderboard: LeaderboardRow[],
  type: "batter" | "pitcher" = "batter"
): Array<{ key: string; label: string; value: number | string; percentile: number; display?: string; higherIsBetter: boolean }> {
  const metricDefs: Array<{ key: string; label: string; higherIsBetter: boolean; format?: (v: any) => string }> =
    type === "batter"
      ? [
          { key: "xwoba", label: "xwOBA", higherIsBetter: true, format: (v) => Number(v).toFixed(3).replace(/^0/, "") },
          { key: "xba", label: "xBA", higherIsBetter: true, format: (v) => Number(v).toFixed(3).replace(/^0/, "") },
          { key: "woba", label: "wOBA", higherIsBetter: true, format: (v) => Number(v).toFixed(3).replace(/^0/, "") },
          { key: "slg_percent", label: "SLG", higherIsBetter: true, format: (v) => Number(v).toFixed(3).replace(/^0/, "") },
          { key: "on_base_percent", label: "OBP", higherIsBetter: true, format: (v) => Number(v).toFixed(3).replace(/^0/, "") },
          { key: "batting_avg", label: "AVG", higherIsBetter: true, format: (v) => Number(v).toFixed(3).replace(/^0/, "") },
          { key: "barrel_brea", label: "Barrel %", higherIsBetter: true, format: (v) => `${Number(v).toFixed(1)}%` },
          { key: "hard_hit_percent", label: "Hard Hit %", higherIsBetter: true, format: (v) => `${Number(v).toFixed(1)}%` },
          { key: "avg_hit_speed", label: "Avg EV", higherIsBetter: true, format: (v) => `${Number(v).toFixed(1)} mph` },
          { key: "max_hit_speed", label: "Max EV", higherIsBetter: true, format: (v) => `${Number(v).toFixed(1)} mph` },
          { key: "sweet_spot_percent", label: "Sweet Spot %", higherIsBetter: true, format: (v) => `${Number(v).toFixed(1)}%` },
          { key: "launch_angle_average", label: "Avg LA", higherIsBetter: false, format: (v) => `${Number(v).toFixed(1)}°` },
          { key: "k_percent", label: "K %", higherIsBetter: false, format: (v) => `${Number(v).toFixed(1)}%` },
          { key: "bb_percent", label: "BB %", higherIsBetter: true, format: (v) => `${Number(v).toFixed(1)}%` },
          { key: "whiff_percent", label: "Whiff %", higherIsBetter: false, format: (v) => `${Number(v).toFixed(1)}%` },
        ]
      : [
          { key: "p_era", label: "ERA", higherIsBetter: false, format: (v) => Number(v).toFixed(2) },
          { key: "p_whip", label: "WHIP", higherIsBetter: false, format: (v) => Number(v).toFixed(2) },
          { key: "p_xwoba", label: "xwOBA", higherIsBetter: false, format: (v) => Number(v).toFixed(3).replace(/^0/, "") },
          { key: "p_xba", label: "xBA", higherIsBetter: false, format: (v) => Number(v).toFixed(3).replace(/^0/, "") },
          { key: "p_k_percent", label: "K %", higherIsBetter: true, format: (v) => `${Number(v).toFixed(1)}%` },
          { key: "p_bb_percent", label: "BB %", higherIsBetter: false, format: (v) => `${Number(v).toFixed(1)}%` },
          { key: "p_whiff_percent", label: "Whiff %", higherIsBetter: true, format: (v) => `${Number(v).toFixed(1)}%` },
          { key: "p_csw_percent", label: "CSW %", higherIsBetter: true, format: (v) => `${Number(v).toFixed(1)}%` },
          { key: "p_barrel_brea", label: "Barrel %", higherIsBetter: false, format: (v) => `${Number(v).toFixed(1)}%` },
          { key: "p_hard_hit_percent", label: "Hard Hit %", higherIsBetter: false, format: (v) => `${Number(v).toFixed(1)}%` },
          { key: "p_avg_hit_speed", label: "Avg EV", higherIsBetter: false, format: (v) => `${Number(v).toFixed(1)} mph` },
        ];

  const results: Array<{ key: string; label: string; value: number | string; percentile: number; display?: string; higherIsBetter: boolean }> = [];

  for (const def of metricDefs) {
    const values = leaderboard
      .map((r) => Number(r[def.key]))
      .filter((v) => !isNaN(v));
    if (values.length < 5) continue;
    const playerVal = Number(player[def.key]);
    if (isNaN(playerVal)) continue;
    // Compute percentile (0–100): percentage of players with worse value
    let worse = 0;
    for (const v of values) {
      if (def.higherIsBetter) {
        if (v < playerVal) worse++;
      } else {
        if (v > playerVal) worse++;
      }
    }
    const percentile = Math.round((worse / values.length) * 100);
    results.push({
      key: def.key,
      label: def.label,
      value: playerVal,
      percentile,
      display: def.format ? def.format(playerVal) : String(playerVal),
      higherIsBetter: def.higherIsBetter,
    });
  }
  return results;
}
