import { NextRequest, NextResponse } from "next/server";
import { getOrSet } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 120;

interface FastestPitch {
  playId: string;
  pitcherName: string;
  pitcherId: number;
  batterName: string;
  batterId: number;
  team: string;
  pitchType: string;
  pitchName: string;
  velocity: number;
  spinRate: number;
  result: string;
  inning: number;
  date: string;
}

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 25, 100);
  const minVel = Number(req.nextUrl.searchParams.get("minVel")) || 95;

  const cacheKey = `fastest-pitches:${minVel}`;
  const data = await getOrSet(cacheKey, 120_000, async () => {
    const url = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&player_type=pitcher&season=2026&min_pas=0&hfGT=R%7C&fields=player_name%2Cpitcher%2Cbatter%2Cplayer_name%2Cevents%2Cdescription%2Cinning%2Cteam_batting%2Cteam_fielding%2Crelease_speed%2Crelease_spin_rate%2Cpitch_name%2Cpitch_type%2Cgame_date%2Cgame_pk%2Cplay_id&sort=release_speed&order=desc`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        "Accept": "text/csv, */*",
        "Referer": "https://baseballsavant.mlb.com/statcast_search",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!res.ok) return { date: "", total: 0, entries: [], fastest: null };

    const csv = await res.text();
    const rows = parseCSV(csv);
    const entries: FastestPitch[] = [];

    for (const r of rows.slice(0, 500)) {
      const vel = parseFloat(r.release_speed);
      if (isNaN(vel) || vel < minVel) continue;

      entries.push({
        playId: r.play_id || `${r.pitcher}-${r.inning}-${Math.random()}`,
        pitcherName: r.player_name || "Unknown",
        pitcherId: parseInt(r.pitcher) || 0,
        batterName: "",
        batterId: parseInt(r.batter) || 0,
        team: r.team_fielding || "",
        pitchType: r.pitch_type || "",
        pitchName: r.pitch_name || "",
        velocity: vel,
        spinRate: parseFloat(r.release_spin_rate) || 0,
        result: r.events || r.description || "",
        inning: parseInt(r.inning) || 0,
        date: r.game_date || "",
      });
    }

    entries.sort((a, b) => b.velocity - a.velocity);

    return {
      date: entries[0]?.date || "",
      total: entries.length,
      entries: entries.slice(0, limit),
      fastest: entries[0] || null,
    };
  });

  return NextResponse.json(data);
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
