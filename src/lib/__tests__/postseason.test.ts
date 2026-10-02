import { describe, expect, test } from "bun:test";
import {
  assessBullpenAvailability,
  buildSeriesScenario,
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

describe("buildSeriesScenario", () => {
  test("marks a winner-take-all game as elimination for both clubs", () => {
    const scenario = buildSeriesScenario("Yankees", "Dodgers", 3, 3, 4);
    expect(scenario.headline).toBe("Winner advances");
    expect(scenario.isEliminationGame).toBe(true);
    expect(scenario.teamAStatus).toBe("Win and advance");
    expect(scenario.teamBStatus).toBe("Win and advance");
  });

  test("explains a clinch chance and must-win game", () => {
    const scenario = buildSeriesScenario("Yankees", "Dodgers", 2, 1, 3);
    expect(scenario.headline).toBe("Yankees can clinch");
    expect(scenario.teamAStatus).toBe("1 win to advance");
    expect(scenario.teamBStatus).toBe("Must win next");
    expect(scenario.isEliminationGame).toBe(true);
  });

  test("reports the winner of a completed series", () => {
    const scenario = buildSeriesScenario("Yankees", "Dodgers", 4, 2, 4);
    expect(scenario.headline).toBe("Yankees advance");
    expect(scenario.teamAStatus).toBe("Advanced");
    expect(scenario.teamBStatus).toBe("Eliminated");
    expect(scenario.isEliminationGame).toBe(false);
  });
});

describe("assessBullpenAvailability", () => {
  test("flags a heavily used arm as limited", () => {
    expect(assessBullpenAvailability({
      pitchesLastGame: 24,
      pitchesLast2Days: 41,
      appearancesLast3Days: 2,
      daysSinceLastAppearance: 0,
    }).availability).toBe("Limited");
  });

  test("marks a reliever who worked yesterday for monitoring", () => {
    expect(assessBullpenAvailability({
      pitchesLastGame: 12,
      pitchesLast2Days: 12,
      appearancesLast3Days: 1,
      daysSinceLastAppearance: 1,
    }).availability).toBe("Monitor");
  });

  test("treats an unused arm as fresh without claiming team confirmation", () => {
    const result = assessBullpenAvailability({
      pitchesLastGame: 0,
      pitchesLast2Days: 0,
      appearancesLast3Days: 0,
      daysSinceLastAppearance: null,
    });
    expect(result.availability).toBe("Fresh");
    expect(result.reason).toContain("three-day window");
  });
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
