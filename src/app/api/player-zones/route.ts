import { NextRequest, NextResponse } from "next/server";
import { getOrSet } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export interface ZoneData {
  zone: number;
  count: number;
  hits: number;
  avgExitVelo: number;
  battingAvg: number;
  slg: number;
  isHot: boolean;
  isCold: boolean;
}

export interface PlayerZoneData {
  playerId: number;
  playerName: string;
  type: "batter" | "pitcher";
  season: number;
  totalPitches: number;
  zones: ZoneData[];
}

/**
 * Fetch REAL pitch-by-pitch zone data from Baseball Savant's statcast_search
 * CSV endpoint. Returns zone-level aggregation for a batter or pitcher.
 *
 * For batters: shows hot/cold zones based on batting avg and exit velocity by zone
 * For pitchers: shows pitch location tendency and opponent results by zone
 */
async function fetchPlayerZones(
  playerId: number,
  type: "batter" | "pitcher",
  season: number
): Promise<PlayerZoneData | null> {
  const cacheKey = `zones:${type}:${playerId}:${season}`;
  return getOrSet(cacheKey, 300_000, async () => {
    // Baseball Savant's statcast_search CSV endpoint requires the player ID
    // in the batters_lookup[] or pitchers_lookup[] parameter, not player_id.
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
      throw new Error(`statcast fetch failed: ${res.status}`);
    }

    const csv = await res.text();
    const rows = parseCSV(csv);
    if (rows.length === 0) return null;

    const zoneMap = new Map<number, {
      count: number;
      hits: number;
      totalBases: number;
      totalEv: number;
      evCount: number;
      atBats: number;
    }>();

    let playerName = "";
    for (const r of rows) {
      const zone = parseInt(r.zone);
      if (isNaN(zone)) continue;

      if (!playerName) {
        playerName = type === "batter" ? (r.player_name || r.batter || "") : (r.player_name || r.pitcher || "");
      }

      if (!zoneMap.has(zone)) {
        zoneMap.set(zone, { count: 0, hits: 0, totalBases: 0, totalEv: 0, evCount: 0, atBats: 0 });
      }
      const z = zoneMap.get(zone)!;
      z.count++;

      const event = r.events || "";
      const isHit = ["single", "double", "triple", "home_run"].includes(event);
      const isOut = ["field_out", "strikeout", "grounded_into_double_play", "double_play", "fielders_choice", "force_out", "sac_fly", "sac_bunt"].includes(event);

      if (isHit) {
        z.hits++;
        z.totalBases += event === "single" ? 1 : event === "double" ? 2 : event === "triple" ? 3 : 4;
      }
      if (isHit || isOut) {
        z.atBats++;
      }

      const ev = parseFloat(r.launch_speed);
      if (!isNaN(ev)) {
        z.totalEv += ev;
        z.evCount++;
      }
    }

    // Calculate averages for hot/cold detection
    const inZoneZones = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const inZoneData = inZoneZones.map(z => zoneMap.get(z)).filter(Boolean);
    const avgHitRate = inZoneData.length > 0
      ? inZoneData.reduce((sum, z) => sum + (z!.atBats > 0 ? z!.hits / z!.atBats : 0), 0) / inZoneData.length
      : 0.250;
    const avgEv = inZoneData.length > 0
      ? inZoneData.reduce((sum, z) => sum + (z!.evCount > 0 ? z!.totalEv / z!.evCount : 0), 0) / inZoneData.length
      : 88;

    const zones: ZoneData[] = [];
    for (let z = 1; z <= 14; z++) {
      if (z === 10) continue;
      const data = zoneMap.get(z);
      if (!data) {
        zones.push({
          zone: z, count: 0, hits: 0, avgExitVelo: 0,
          battingAvg: 0, slg: 0, isHot: false, isCold: false,
        });
        continue;
      }

      const battingAvg = data.atBats > 0 ? data.hits / data.atBats : 0;
      const slg = data.atBats > 0 ? data.totalBases / data.atBats : 0;
      const avgExitVelo = data.evCount > 0 ? data.totalEv / data.evCount : 0;

      const isHot = inZoneZones.includes(z) && battingAvg > avgHitRate * 1.2 && avgExitVelo > avgEv + 2;
      const isCold = inZoneZones.includes(z) && battingAvg < avgHitRate * 0.6 && avgExitVelo < avgEv - 2;

      zones.push({
        zone: z,
        count: data.count,
        hits: data.hits,
        avgExitVelo,
        battingAvg,
        slg,
        isHot,
        isCold,
      });
    }

    return {
      playerId,
      playerName,
      type,
      season,
      totalPitches: rows.length,
      zones,
    };
  });
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

export async function GET(req: NextRequest) {
  const playerId = Number(req.nextUrl.searchParams.get("playerId"));
  const type = (req.nextUrl.searchParams.get("type") as "batter" | "pitcher") ?? "batter";
  const season = Number(req.nextUrl.searchParams.get("season")) || new Date().getFullYear();

  if (!playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  try {
    const data = await fetchPlayerZones(playerId, type, season);
    if (!data) {
      return NextResponse.json({ error: "No zone data found for this player" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
