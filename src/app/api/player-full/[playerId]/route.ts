import { NextRequest, NextResponse } from "next/server";
import { fetchPlayer, fetchLeaderboard, computePercentiles } from "@/lib/mlb-api";
import { getOrSet } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 300;

/**
 * Comprehensive player data endpoint that aggregates ALL available data:
 * - Bio (MLB Stats API)
 * - Season stats + percentiles (Savant leaderboard)
 * - Spray chart data (statcast_search CSV)
 * - Pitch mix breakdown (from statcast_search)
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
  const now = new Date();
  const month = now.getMonth();
  const currentYear = now.getFullYear();
  const inSeason = month >= 2 && month <= 10;
  const fallbackYear = inSeason ? currentYear : currentYear - 1;
  const yearsToTry = [fallbackYear, fallbackYear - 1, fallbackYear - 2, fallbackYear - 3];

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

    // 3. Fetch pitch-by-pitch data from statcast_search (for spray chart + pitch mix)
    const pbpCacheKey = `pbp:${type}:${playerId}:${year}`;
    const pbpData = await getOrSet(pbpCacheKey, 300_000, async () => {
      return await fetchStatcastPBP(playerId, type, year);
    });

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
      type,
      year,
      sprayChart: pbpData.sprayChart,
      pitchMix: pbpData.pitchMix,
      barrelData: pbpData.barrelData,
      totalPitches: pbpData.totalPitches,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}

/**
 * Fetch pitch-by-pitch data from Baseball Savant's statcast_search CSV endpoint.
 * Extracts spray chart coordinates, pitch mix, and barrel data.
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

  // Build spray chart (balls in play with coordinates)
  const sprayChart: any[] = [];
  const pitchTypeMap = new Map<string, { count: number; speeds: number[]; spins: number[] }>();
  let barrelCount = 0;
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
    // Spray chart: only balls in play with hc_x/hc_y
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

      if (isBarrel) {
        totalBarrels++;
        barrelCount++;
      }

      sprayChart.push({
        x: hcX,
        y: hcY,
        launchSpeed: !isNaN(launchSpeed) ? launchSpeed : null,
        launchAngle: !isNaN(launchAngle) ? launchAngle : null,
        distance: !isNaN(dist) ? dist : null,
        event,
        isBarrel,
        estimatedBA: parseFloat(r.estimated_ba_using_speedangle) || null,
        estimatedWOBA: parseFloat(r.estimated_woba_using_speedangle) || null,
      });
    }

    // Pitch mix
    const pitchName = r.pitch_name || r.pitch_type || "";
    if (pitchName) {
      if (!pitchTypeMap.has(pitchName)) {
        pitchTypeMap.set(pitchName, { count: 0, speeds: [], spins: [] });
      }
      const pt = pitchTypeMap.get(pitchName)!;
      pt.count++;
      const spd = parseFloat(r.release_speed);
      if (!isNaN(spd)) pt.speeds.push(spd);
      const spin = parseFloat(r.release_spin_rate);
      if (!isNaN(spin)) pt.spins.push(spin);
    }
  }

  // Build pitch mix array
  const totalPitches = rows.length;
  const pitchMix = Array.from(pitchTypeMap.entries())
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      percentage: (stats.count / totalPitches) * 100,
      avgSpeed: stats.speeds.length > 0 ? stats.speeds.reduce((a: number, b: number) => a + b, 0) / stats.speeds.length : 0,
      avgSpin: stats.spins.length > 0 ? stats.spins.reduce((a: number, b: number) => a + b, 0) / stats.spins.length : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Barrel data summary
  const barrelData = {
    totalBIP,
    totalBarrels,
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
