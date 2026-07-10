import { NextRequest, NextResponse } from "next/server";
import { fetchPlayer, fetchLeaderboard, computePercentiles } from "@/lib/mlb-api";
import { getOrSet } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 300;

/**
 * Comprehensive player data endpoint that aggregates ALL available data:
 * - Bio (MLB Stats API)
 * - Season stats + percentiles + league ranks (Savant leaderboard)
 * - Spray chart data (statcast_search CSV)
 * - Pitch mix breakdown (from statcast_search)
 * - Game-by-game log (MLB Stats API)
 * - Zone data (already have /api/player-zones)
 */
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

  const now = new Date();
  const month = now.getMonth();
  const currentYear = now.getFullYear();
  const inSeason = month >= 2 && month <= 10;
  const fallbackYear = inSeason ? currentYear : currentYear - 1;
  const yearsToTry = requestedYear
    ? [requestedYear]
    : [fallbackYear, fallbackYear - 1, fallbackYear - 2, fallbackYear - 3];

  try {
    // 1. Fetch bio
    const player = await fetchPlayer(playerId);
    if (!player) return NextResponse.json({ error: "player not found" }, { status: 404 });

    // 2. Find season stats
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

    const qualified = leaderboard.filter((r) => (Number(r.pa) || Number(r.p_ip) || 0) >= 50);
    const percentiles = playerRow
      ? computePercentiles(playerRow, qualified.length > 0 ? qualified : leaderboard, type)
      : [];

    // 3. Compute league ranks for key stats
    const leagueRanks = computeLeagueRanks(playerRow, leaderboard, type);

    // 4. Fetch pitch-by-pitch data from statcast_search
    const pbpCacheKey = `pbp:${type}:${playerId}:${year}`;
    const pbpData = await getOrSet(pbpCacheKey, 300_000, async () => {
      return await fetchStatcastPBP(playerId, type, year);
    });

    // 5. Fetch game-by-game log from MLB Stats API
    const gameLog = await fetchGameLog(playerId, type, year);

    // 6. For pitchers: fetch pitch movement data from statcast_search
    let pitchMovement: any[] = [];
    if (type === "pitcher") {
      pitchMovement = pbpData.pitchMix.map((p: any) => ({
        ...p,
        // The pbp data already has pitch-level data; extract movement from it
      }));
    }

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
        birthStateProvince: player.birthStateProvince,
        birthCountry: player.birthCountry,
        primaryPosition: player.primaryPosition,
        batSide: player.batSide,
        pitchHand: player.pitchHand,
        currentTeam: player.currentTeam,
        draftYear: (player as any).draftYear,
        mlbDebutDate: (player as any).mlbDebutDate,
      },
      stats: playerRow ?? null,
      percentiles,
      leagueRanks,
      type,
      year,
      sprayChart: pbpData.sprayChart,
      pitchMix: pbpData.pitchMix,
      barrelData: pbpData.barrelData,
      totalPitches: pbpData.totalPitches,
      gameLog,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}

/**
 * Compute league ranks for key stats (e.g., "xwOBA: .415 — ranks 3rd in MLB").
 */
function computeLeagueRanks(playerRow: any, leaderboard: any[], type: "batter" | "pitcher"): Array<{ label: string; value: string; rank: number; total: number }> {
  if (!playerRow) return [];

  const statsToRank = type === "batter"
    ? [
        { key: "xwoba", label: "xwOBA", format: (v: any) => Number(v).toFixed(3).replace(/^0/, ""), higherIsBetter: true },
        { key: "woba", label: "wOBA", format: (v: any) => Number(v).toFixed(3).replace(/^0/, ""), higherIsBetter: true },
        { key: "xba", label: "xBA", format: (v: any) => Number(v).toFixed(3).replace(/^0/, ""), higherIsBetter: true },
        { key: "batting_avg", label: "AVG", format: (v: any) => Number(v).toFixed(3).replace(/^0/, ""), higherIsBetter: true },
        { key: "slg_percent", label: "SLG", format: (v: any) => Number(v).toFixed(3).replace(/^0/, ""), higherIsBetter: true },
        { key: "home_run", label: "HR", format: (v: any) => String(v), higherIsBetter: true },
        { key: "barrel_brea", label: "Barrel%", format: (v: any) => `${Number(v).toFixed(1)}%`, higherIsBetter: true },
        { key: "hard_hit_percent", label: "HardHit%", format: (v: any) => `${Number(v).toFixed(1)}%`, higherIsBetter: true },
        { key: "avg_hit_speed", label: "Avg EV", format: (v: any) => `${Number(v).toFixed(1)}`, higherIsBetter: true },
      ]
    : [
        { key: "p_era", label: "ERA", format: (v: any) => Number(v).toFixed(2), higherIsBetter: false },
        { key: "k_percent", label: "K%", format: (v: any) => `${Number(v).toFixed(1)}%`, higherIsBetter: true },
        { key: "whiff_percent", label: "Whiff%", format: (v: any) => `${Number(v).toFixed(1)}%`, higherIsBetter: true },
        { key: "barrel_brea", label: "Barrel% Allowed", format: (v: any) => `${Number(v).toFixed(1)}%`, higherIsBetter: false },
        { key: "hard_hit_percent", label: "HardHit% Allowed", format: (v: any) => `${Number(v).toFixed(1)}%`, higherIsBetter: false },
        { key: "xwoba", label: "xwOBA Allowed", format: (v: any) => Number(v).toFixed(3).replace(/^0/, ""), higherIsBetter: false },
      ];

  const results: Array<{ label: string; value: string; rank: number; total: number }> = [];
  const total = leaderboard.length;

  for (const stat of statsToRank) {
    const playerVal = Number(playerRow[stat.key]);
    if (isNaN(playerVal)) continue;

    let rank = 1;
    for (const r of leaderboard) {
      const v = Number(r[stat.key]);
      if (isNaN(v)) continue;
      if (stat.higherIsBetter ? v > playerVal : v < playerVal) {
        rank++;
      }
    }
    results.push({
      label: stat.label,
      value: stat.format(playerRow[stat.key]),
      rank,
      total,
    });
  }
  return results;
}

/**
 * Fetch game-by-game log from MLB Stats API.
 */
async function fetchGameLog(playerId: number, type: "batter" | "pitcher", season: number): Promise<any[]> {
  try {
    const group = type === "batter" ? "hitting" : "pitching";
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=stats(group=%5B${group}%5D,type=%5BgameLog%5D,season=${season})`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const stats = data?.people?.[0]?.stats;
    if (!stats || stats.length === 0) return [];
    const splits = stats[0]?.splits ?? [];
    // Return last 15 games (most recent first)
    return splits.slice(-15).reverse().map((s: any) => ({
      date: s.date,
      opponent: s.opponent?.name ?? "Unknown",
      isHome: s.home || false,
      stat: {
        ab: s.stat?.atBats,
        h: s.stat?.hits,
        hr: s.stat?.homeRuns,
        rbi: s.stat?.rbi,
        r: s.stat?.runs,
        bb: s.stat?.baseOnBalls,
        so: s.stat?.strikeOuts,
        sb: s.stat?.stolenBases,
        avg: s.stat?.avg,
        obp: s.stat?.obp,
        slg: s.stat?.slg,
        ops: s.stat?.ops,
        // Pitcher stats
        ip: s.stat?.inningsPitched,
        er: s.stat?.earnedRuns,
        k: s.stat?.strikeOuts,
        bb_allowed: s.stat?.baseOnBalls,
        np: s.stat?.numberOfPitches,
        era: s.stat?.era,
        whip: s.stat?.whip,
      },
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch pitch-by-pitch data from Baseball Savant's statcast_search CSV endpoint.
 */
async function fetchStatcastPBP(playerId: number, type: "batter" | "pitcher", season: number): Promise<{
  sprayChart: any[];
  pitchMix: any[];
  barrelData: any;
  totalPitches: number;
}> {
  const lookupParam = type === "batter" ? "batters_lookup%5B%5D" : "pitchers_lookup%5B%5D";
  const url = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&player_type=${type}&${lookupParam}=${playerId}&season=${season}&min_pas=0&hfGT=R%7C`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(45_000),
    headers: {
      "Accept": "text/csv, */*",
      "Referer": "https://baseballsavant.mlb.com/statcast_search",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    return { sprayChart: [], pitchMix: [], barrelData: null, totalPitches: 0 };
  }

  const csv = await res.text();
  const rows = parseCSV(csv);
  if (rows.length === 0) {
    return { sprayChart: [], pitchMix: [], barrelData: null, totalPitches: 0 };
  }

  const sprayChart: any[] = [];
  const pitchTypeMap = new Map<string, { count: number; speeds: number[]; spins: number[]; pfxX: number[]; pfxZ: number[]; releaseX: number[]; releaseZ: number[] }>();
  let totalBIP = 0;
  let totalBarrels = 0;
  let totalEV = 0;
  let evCount = 0;
  let maxEV = 0;
  let maxLA = 0;
  let totalDistance = 0;
  let distanceCount = 0;
  let sweetSpotCount = 0;
  let hardHitCount = 0;

  for (const r of rows) {
    const hcX = parseFloat(r.hc_x);
    const hcY = parseFloat(r.hc_y);
    const launchSpeed = parseFloat(r.launch_speed);
    const launchAngle = parseFloat(r.launch_angle);
    const event = r.events || "";

    if (!isNaN(hcX) && !isNaN(hcY) && hcX !== 0 && hcY !== 0) {
      totalBIP++;
      const isBarrel = r.is_barrel === "true" || r.is_barrel === "True" || r.launch_speed_angle === "6";

      if (!isNaN(launchSpeed)) {
        totalEV += launchSpeed;
        evCount++;
        if (launchSpeed > maxEV) maxEV = launchSpeed;
        if (launchSpeed >= 95) hardHitCount++;
        if (launchSpeed >= 98 && !isNaN(launchAngle) && launchAngle >= 4 && launchAngle <= 32) sweetSpotCount++;
      }
      if (!isNaN(launchAngle) && Math.abs(launchAngle) > Math.abs(maxLA)) maxLA = launchAngle;

      const dist = parseFloat(r.hit_distance_sc);
      if (!isNaN(dist)) {
        totalDistance += dist;
        distanceCount++;
      }

      if (isBarrel) totalBarrels++;

      sprayChart.push({
        x: hcX, y: hcY,
        launchSpeed: !isNaN(launchSpeed) ? launchSpeed : null,
        launchAngle: !isNaN(launchAngle) ? launchAngle : null,
        distance: !isNaN(dist) ? dist : null,
        event, isBarrel,
        estimatedBA: parseFloat(r.estimated_ba_using_speedangle) || null,
        estimatedWOBA: parseFloat(r.estimated_woba_using_speedangle) || null,
      });
    }

    // Pitch mix with movement data
    const pitchName = r.pitch_name || r.pitch_type || "";
    if (pitchName) {
      if (!pitchTypeMap.has(pitchName)) {
        pitchTypeMap.set(pitchName, { count: 0, speeds: [], spins: [], pfxX: [], pfxZ: [], releaseX: [], releaseZ: [] });
      }
      const pt = pitchTypeMap.get(pitchName)!;
      pt.count++;
      const spd = parseFloat(r.release_speed);
      if (!isNaN(spd)) pt.speeds.push(spd);
      const spin = parseFloat(r.release_spin_rate);
      if (!isNaN(spin)) pt.spins.push(spin);
      const pfxX = parseFloat(r.pfx_x);
      if (!isNaN(pfxX)) pt.pfxX.push(pfxX);
      const pfxZ = parseFloat(r.pfx_z);
      if (!isNaN(pfxZ)) pt.pfxZ.push(pfxZ);
      const relX = parseFloat(r.release_pos_x);
      if (!isNaN(relX)) pt.releaseX.push(relX);
      const relZ = parseFloat(r.release_pos_z);
      if (!isNaN(relZ)) pt.releaseZ.push(relZ);
    }
  }

  const totalPitches = rows.length;
  const pitchMix = Array.from(pitchTypeMap.entries())
    .map(([name, stats]) => ({
      name, count: stats.count,
      percentage: (stats.count / totalPitches) * 100,
      avgSpeed: stats.speeds.length > 0 ? stats.speeds.reduce((a: number, b: number) => a + b, 0) / stats.speeds.length : 0,
      avgSpin: stats.spins.length > 0 ? stats.spins.reduce((a: number, b: number) => a + b, 0) / stats.spins.length : 0,
      avgPfxX: stats.pfxX.length > 0 ? stats.pfxX.reduce((a: number, b: number) => a + b, 0) / stats.pfxX.length : 0,
      avgPfxZ: stats.pfxZ.length > 0 ? stats.pfxZ.reduce((a: number, b: number) => a + b, 0) / stats.pfxZ.length : 0,
      avgReleaseX: stats.releaseX.length > 0 ? stats.releaseX.reduce((a: number, b: number) => a + b, 0) / stats.releaseX.length : 0,
      avgReleaseZ: stats.releaseZ.length > 0 ? stats.releaseZ.reduce((a: number, b: number) => a + b, 0) / stats.releaseZ.length : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const barrelData = {
    totalBIP, totalBarrels,
    barrelPercent: totalBIP > 0 ? (totalBarrels / totalBIP) * 100 : 0,
    avgEV: evCount > 0 ? totalEV / evCount : 0,
    maxEV,
    maxLaunchAngle: maxLA,
    avgDistance: distanceCount > 0 ? totalDistance / distanceCount : 0,
    sweetSpotPercent: totalBIP > 0 ? (sweetSpotCount / totalBIP) * 100 : 0,
    hardHitPercent: totalBIP > 0 ? (hardHitCount / totalBIP) * 100 : 0,
  };

  return { sprayChart, pitchMix, barrelData, totalPitches };
}

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      let value = cells[j] ?? "";
      if (typeof value === "string") value = value.replace(/^"|"$/g, "");
      row[header[j]] = value;
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      cells.push(current); current = "";
    } else { current += ch; }
  }
  cells.push(current);
  return cells;
}
