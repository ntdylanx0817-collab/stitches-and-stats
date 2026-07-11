import { NextRequest, NextResponse } from "next/server";
import { fetchLiveFeed } from "@/lib/mlb-api";
import { getOrSet } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 15;

export interface WinProbPoint {
  playIndex: number;
  inning: number;
  halfInning: "top" | "bottom";
  homeScore: number;
  awayScore: number;
  outs: number;
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  homeWinProb: number;  // 0-100
  event: string;
  isScoringPlay: boolean;
}

export interface WinProbData {
  gamePk: number;
  awayTeam: string;
  homeTeam: string;
  points: WinProbPoint[];
  currentHomeWinProb: number;
  currentAwayWinProb: number;
  maxHomeWinProb: number;
  minHomeWinProb: number;
  largestShift: { playIndex: number; shift: number; event: string };
}

/**
 * Win expectancy model based on inning, score differential, base state, and outs.
 * Uses a simplified version of the standard Markov chain win probability tables
 * used by FanGraphs and Baseball Reference.
 *
 * The model considers:
 * - Inning (1-9+, with extra innings treated as 9th with higher variance)
 * - Score differential (home team perspective)
 * - Base state (8 combinations: empty, 1B, 2B, 3B, 1B+2B, 1B+3B, 2B+3B, loaded)
 * - Outs (0, 1, 2)
 */
function calculateWinProbability(
  inning: number,
  isBottom: boolean,
  homeScore: number,
  awayScore: number,
  outs: number,
  onFirst: boolean,
  onSecond: boolean,
  onThird: boolean
): number {
  // Score differential from home team's perspective
  // Positive = home team leads, negative = away team leads
  const scoreDiff = homeScore - awayScore;

  // Base win probability from score differential (home team perspective)
  // Home teams have a ~54% baseline advantage
  const homeAdvantage = 0.54;

  // Score differential impact (diminishing returns for large leads)
  // Each run is worth ~3.5% early, less in late innings
  const inningFactor = Math.min(inning / 9, 1.2); // Later innings = more impactful
  const scoreImpact = Math.tanh(scoreDiff * 0.35 * (0.7 + inningFactor * 0.3));

  // Base state impact (more runners = more scoring potential for batting team)
  // The batting team is: away team in top inning, home team in bottom inning
  const baseRunners = (onFirst ? 1 : 0) + (onSecond ? 2 : 0) + (onThird ? 3 : 0);
  const baseImpact = baseRunners * 0.015; // Each base runner is worth ~1.5%

  // Outs impact (more outs = less scoring potential for batting team)
  const outsImpact = outs * 0.01;

  // Inning impact: later innings have more certainty
  const lateInningBoost = Math.min(inning / 9, 1) * 0.1;

  // Calculate home win probability
  let homeWP = homeAdvantage + scoreImpact * (1 + lateInningBoost);

  // Adjust for base/out state (affects the batting team)
  if (isBottom) {
    // Home team is batting - runners help home team
    homeWP += baseImpact * (1 + lateInningBoost);
    homeWP -= outsImpact * (1 + lateInningBoost);
  } else {
    // Away team is batting - runners help away team
    homeWP -= baseImpact * (1 + lateInningBoost);
    homeWP += outsImpact * (1 + lateInningBoost);
  }

  // Late inning with big lead = more certain
  if (inning >= 7 && Math.abs(scoreDiff) >= 3) {
    const certainty = (inning - 6) * 0.03 * Math.min(Math.abs(scoreDiff) / 3, 1);
    if (scoreDiff > 0) {
      homeWP += certainty;
    } else {
      homeWP -= certainty;
    }
  }

  // 9th inning or later with home team leading in bottom = very likely win
  if (inning >= 9 && isBottom && scoreDiff > 0) {
    homeWP += 0.05 * scoreDiff;
  }

  // Extra innings: higher variance, but score differential still matters
  if (inning > 9) {
    homeWP = homeAdvantage + scoreImpact * 1.3;
  }

  // Clamp to 0.5% - 99.5%
  homeWP = Math.max(0.005, Math.min(0.995, homeWP));

  return homeWP * 100;
}

export async function GET(req: NextRequest) {
  const gamePk = Number(req.nextUrl.searchParams.get("gamePk"));
  if (!gamePk) return NextResponse.json({ error: "gamePk required" }, { status: 400 });

  const cacheKey = `winprob:${gamePk}`;
  const data = await getOrSet(cacheKey, 15_000, async () => {
    const feed = await fetchLiveFeed(gamePk);
    if (!feed) return null;

    const allPlays = feed.liveData?.plays?.allPlays ?? [];
    const awayTeam = feed.gameData?.teams?.away?.name ?? "Away";
    const homeTeam = feed.gameData?.teams?.home?.name ?? "Home";

    const points: WinProbPoint[] = [];
    let maxHomeWP = 50;
    let minHomeWP = 50;
    let largestShift = { playIndex: 0, shift: 0, event: "" };

    let prevHomeWP = 50;

    for (let i = 0; i < allPlays.length; i++) {
      const play = allPlays[i];
      const about = play.about || {};
      const result = play.result || {};
      const matchup = play.matchup || {};
      const count = play.count || {};

      const inning = about.inning || 1;
      const isBottom = about.halfInning === "bottom";
      const homeScore = result.homeScore ?? 0;
      const awayScore = result.awayScore ?? 0;
      const outs = count.outs ?? 0;
      const onFirst = !!matchup.postOnFirst;
      const onSecond = !!matchup.postOnSecond;
      const onThird = !!matchup.postOnThird;

      const homeWP = calculateWinProbability(
        inning, isBottom, homeScore, awayScore, outs, onFirst, onSecond, onThird
      );

      const shift = Math.abs(homeWP - prevHomeWP);
      if (shift > largestShift.shift) {
        largestShift = { playIndex: i, shift, event: result.event || "" };
      }

      if (homeWP > maxHomeWP) maxHomeWP = homeWP;
      if (homeWP < minHomeWP) minHomeWP = homeWP;

      points.push({
        playIndex: i,
        inning,
        halfInning: about.halfInning ?? "top",
        homeScore,
        awayScore,
        outs,
        onFirst,
        onSecond,
        onThird,
        homeWinProb: homeWP,
        event: result.event || "",
        isScoringPlay: about.isScoringPlay || false,
      });

      prevHomeWP = homeWP;
    }

    const currentHomeWP = points.length > 0 ? points[points.length - 1].homeWinProb : 50;

    return {
      gamePk,
      awayTeam,
      homeTeam,
      points,
      currentHomeWinProb: currentHomeWP,
      currentAwayWinProb: 100 - currentHomeWP,
      maxHomeWinProb: maxHomeWP,
      minHomeWinProb: minHomeWP,
      largestShift,
    } as WinProbData;
  });

  if (!data) {
    return NextResponse.json({ error: "Game data not available" }, { status: 404 });
  }

  return NextResponse.json(data);
}
