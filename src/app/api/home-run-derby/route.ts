import { NextRequest, NextResponse } from "next/server";
import { getOrSet } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 120;

interface HomeRunEntry {
  playId: string;
  batterName: string;
  batterId: number;
  pitcherName: string;
  pitcherId: number;
  team: string;
  opponent: string;
  exitVelocity: number;
  launchAngle: number;
  distance: number;
  inning: number;
  date: string;
  description: string;
  isBarrel: boolean;
}

/**
 * Fetch today's hardest-hit balls across all MLB games using
 * Baseball Savant's statcast_search CSV endpoint.
 * Returns home runs and hardest-hit balls sorted by exit velocity.
 */
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 25, 100);
  const minEV = Number(req.nextUrl.searchParams.get("minEV")) || 90;

  const cacheKey = `hr-derby:${minEV}`;
  const data = await getOrSet(cacheKey, 120_000, async () => {
    const today = new Date().toISOString().split("T")[0];
    const url = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&player_type=batter&season=2026&min_pas=0&hfGT=R%7C&game_date_gt=${today}&game_date_lt=${today}&fields=player_name%2Cbatter%2Cpitcher%2Cevents%2Cdescription%2Cinning%2Cteam_batting%2Cteam_fielding%2Claunch_speed%2Claunch_angle%2Chit_distance_sc%2Cis_barrel%2Cpitch_name%2Cgame_pk%2Cplay_id`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        "Accept": "text/csv, */*",
        "Referer": "https://baseballsavant.mlb.com/statcast_search",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      // Fallback: get hardest-hit balls from recent games without date filter
      return await fetchFallback(minEV);
    }

    const csv = await res.text();
    const rows = parseCSV(csv);
    if (rows.length === 0) {
      return await fetchFallback(minEV);
    }

    const entries: HomeRunEntry[] = [];
    for (const r of rows) {
      const ev = parseFloat(r.launch_speed);
      if (isNaN(ev) || ev < minEV) continue;

      const event = r.events || "";
      const isHR = event === "home_run";
      const isBarrel = r.is_barrel === "true" || r.is_barrel === "True";

      // Only include balls in play (not strikeouts, walks, etc.)
      if (!isHR && !isBarrel && ev < 100) continue;

      entries.push({
        playId: r.play_id || `${r.batter}-${r.inning}-${Math.random()}`,
        batterName: r.player_name || "Unknown",
        batterId: parseInt(r.batter) || 0,
        pitcherName: "", // Not in batter-type search
        pitcherId: parseInt(r.pitcher) || 0,
        team: r.team_batting || "",
        opponent: r.team_fielding || "",
        exitVelocity: ev,
        launchAngle: parseFloat(r.launch_angle) || 0,
        distance: parseFloat(r.hit_distance_sc) || 0,
        inning: parseInt(r.inning) || 0,
        date: today,
        description: r.description || event,
        isBarrel,
      });
    }

    // Sort by exit velocity descending
    entries.sort((a, b) => b.exitVelocity - a.exitVelocity);

    // If no entries for today, fall back to recent hardest-hit balls
    if (entries.length === 0) {
      return await fetchFallback(minEV);
    }

    return {
      date: today,
      total: entries.length,
      entries: entries.slice(0, limit),
      hardest: entries[0] || null,
    };
  });

  return NextResponse.json(data);
}

/** Fallback: fetch recent hardest-hit balls without date filter */
async function fetchFallback(minEV: number) {
  try {
    const url = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&player_type=batter&season=2026&min_pas=0&hfGT=R%7C&fields=player_name%2Cbatter%2Cpitcher%2Cevents%2Cdescription%2Cinning%2Cteam_batting%2Cteam_fielding%2Claunch_speed%2Claunch_angle%2Chit_distance_sc%2Cis_barrel%2Cgame_date%2Cplay_id&sort=launch_speed&order=desc`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        "Accept": "text/csv, */*",
        "Referer": "https://baseballsavant.mlb.com/statcast_search",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!res.ok) return { date: "", total: 0, entries: [], hardest: null };

    const csv = await res.text();
    const rows = parseCSV(csv);
    const entries: HomeRunEntry[] = [];

    for (const r of rows.slice(0, 200)) {
      const ev = parseFloat(r.launch_speed);
      if (isNaN(ev) || ev < minEV) continue;

      const event = r.events || "";
      const isBarrel = r.is_barrel === "true" || r.is_barrel === "True";
      if (!isBarrel && ev < 100) continue;

      entries.push({
        playId: r.play_id || `${r.batter}-${r.inning}-${Math.random()}`,
        batterName: r.player_name || "Unknown",
        batterId: parseInt(r.batter) || 0,
        pitcherName: "",
        pitcherId: parseInt(r.pitcher) || 0,
        team: r.team_batting || "",
        opponent: r.team_fielding || "",
        exitVelocity: ev,
        launchAngle: parseFloat(r.launch_angle) || 0,
        distance: parseFloat(r.hit_distance_sc) || 0,
        inning: parseInt(r.inning) || 0,
        date: r.game_date || "",
        description: r.description || event,
        isBarrel,
      });
    }

    entries.sort((a, b) => b.exitVelocity - a.exitVelocity);

    return {
      date: entries[0]?.date || "",
      total: entries.length,
      entries: entries.slice(0, 25),
      hardest: entries[0] || null,
    };
  } catch {
    return { date: "", total: 0, entries: [], hardest: null };
  }
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
