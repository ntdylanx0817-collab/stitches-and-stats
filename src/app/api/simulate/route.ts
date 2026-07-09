import { NextRequest, NextResponse } from "next/server";
import { fetchLeaderboard } from "@/lib/mlb-api";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export interface SimulationResult {
  batterId: number;
  batterName: string;
  pitcherId: number;
  pitcherName: string;
  year: number;
  iterations: number;
  outcomes: {
    strikeout: number;      // K
    walk: number;            // BB
    hitByPitch: number;      // HBP
    single: number;          // 1B
    double: number;          // 2B
    triple: number;          // 3B
    homeRun: number;         // HR
    outInPlay: number;       // OUT (groundout, flyout, lineout)
  };
  probabilities: {
    strikeout: number;
    walk: number;
    hitByPitch: number;
    single: number;
    double: number;
    triple: number;
    homeRun: number;
    outInPlay: number;
    onBase: number;          // BB + HBP + 1B + 2B + 3B + HR
    sluggingEvents: number;  // 1B + 2B*2 + 3B*3 + HR*4 (total bases per PA)
    expectedBA: number;      // (1B + 2B + 3B + HR) / PA
    expectedOBP: number;     // onBase / PA
    expectedSLG: number;     // sluggingEvents / PA
    expectedOPS: number;     // OBP + SLG
  };
  batterStats: {
    kPercent: number;
    bbPercent: number;
    battingAvg: number;
    slg: number;
    obp: number;
    woba: number;
    xwoba: number;
    barrelPercent: number;
    hardHitPercent: number;
    avgExitVelo: number;
  };
  pitcherStats: {
    kPercent: number;
    bbPercent: number;
    era: number;
    whip: number;
    avg: number;
    xwoba: number;
    barrelPercent: number;
    hardHitPercent: number;
    avgExitVelo: number;
  };
  matchupInsight: string;
}

/**
 * Batter-vs-Pitcher matchup simulator.
 *
 * Uses a "combined rates" model — a standard sabermetric approach where the
 * expected rate for an outcome is the geometric mean of the batter's and
 * pitcher's rates, adjusted toward the league average.
 *
 *   expectedRate = sqrt(batterRate * pitcherRate)
 *
 * For balls in play, we use exit velocity and barrel % to estimate the
 * distribution of hit types (single, double, triple, home run).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const batterId = Number(sp.get("batterId"));
  const pitcherId = Number(sp.get("pitcherId"));
  const iterations = Math.min(Number(sp.get("iterations")) || 10000, 50000);

  if (!batterId || !pitcherId) {
    return NextResponse.json(
      { error: "batterId and pitcherId are required" },
      { status: 400 }
    );
  }

  try {
    // Determine the current season
    const now = new Date();
    const month = now.getMonth();
    const currentYear = now.getFullYear();
    const inSeason = month >= 2 && month <= 10;
    const fallbackYear = inSeason ? currentYear : currentYear - 1;

    // Fetch both leaderboards (batters and pitchers) for the current season
    const [batterLb, pitcherLb] = await Promise.all([
      fetchLeaderboard({ type: "batter", year: fallbackYear, min: 1 }),
      fetchLeaderboard({ type: "pitcher", year: fallbackYear, min: 1 }),
    ]);

    // Find the batter and pitcher in their respective leaderboards
    const batter = batterLb.find((r) => r.player_id === batterId);
    const pitcher = pitcherLb.find((r) => r.player_id === pitcherId);

    if (!batter) {
      return NextResponse.json({ error: "Batter not found in current season leaderboard" }, { status: 404 });
    }
    if (!pitcher) {
      return NextResponse.json({ error: "Pitcher not found in current season leaderboard" }, { status: 404 });
    }

    // Extract batter stats
    const bK = Number(batter.k_percent) || 22;          // K%
    const bBB = Number(batter.bb_percent) || 8;         // BB%
    const bAVG = Number(batter.batting_avg) || 0.250;
    const bSLG = Number(batter.slg_percent) || 0.400;
    const bOBP = Number(batter.on_base_percent) || 0.320;
    const bBarrel = Number(batter.barrel_brea) || 7;
    const bHardHit = Number(batter.hard_hit_percent) || 38;
    const bExitVelo = Number(batter.avg_hit_speed) || 88;
    const bHR = Number(batter.home_run) || 0;
    const bPA = Number(batter.pa) || 1;

    // Extract pitcher stats (note: pitcher fields don't use p_ prefix for most stats)
    const pK = Number(pitcher.k_percent) || 22;
    const pBB = Number(pitcher.bb_percent) || 8;
    const pAVG = Number(pitcher.avg) || 0.250;
    const pBarrel = Number(pitcher.barrel_brea) || 7;
    const pHardHit = Number(pitcher.hard_hit_percent) || 38;
    const pExitVelo = Number(pitcher.avg_hit_speed) || 88;

    // ===== COMBINED RATES (geometric mean model) =====
    // Expected K% = sqrt(batterK% * pitcherK%)
    // Rates are in percent (e.g. 17.4, 48.6). Convert to decimal, take geometric mean, convert back.
    const expK = Math.sqrt((bK / 100) * (pK / 100)) * 100;
    // Expected BB% = sqrt(batterBB% * pitcherBB%)
    const expBB = Math.sqrt((bBB / 100) * (pBB / 100)) * 100;
    // HBP is small, estimate at ~1%
    const expHBP = 1.0;

    // Contact rate = 100% - K% - BB% - HBP%
    const contactRate = Math.max(0, 100 - expK - expBB - expHBP);

    // ===== HIT DISTRIBUTION ON CONTACT =====
    // Use the batter's and pitcher's combined stats to estimate hit type
    // probabilities on balls in play (excluding K, BB, HBP).

    // Combined batting average on contact
    const combinedAVG = (Number(bAVG) + Number(pAVG)) / 2;
    // Combined barrel % (batter's barrel tendency vs pitcher's barrel allowance)
    const combinedBarrel = Math.sqrt((bBarrel * pBarrel) / 100) * 100;
    // Combined hard-hit %
    const combinedHardHit = Math.sqrt((bHardHit * pHardHit) / 100) * 100;
    // Combined exit velocity
    const combinedExitVelo = (bExitVelo + pExitVelo) / 2;

    // Home run rate on contact: driven by barrel % and exit velocity
    // League average HR/contact ≈ 4.5%. Scale with barrel%.
    const hrOnContact = Math.max(0.5, Math.min(15, combinedBarrel * 0.5));

    // Extra-base hit rates on contact (doubles + triples)
    // Higher exit velocity → more extra-base hits
    const doubleOnContact = Math.max(2, Math.min(10, (combinedExitVelo - 85) * 0.4 + 4));
    const tripleOnContact = Math.max(0.2, Math.min(2, (combinedExitVelo - 88) * 0.05 + 0.5));

    // Single rate: remaining hits after HR, 2B, 3B
    const hitOnContact = combinedAVG * 100; // batting avg approximates hit % on contact
    const singleOnContact = Math.max(0, hitOnContact - hrOnContact - doubleOnContact - tripleOnContact);

    // Out rate on contact = 100% - all hit types
    const outOnContact = Math.max(0, 100 - singleOnContact - doubleOnContact - tripleOnContact - hrOnContact);

    // ===== CONVERT TO PER-PA PROBABILITIES =====
    // All rates above are "per contact". Multiply by contactRate/100 to get per-PA.
    const pStrikeout = expK / 100;
    const pWalk = expBB / 100;
    const pHBP = expHBP / 100;
    const contactFrac = contactRate / 100;
    const pSingle = (singleOnContact / 100) * contactFrac;
    const pDouble = (doubleOnContact / 100) * contactFrac;
    const pTriple = (tripleOnContact / 100) * contactFrac;
    const pHomeRun = (hrOnContact / 100) * contactFrac;
    const pOut = (outOnContact / 100) * contactFrac;

    // ===== MONTE CARLO SIMULATION =====
    const outcomes = {
      strikeout: 0,
      walk: 0,
      hitByPitch: 0,
      single: 0,
      double: 0,
      triple: 0,
      homeRun: 0,
      outInPlay: 0,
    };

    // Use a seeded random for reproducibility per matchup
    let seed = (batterId * 1000 + pitcherId) % 2147483647;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    for (let i = 0; i < iterations; i++) {
      const r = rand();
      let cumulative = 0;
      cumulative += pStrikeout;
      if (r < cumulative) { outcomes.strikeout++; continue; }
      cumulative += pWalk;
      if (r < cumulative) { outcomes.walk++; continue; }
      cumulative += pHBP;
      if (r < cumulative) { outcomes.hitByPitch++; continue; }
      cumulative += pSingle;
      if (r < cumulative) { outcomes.single++; continue; }
      cumulative += pDouble;
      if (r < cumulative) { outcomes.double++; continue; }
      cumulative += pTriple;
      if (r < cumulative) { outcomes.triple++; continue; }
      cumulative += pHomeRun;
      if (r < cumulative) { outcomes.homeRun++; continue; }
      outcomes.outInPlay++;
    }

    // ===== COMPUTE PROBABILITIES AND EXPECTED STATS =====
    const probs = {
      strikeout: outcomes.strikeout / iterations,
      walk: outcomes.walk / iterations,
      hitByPitch: outcomes.hitByPitch / iterations,
      single: outcomes.single / iterations,
      double: outcomes.double / iterations,
      triple: outcomes.triple / iterations,
      homeRun: outcomes.homeRun / iterations,
      outInPlay: outcomes.outInPlay / iterations,
    };

    const onBase = probs.walk + probs.hitByPitch + probs.single + probs.double + probs.triple + probs.homeRun;
    const hits = probs.single + probs.double + probs.triple + probs.homeRun;
    const totalBases = probs.single + probs.double * 2 + probs.triple * 3 + probs.homeRun * 4;

    const expectedBA = hits;
    const expectedOBP = onBase;
    const expectedSLG = totalBases;
    const expectedOPS = expectedOBP + expectedSLG;

    // ===== MATCHUP INSIGHT =====
    let insight = "";
    const batterAdvantage = expectedOPS - (Number(bOBP) + Number(bSLG));
    if (expK > 28) {
      insight = `This is a strikeout-heavy matchup. ${pitcher.player_name} and ${batter.player_name} combine for a ${(expK).toFixed(1)}% strikeout rate — expect a lot of swings and misses.`;
    } else if (expectedOPS > 0.850) {
      insight = `${batter.player_name} has the edge here. The projected OPS of ${expectedOPS.toFixed(3)} suggests this matchup favors the batter.`;
    } else if (expectedOPS < 0.650) {
      insight = `${pitcher.player_name} has the edge here. The projected OPS of ${expectedOPS.toFixed(3)} suggests this matchup favors the pitcher.`;
    } else if (combinedExitVelo >= 92) {
      insight = `When contact is made, expect hard-hit balls. Combined average exit velocity is ${combinedExitVelo.toFixed(1)} mph — look for extra-base hits.`;
    } else if (combinedBarrel >= 10) {
      insight = `High barrel potential in this matchup (${combinedBarrel.toFixed(1)}% combined barrel rate). Danger of home runs.`;
    } else {
      insight = `This looks like an even matchup. Projected OPS of ${expectedOPS.toFixed(3)} is near league average.`;
    }

    const result: SimulationResult = {
      batterId,
      batterName: batter.player_name,
      pitcherId,
      pitcherName: pitcher.player_name,
      year: fallbackYear,
      iterations,
      outcomes,
      probabilities: {
        ...probs,
        onBase,
        sluggingEvents: totalBases,
        expectedBA,
        expectedOBP,
        expectedSLG,
        expectedOPS,
      },
      batterStats: {
        kPercent: bK,
        bbPercent: bBB,
        battingAvg: bAVG,
        slg: bSLG,
        obp: bOBP,
        woba: Number(batter.woba) || 0,
        xwoba: Number(batter.xwoba) || 0,
        barrelPercent: bBarrel,
        hardHitPercent: bHardHit,
        avgExitVelo: bExitVelo,
      },
      pitcherStats: {
        kPercent: pK,
        bbPercent: pBB,
        era: Number(pitcher.p_era) || 0,
        whip: Number(pitcher.p_whip) || 0,
        avg: pAVG,
        xwoba: Number(pitcher.xwoba) || 0,
        barrelPercent: pBarrel,
        hardHitPercent: pHardHit,
        avgExitVelo: pExitVelo,
      },
      matchupInsight: insight,
    };

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
