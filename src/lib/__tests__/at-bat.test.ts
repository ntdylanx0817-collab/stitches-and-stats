import { test, expect, describe } from "bun:test";
import {
  atBatResult, isAtBatComplete, groupPitchesByAtBat, latestAtBatIndex, halfInningLabel,
  pinTargetForStep,
} from "@/lib/at-bat";
import type { EnrichedPitch } from "@/lib/types";

/** Build a pitch with just the fields the at-bat helpers actually read. */
function pitch(overrides: Partial<EnrichedPitch> = {}): EnrichedPitch {
  return {
    atBatIndex: 0,
    inning: 1,
    halfInning: "top",
    pitchNumber: 1,
    isPitch: true,
    batterName: "Batter",
    pitcherName: "Pitcher",
    description: "",
    playResult: "",
    isStrike: false,
    isBall: false,
    isInPlay: false,
    balls: 0,
    strikes: 0,
    outs: 0,
    homeScore: 0,
    awayScore: 0,
    ...overrides,
  };
}

describe("atBatResult", () => {
  test("returns null while the at-bat is in progress", () => {
    expect(atBatResult([pitch(), pitch({ pitchNumber: 2, strikes: 1 })])).toBeNull();
  });

  test("reads the play result off any pitch of a finished play", () => {
    const pitches = [pitch({ playResult: "Strikeout" }), pitch({ pitchNumber: 2, playResult: "Strikeout" })];
    expect(atBatResult(pitches)).toBe("Strikeout");
  });

  test("falls back to the Savant result when the MLB play lags", () => {
    expect(atBatResult([pitch({ result: "Single" })])).toBe("Single");
  });

  test("prefers the MLB play result over the Savant one", () => {
    expect(atBatResult([pitch({ playResult: "Home Run", result: "single" })])).toBe("Home Run");
  });

  test("ignores whitespace-only results", () => {
    expect(atBatResult([pitch({ playResult: "   " })])).toBeNull();
  });

  test("returns null for an empty at-bat", () => {
    expect(atBatResult([])).toBeNull();
  });
});

describe("isAtBatComplete", () => {
  test("an at-bat with no pitches is not complete", () => {
    expect(isAtBatComplete([])).toBe(false);
  });

  test("a 0-2 count mid-at-bat is not complete", () => {
    expect(isAtBatComplete([pitch({ isStrike: true, strikes: 2 })])).toBe(false);
  });

  test("a foul at two strikes does not end the at-bat", () => {
    const pitches = [
      pitch({ pitchNumber: 1, isStrike: true, strikes: 1 }),
      pitch({ pitchNumber: 2, isStrike: true, strikes: 2 }),
      pitch({ pitchNumber: 3, call: "F", isStrike: true, strikes: 2 }),
    ];
    expect(isAtBatComplete(pitches)).toBe(false);
  });

  test("a recorded result ends the at-bat", () => {
    expect(isAtBatComplete([pitch({ playResult: "Walk", balls: 4 })])).toBe(true);
  });

  test("a ball in play ends the at-bat even without result text", () => {
    expect(isAtBatComplete([pitch({ isInPlay: true })])).toBe(true);
  });
});

describe("groupPitchesByAtBat", () => {
  test("groups by at-bat and sorts oldest at-bat first", () => {
    const groups = groupPitchesByAtBat([
      pitch({ atBatIndex: 2, pitchNumber: 1 }),
      pitch({ atBatIndex: 0, pitchNumber: 1 }),
      pitch({ atBatIndex: 1, pitchNumber: 1 }),
    ]);
    expect(groups.map((g) => g.atBatIndex)).toEqual([0, 1, 2]);
  });

  test("sorts pitches within an at-bat into throw order", () => {
    // The feed hands pitches over newest-first.
    const groups = groupPitchesByAtBat([
      pitch({ pitchNumber: 3 }),
      pitch({ pitchNumber: 1 }),
      pitch({ pitchNumber: 2 }),
    ]);
    expect(groups[0].pitches.map((p) => p.pitchNumber)).toEqual([1, 2, 3]);
  });

  test("carries the matchup and half-inning from the first pitch", () => {
    const groups = groupPitchesByAtBat([
      pitch({ pitchNumber: 2, batterName: "Judge", pitcherName: "Cole", inning: 7, halfInning: "bottom" }),
      pitch({ pitchNumber: 1, batterName: "Judge", pitcherName: "Cole", inning: 7, halfInning: "bottom" }),
    ]);
    expect(groups[0]).toMatchObject({
      batterName: "Judge",
      pitcherName: "Cole",
      inning: 7,
      halfInning: "bottom",
    });
  });

  test("marks completion and result per at-bat", () => {
    const groups = groupPitchesByAtBat([
      pitch({ atBatIndex: 0, pitchNumber: 1, playResult: "Strikeout" }),
      pitch({ atBatIndex: 1, pitchNumber: 1 }),
    ]);
    expect(groups[0]).toMatchObject({ isComplete: true, result: "Strikeout" });
    expect(groups[1]).toMatchObject({ isComplete: false, result: null });
  });

  test("returns an empty list for no pitches", () => {
    expect(groupPitchesByAtBat([])).toEqual([]);
  });
});

describe("latestAtBatIndex", () => {
  test("returns the highest index regardless of input order", () => {
    expect(latestAtBatIndex([pitch({ atBatIndex: 4 }), pitch({ atBatIndex: 11 }), pitch({ atBatIndex: 7 })])).toBe(11);
  });

  test("returns null when there are no pitches", () => {
    expect(latestAtBatIndex([])).toBeNull();
  });

  test("treats at-bat index 0 as a real index, not a missing one", () => {
    expect(latestAtBatIndex([pitch({ atBatIndex: 0 })])).toBe(0);
  });
});

describe("halfInningLabel", () => {
  test("abbreviates each half", () => {
    expect(halfInningLabel("top", 5)).toBe("Top 5");
    expect(halfInningLabel("bottom", 9)).toBe("Bot 9");
  });
});

describe("pinTargetForStep", () => {
  // Three at-bats, 7 being the live one.
  const groups = groupPitchesByAtBat([
    pitch({ atBatIndex: 5, playResult: "Strikeout" }),
    pitch({ atBatIndex: 6, playResult: "Single" }),
    pitch({ atBatIndex: 7 }),
  ]);

  test("stepping back pins the earlier at-bat", () => {
    expect(pinTargetForStep(groups, 2, -1, 7)).toBe(6);
  });

  test("stepping forward onto the live at-bat resumes following instead of pinning", () => {
    expect(pinTargetForStep(groups, 1, 1, 7)).toBeNull();
  });

  test("stepping forward short of the live at-bat still pins", () => {
    expect(pinTargetForStep(groups, 0, 1, 7)).toBe(6);
  });

  test("a step off either end moves nothing", () => {
    expect(pinTargetForStep(groups, 0, -1, 7)).toBeUndefined();
    expect(pinTargetForStep(groups, 2, 1, 7)).toBeUndefined();
  });

  test("a finished game has no live at-bat, so the last at-bat pins normally", () => {
    expect(pinTargetForStep(groups, 1, 1, null)).toBe(7);
  });
});
