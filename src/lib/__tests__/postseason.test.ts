import { describe, expect, test } from "bun:test";
import {
  predictPostseasonGame,
  seriesWinProbability,
  type PostseasonTeam,
  type PostseasonPitcher,
} from "../postseason";

const team = (overrides: Partial<PostseasonTeam>): PostseasonTeam => ({
  id: 1,
  name: "Club",
  abbreviation: "CLB",
  wins: 81,
  losses: 81,
  pct: 0.5,
  runDifferential: 0,
  league: "American League",
  ...overrides,
});

const pitcher = (overrides: Partial<PostseasonPitcher>): PostseasonPitcher => ({
  id: 10,
  name: "Starter",
  era: 4,
  whip: 1.3,
  strikeoutsPer9: 8.5,
  inningsPitched: "170.0",
  ...overrides,
});

describe("predictPostseasonGame", () => {
  test("gives an otherwise even matchup a modest home-field edge", () => {
    const result = predictPostseasonGame({
      away: team({ id: 1, abbreviation: "AWY" }),
      home: team({ id: 2, abbreviation: "HME" }),
    });
    expect(result.homeWinProbability).toBe(53);
    expect(result.pitcherAdjusted).toBe(false);
  });

  test("moves the estimate toward the club with the clearly better starter", () => {
    const baseline = predictPostseasonGame({
      away: team({ id: 1, abbreviation: "AWY" }),
      home: team({ id: 2, abbreviation: "HME" }),
    });
    const adjusted = predictPostseasonGame({
      away: team({ id: 1, abbreviation: "AWY" }),
      home: team({ id: 2, abbreviation: "HME" }),
      awayPitcher: pitcher({ name: "Ace", era: 2.1, whip: 0.98, strikeoutsPer9: 11.2 }),
      homePitcher: pitcher({ name: "Opponent", era: 4.8, whip: 1.46, strikeoutsPer9: 7.1 }),
    });
    expect(adjusted.awayWinProbability).toBeGreaterThan(baseline.awayWinProbability);
    expect(adjusted.pitcherAdjusted).toBe(true);
  });

  test("caps an estimate so the UI never presents baseball as certain", () => {
    const result = predictPostseasonGame({
      away: team({ id: 1, wins: 120, losses: 42, pct: 0.741, runDifferential: 400 }),
      home: team({ id: 2, wins: 60, losses: 102, pct: 0.37, runDifferential: -400 }),
      awayPitcher: pitcher({ era: 1, whip: 0.7, strikeoutsPer9: 14 }),
      homePitcher: pitcher({ era: 8, whip: 2, strikeoutsPer9: 4 }),
    });
    expect(result.awayWinProbability).toBe(76);
  });
});

describe("seriesWinProbability", () => {
  test("an even fresh best-of-five is exactly even", () => {
    expect(seriesWinProbability(0.5, 0, 0, 3)).toBeCloseTo(0.5, 8);
  });

  test("a 2-0 lead in a best-of-five creates a large but not certain edge", () => {
    const probability = seriesWinProbability(0.5, 2, 0, 3);
    expect(probability).toBeCloseTo(0.875, 8);
  });

  test("returns terminal series states without further projection", () => {
    expect(seriesWinProbability(0.4, 4, 2, 4)).toBe(1);
    expect(seriesWinProbability(0.6, 2, 4, 4)).toBe(0);
  });
});
