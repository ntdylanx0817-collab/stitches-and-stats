import { NextResponse } from "next/server";
import { fetchLeaderboard } from "@/lib/mlb-api";
import { getOrSet } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 300;

interface FunFact {
  text: string;
  playerName?: string;
  playerId?: number;
  stat?: string;
  category: "power" | "speed" | "contact" | "pitching" | "fun" | "barrel" | "discipline";
}

export async function GET() {
  const cacheKey = "fun-fact:pool";
  const facts = await getOrSet(cacheKey, 300_000, async () => {
    return await generateFacts();
  });

  // Pick a random fact
  const randomFact = facts[Math.floor(Math.random() * facts.length)] ?? null;

  return NextResponse.json({ fact: randomFact, total: facts.length });
}

async function generateFacts(): Promise<FunFact[]> {
  const now = new Date();
  const month = now.getMonth();
  const currentYear = now.getFullYear();
  const inSeason = month >= 2 && month <= 10;
  const fallbackYear = inSeason ? currentYear : currentYear - 1;

  try {
    const [batters, pitchers] = await Promise.all([
      fetchLeaderboard({ type: "batter", year: fallbackYear, min: 100 }),
      fetchLeaderboard({ type: "pitcher", year: fallbackYear, min: 50 }),
    ]);

    const facts: FunFact[] = [];

    // Power facts (batters)
    const sortedByHR = [...batters].sort((a, b) => Number(b.home_run) - Number(a.home_run));
    if (sortedByHR[0]?.home_run) {
      facts.push({
        text: `${sortedByHR[0].player_name} leads MLB with ${sortedByHR[0].home_run} home runs this season.`,
        playerName: sortedByHR[0].player_name,
        playerId: sortedByHR[0].player_id,
        stat: "home_run",
        category: "power",
      });
    }

    // Avg EV facts
    const sortedByEV = [...batters].filter(b => Number(b.avg_hit_speed) > 0).sort((a, b) => Number(b.avg_hit_speed) - Number(a.avg_hit_speed));
    if (sortedByEV[0]?.avg_hit_speed) {
      const ev = Number(sortedByEV[0].avg_hit_speed);
      facts.push({
        text: `${sortedByEV[0].player_name} has the hardest average contact in baseball at ${ev.toFixed(1)} mph exit velocity.`,
        playerName: sortedByEV[0].player_name,
        playerId: sortedByEV[0].player_id,
        stat: "avg_hit_speed",
        category: "barrel",
      });
    }

    // Max EV
    const sortedByMaxEV = [...batters].filter(b => Number(b.max_hit_speed) > 0).sort((a, b) => Number(b.max_hit_speed) - Number(a.max_hit_speed));
    if (sortedByMaxEV[0]?.max_hit_speed) {
      facts.push({
        text: `${sortedByMaxEV[0].player_name} has the highest max exit velocity at ${Number(sortedByMaxEV[0].max_hit_speed).toFixed(1)} mph — the hardest-hit ball in MLB.`,
        playerName: sortedByMaxEV[0].player_name,
        playerId: sortedByMaxEV[0].player_id,
        stat: "max_hit_speed",
        category: "barrel",
      });
    }

    // Barrel%
    const sortedByBarrel = [...batters].filter(b => Number(b.barrel_brea) > 0).sort((a, b) => Number(b.barrel_brea) - Number(a.barrel_brea));
    if (sortedByBarrel[0]?.barrel_brea) {
      facts.push({
        text: `${sortedByBarrel[0].player_name} has the highest barrel rate at ${Number(sortedByBarrel[0].barrel_brea).toFixed(1)}% — elite hard contact on every swing.`,
        playerName: sortedByBarrel[0].player_name,
        playerId: sortedByBarrel[0].player_id,
        stat: "barrel_brea",
        category: "barrel",
      });
    }

    // xwOBA leader
    const sortedByXwOBA = [...batters].filter(b => Number(b.xwoba) > 0).sort((a, b) => Number(b.xwoba) - Number(a.xwoba));
    if (sortedByXwOBA[0]?.xwoba) {
      facts.push({
        text: `${sortedByXwOBA[0].player_name} has the highest xwOBA (${Number(sortedByXwOBA[0].xwoba).toFixed(3).replace(/^0/, "")}) — the best expected offensive production in baseball.`,
        playerName: sortedByXwOBA[0].player_name,
        playerId: sortedByXwOBA[0].player_id,
        stat: "xwoba",
        category: "contact",
      });
    }

    // K% leader (worst)
    const sortedByK = [...batters].filter(b => Number(b.k_percent) > 0).sort((a, b) => Number(b.k_percent) - Number(a.k_percent));
    if (sortedByK[0]?.k_percent) {
      facts.push({
        text: `${sortedByK[0].player_name} strikes out ${Number(sortedByK[0].k_percent).toFixed(1)}% of the time — the highest K rate among qualified hitters.`,
        playerName: sortedByK[0].player_name,
        playerId: sortedByK[0].player_id,
        stat: "k_percent",
        category: "discipline",
      });
    }

    // BB% leader (best)
    const sortedByBB = [...batters].filter(b => Number(b.bb_percent) > 0).sort((a, b) => Number(b.bb_percent) - Number(a.bb_percent));
    if (sortedByBB[0]?.bb_percent) {
      facts.push({
        text: `${sortedByBB[0].player_name} has the best eye in baseball with a ${Number(sortedByBB[0].bb_percent).toFixed(1)}% walk rate.`,
        playerName: sortedByBB[0].player_name,
        playerId: sortedByBB[0].player_id,
        stat: "bb_percent",
        category: "discipline",
      });
    }

    // Pitching ERA leader
    const sortedByERA = [...pitchers].filter(p => Number(p.p_era) > 0).sort((a, b) => Number(a.p_era) - Number(b.p_era));
    if (sortedByERA[0]?.p_era) {
      facts.push({
        text: `${sortedByERA[0].player_name} leads MLB with a ${Number(sortedByERA[0].p_era).toFixed(2)} ERA — the best run prevention in baseball.`,
        playerName: sortedByERA[0].player_name,
        playerId: sortedByERA[0].player_id,
        stat: "p_era",
        category: "pitching",
      });
    }

    // League average facts
    const avgEVs = batters.map(b => Number(b.avg_hit_speed)).filter(v => !isNaN(v) && v > 0);
    if (avgEVs.length > 10) {
      const leagueAvg = avgEVs.reduce((a, b) => a + b, 0) / avgEVs.length;
      facts.push({
        text: `The average MLB exit velocity is ${leagueAvg.toFixed(1)} mph across ${avgEVs.length} qualified hitters this season.`,
        category: "fun",
      });
    }

    const avgKs = batters.map(b => Number(b.k_percent)).filter(v => !isNaN(v) && v > 0);
    if (avgKs.length > 10) {
      const leagueAvgK = avgKs.reduce((a, b) => a + b, 0) / avgKs.length;
      facts.push({
        text: `The average MLB hitter strikes out ${leagueAvgK.toFixed(1)}% of the time — that's nearly 1 in every 4 plate appearances.`,
        category: "discipline",
      });
    }

    const avgBarrels = batters.map(b => Number(b.barrel_brea)).filter(v => !isNaN(v) && v > 0);
    if (avgBarrels.length > 10) {
      const leagueAvgBarrel = avgBarrels.reduce((a, b) => a + b, 0) / avgBarrels.length;
      facts.push({
        text: `Only ${leagueAvgBarrel.toFixed(1)}% of balls in play are "barrels" — the sweet spot of exit velocity and launch angle that produces the most damage.`,
        category: "barrel",
      });
    }

    return facts;
  } catch {
    return [
      { text: "Aaron Judge hit 62 home runs in 2022, breaking the AL single-season record.", category: "fun" as const },
      { text: "The average MLB fastball velocity has increased from 91 mph in 2008 to over 94 mph today.", category: "fun" as const },
      { text: "A 'barrel' is a ball hit with the ideal combination of exit velocity (98+ mph) and launch angle (6-34°) that produces at least a .500 batting average and 1.500 slugging.", category: "barrel" as const },
    ];
  }
}
