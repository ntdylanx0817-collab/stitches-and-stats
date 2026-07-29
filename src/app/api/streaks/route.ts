import { NextResponse } from "next/server";
import { getOrSet } from "@/lib/cache";
import { assertOk, errorResponse } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const STATS_API = "https://statsapi.mlb.com/api";

interface StreakEntry {
  type: "team_win" | "team_loss" | "player_hit" | "player_hr";
  name: string;
  abbr?: string;
  id: number;
  streak: number;
  streakType: string;
  description: string;
}

export async function GET() {
  const season = new Date().getFullYear();
  const cacheKey = `streaks:${season}`;
  try {
    const data = await getOrSet(cacheKey, 300_000, async () => {
      const url = `${STATS_API}/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      await assertOk(res, "standings");
      const sched = await res.json();

      const streaks: StreakEntry[] = [];

      for (const record of sched?.records ?? []) {
        for (const t of record.teamRecords ?? []) {
          const streakCode = t.streak?.streakCode ?? "";
          const streakNum = t.streak?.streakNumber ?? 0;
          const streakType = t.streak?.streakType ?? "";
          const team = t.team ?? {};

          if (streakNum >= 3) {
            streaks.push({
              type: streakType === "wins" ? "team_win" : "team_loss",
              name: team.name ?? "Unknown",
              abbr: team.abbreviation ?? "???",
              id: team.id ?? 0,
              streak: streakNum,
              streakType: streakCode,
              description: `${team.name} — ${streakCode} ${streakType === "wins" ? "win" : "loss"} streak`,
            });
          }
        }
      }

      // Sort by streak length descending
      streaks.sort((a, b) => b.streak - a.streak);

      return {
        season,
        streaks: streaks.slice(0, 20),
        total: streaks.length,
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
