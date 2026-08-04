import { test, expect, describe } from "bun:test";
import {
  isValidYmd, localYmd, shiftYmd, daysBetween, defaultRecapDate, recapDayLabel,
  slateIsSettled, msUntilHour, parseInningsPitched, teamAbbr,
  hitterDayScore, pitcherDayScore, rankHitters, rankPitchers, sumStat,
  formatHitterLine, formatPitcherLine,
  classifyInjuryTransaction, buildInjuryReport, summarizeSlate,
  type HittingSplitStat, type PitchingSplitStat, type StatSplit,
  type RawTransaction, type RecapGame,
} from "@/lib/recap";

describe("isValidYmd", () => {
  test("accepts a real date", () => {
    expect(isValidYmd("2025-08-03")).toBe(true);
  });

  test("rejects malformed input", () => {
    expect(isValidYmd("2025-8-3")).toBe(false);
    expect(isValidYmd("not-a-date")).toBe(false);
    expect(isValidYmd("")).toBe(false);
  });

  test("rejects a day that does not exist in its month", () => {
    expect(isValidYmd("2025-02-30")).toBe(false);
    expect(isValidYmd("2025-13-01")).toBe(false);
  });

  test("accepts leap day in a leap year and rejects it otherwise", () => {
    expect(isValidYmd("2024-02-29")).toBe(true);
    expect(isValidYmd("2025-02-29")).toBe(false);
  });
});

describe("localYmd", () => {
  test("formats from the local calendar, zero-padded", () => {
    expect(localYmd(new Date(2025, 0, 5))).toBe("2025-01-05");
    expect(localYmd(new Date(2025, 11, 31))).toBe("2025-12-31");
  });

  test("reads the local day even late at night, when UTC has already rolled over", () => {
    // In any timezone behind UTC this instant is already "tomorrow" in UTC.
    // The recap follows the viewer's calendar, so it must not.
    const lateLocal = new Date(2025, 7, 3, 23, 30);
    expect(localYmd(lateLocal)).toBe("2025-08-03");
  });
});

describe("shiftYmd", () => {
  test("steps forward and back", () => {
    expect(shiftYmd("2025-08-03", -1)).toBe("2025-08-02");
    expect(shiftYmd("2025-08-03", 1)).toBe("2025-08-04");
  });

  test("crosses month and year boundaries", () => {
    expect(shiftYmd("2025-03-01", -1)).toBe("2025-02-28");
    expect(shiftYmd("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftYmd("2025-01-01", -1)).toBe("2024-12-31");
    expect(shiftYmd("2025-12-31", 1)).toBe("2026-01-01");
  });

  test("a zero shift is the identity", () => {
    expect(shiftYmd("2025-08-03", 0)).toBe("2025-08-03");
  });
});

describe("daysBetween", () => {
  test("counts forward and backward", () => {
    expect(daysBetween("2025-08-03", "2025-08-04")).toBe(1);
    expect(daysBetween("2025-08-04", "2025-08-03")).toBe(-1);
    expect(daysBetween("2025-08-03", "2025-08-03")).toBe(0);
  });

  test("is unaffected by a DST transition in the middle", () => {
    // US DST springs forward on 2025-03-09. A naive millisecond division that
    // ran through local time would return 0.958 days for this pair.
    expect(daysBetween("2025-03-08", "2025-03-10")).toBe(2);
  });
});

describe("defaultRecapDate", () => {
  test("opens on yesterday", () => {
    expect(defaultRecapDate("2025-08-04")).toBe("2025-08-03");
  });
});

describe("recapDayLabel", () => {
  test("names the two days that have names", () => {
    expect(recapDayLabel("2025-08-04", "2025-08-04")).toBe("Today");
    expect(recapDayLabel("2025-08-03", "2025-08-04")).toBe("Yesterday");
  });

  test("spells out anything older", () => {
    expect(recapDayLabel("2025-08-02", "2025-08-04")).toBe("Saturday, Aug 2");
  });
});

describe("slateIsSettled", () => {
  const slate = "2025-08-03";

  test("is false while the slate's own night is still running", () => {
    expect(slateIsSettled(slate, new Date(2025, 7, 3, 22, 0))).toBe(false);
    expect(slateIsSettled(slate, new Date(2025, 7, 4, 1, 30))).toBe(false);
  });

  test("flips at 5am the next morning", () => {
    expect(slateIsSettled(slate, new Date(2025, 7, 4, 4, 59))).toBe(false);
    expect(slateIsSettled(slate, new Date(2025, 7, 4, 5, 0))).toBe(true);
  });

  test("stays true for older slates", () => {
    expect(slateIsSettled(slate, new Date(2025, 7, 9, 12, 0))).toBe(true);
  });
});

describe("msUntilHour", () => {
  test("counts to later today when the hour has not passed", () => {
    expect(msUntilHour(new Date(2025, 7, 4, 3, 0), 5)).toBe(2 * 3_600_000);
  });

  test("rolls to tomorrow once the hour has passed", () => {
    expect(msUntilHour(new Date(2025, 7, 4, 6, 0), 5)).toBe(23 * 3_600_000);
  });

  test("exactly on the hour counts to the next day, never zero", () => {
    expect(msUntilHour(new Date(2025, 7, 4, 5, 0), 5)).toBe(24 * 3_600_000);
  });
});

describe("parseInningsPitched", () => {
  test("reads the decimal as thirds of an inning, not tenths", () => {
    expect(parseInningsPitched("6.2")).toBeCloseTo(6 + 2 / 3, 6);
    expect(parseInningsPitched("0.1")).toBeCloseTo(1 / 3, 6);
    expect(parseInningsPitched("7.0")).toBe(7);
  });

  test("a partial inning still outranks the whole inning below it", () => {
    expect(parseInningsPitched("6.2")).toBeGreaterThan(parseInningsPitched("6.0"));
    expect(parseInningsPitched("6.2")).toBeLessThan(parseInningsPitched("7.0"));
  });

  test("accepts numbers as well as strings", () => {
    expect(parseInningsPitched(5)).toBe(5);
    expect(parseInningsPitched(5.1)).toBeCloseTo(5 + 1 / 3, 6);
  });

  test("returns zero for missing or nonsense values", () => {
    expect(parseInningsPitched(undefined)).toBe(0);
    expect(parseInningsPitched(null)).toBe(0);
    expect(parseInningsPitched("")).toBe(0);
    expect(parseInningsPitched("abc")).toBe(0);
    expect(parseInningsPitched(-3)).toBe(0);
  });
});

describe("teamAbbr", () => {
  test("maps a known team id", () => {
    expect(teamAbbr(147)).toBe("NYY");
  });

  test("falls back for unknown or missing ids", () => {
    expect(teamAbbr(99999)).toBe("—");
    expect(teamAbbr(null)).toBe("—");
    expect(teamAbbr(undefined)).toBe("—");
  });
});

describe("hitterDayScore", () => {
  test("a three-homer game outranks a four-single game", () => {
    const bombs: HittingSplitStat = { atBats: 4, hits: 3, homeRuns: 3, rbi: 6, runs: 3, totalBases: 12 };
    const singles: HittingSplitStat = { atBats: 4, hits: 4, rbi: 1, runs: 1, totalBases: 4 };
    expect(hitterDayScore(bombs)).toBeGreaterThan(hitterDayScore(singles));
  });

  test("derives total bases when the feed omits them", () => {
    const withField: HittingSplitStat = { atBats: 4, hits: 2, doubles: 1, totalBases: 3 };
    const without: HittingSplitStat = { atBats: 4, hits: 2, doubles: 1 };
    expect(hitterDayScore(without)).toBe(hitterDayScore(withField));
  });

  test("an empty line scores zero", () => {
    expect(hitterDayScore({})).toBe(0);
  });
});

describe("pitcherDayScore", () => {
  test("a shutout outranks a win with five runs allowed", () => {
    const gem: PitchingSplitStat = { inningsPitched: "9.0", strikeOuts: 11, earnedRuns: 0, hits: 3, baseOnBalls: 1, wins: 1 };
    const grind: PitchingSplitStat = { inningsPitched: "5.0", strikeOuts: 3, earnedRuns: 5, hits: 9, baseOnBalls: 4, wins: 1 };
    expect(pitcherDayScore(gem)).toBeGreaterThan(pitcherDayScore(grind));
  });

  test("a blown-up relief outing scores below zero", () => {
    expect(pitcherDayScore({ inningsPitched: "0.1", earnedRuns: 5, hits: 4, baseOnBalls: 2 })).toBeLessThan(0);
  });
});

describe("formatHitterLine", () => {
  test("leads with the hit line and lists only filled categories", () => {
    expect(formatHitterLine({ atBats: 4, hits: 3, homeRuns: 2, rbi: 5, runs: 3 }))
      .toBe("3-4, 2 HR, 5 RBI, 3 R");
  });

  test("an 0-fer is just the hit line", () => {
    expect(formatHitterLine({ atBats: 4, hits: 0 })).toBe("0-4");
  });
});

describe("formatPitcherLine", () => {
  test("always shows innings, earned runs, and strikeouts", () => {
    expect(formatPitcherLine({ inningsPitched: "7.0", earnedRuns: 0, strikeOuts: 11 }))
      .toBe("7.0 IP, 0 ER, 11 K");
  });

  test("adds walks and a save when present", () => {
    expect(formatPitcherLine({ inningsPitched: "1.0", earnedRuns: 0, strikeOuts: 2, baseOnBalls: 1, saves: 1 }))
      .toBe("1.0 IP, 0 ER, 2 K, 1 BB, SV");
  });
});

describe("rankHitters", () => {
  const splits: StatSplit<HittingSplitStat>[] = [
    { player: { id: 1, fullName: "Quiet Day" }, team: { id: 147 }, stat: { atBats: 4, hits: 1, totalBases: 1 } },
    { player: { id: 2, fullName: "Big Fly" }, team: { id: 147 }, stat: { atBats: 4, hits: 3, homeRuns: 2, rbi: 5, runs: 3, totalBases: 9 } },
    { player: { id: 3, fullName: "Pinch Runner" }, team: { id: 111 }, stat: { atBats: 0, plateAppearances: 0, runs: 1 } },
  ];

  test("orders by the day score", () => {
    const ranked = rankHitters(splits, 10);
    expect(ranked[0].name).toBe("Big Fly");
    expect(ranked[0].line).toBe("3-4, 2 HR, 5 RBI, 3 R");
  });

  test("drops anyone who never came to the plate", () => {
    expect(rankHitters(splits, 10).map((h) => h.name)).not.toContain("Pinch Runner");
  });

  test("resolves the team abbreviation", () => {
    expect(rankHitters(splits, 10)[0].teamAbbr).toBe("NYY");
  });

  test("honours the limit", () => {
    expect(rankHitters(splits, 1)).toHaveLength(1);
  });

  test("skips splits with no player or no stat block", () => {
    expect(rankHitters([{ stat: { atBats: 4, hits: 4 } }, { player: { id: 9 } }], 10)).toHaveLength(0);
  });
});

describe("rankPitchers", () => {
  const splits: StatSplit<PitchingSplitStat>[] = [
    { player: { id: 1, fullName: "Long Man" }, team: { id: 147 }, stat: { inningsPitched: "3.0", strikeOuts: 2, earnedRuns: 3, hits: 5 } },
    { player: { id: 2, fullName: "Ace" }, team: { id: 147 }, stat: { inningsPitched: "8.0", strikeOuts: 12, earnedRuns: 0, hits: 2, wins: 1, gamesStarted: 1 } },
    { player: { id: 3, fullName: "Did Not Pitch" }, team: { id: 111 }, stat: { inningsPitched: "0.0" } },
  ];

  test("orders by the day score and marks starters", () => {
    const ranked = rankPitchers(splits, 10);
    expect(ranked[0].name).toBe("Ace");
    expect(ranked[0].started).toBe(true);
    expect(ranked[0].line).toBe("8.0 IP, 0 ER, 12 K");
  });

  test("drops anyone who did not throw", () => {
    expect(rankPitchers(splits, 10).map((p) => p.name)).not.toContain("Did Not Pitch");
  });

  test("keeps a pitcher who faced a batter without recording an out", () => {
    const ranked = rankPitchers(
      [{ player: { id: 4, fullName: "Yanked" }, stat: { inningsPitched: "0.0", battersFaced: 3, earnedRuns: 2 } }],
      10
    );
    expect(ranked).toHaveLength(1);
  });
});

describe("sumStat", () => {
  test("adds one field across splits, ignoring gaps", () => {
    const splits: StatSplit<HittingSplitStat>[] = [
      { stat: { homeRuns: 2 } },
      { stat: { homeRuns: 1 } },
      { stat: {} },
      {},
    ];
    expect(sumStat(splits, "homeRuns")).toBe(3);
  });

  test("is zero for an empty slate", () => {
    expect(sumStat([] as StatSplit<HittingSplitStat>[], "hits")).toBe(0);
  });
});

describe("classifyInjuryTransaction", () => {
  const base: RawTransaction = {
    id: 1,
    person: { id: 10, fullName: "Sore Arm" },
    team: { id: 147, name: "New York Yankees" },
    date: "2025-08-03",
    typeCode: "SC",
  };

  test("reads a placement as a trip to the IL and captures the length", () => {
    const entry = classifyInjuryTransaction(
      { ...base, description: "New York Yankees placed RHP Sore Arm on the 15-day injured list. Right elbow inflammation." },
      0
    );
    expect(entry?.move).toBe("to-il");
    expect(entry?.listLabel).toBe("15-day IL");
    expect(entry?.teamAbbr).toBe("NYY");
  });

  test("reads an activation as a return", () => {
    const entry = classifyInjuryTransaction(
      { ...base, description: "New York Yankees activated CF Sore Arm from the 10-day injured list." },
      0
    );
    expect(entry?.move).toBe("activated");
  });

  test("treats a reinstatement as an activation too", () => {
    const entry = classifyInjuryTransaction(
      { ...base, description: "New York Yankees reinstated LHP Sore Arm from the 60-day injured list." },
      0
    );
    expect(entry?.move).toBe("activated");
  });

  test("reads a 60-day move as a transfer", () => {
    const entry = classifyInjuryTransaction(
      { ...base, description: "New York Yankees transferred RHP Sore Arm from the 15-day injured list to the 60-day injured list." },
      0
    );
    expect(entry?.move).toBe("transferred");
  });

  test("ignores roster moves that are not injuries", () => {
    expect(classifyInjuryTransaction({ ...base, description: "New York Yankees optioned RHP Sore Arm to Scranton." }, 0)).toBeNull();
    expect(classifyInjuryTransaction({ ...base, description: "New York Yankees traded RHP Sore Arm to the Chicago Cubs." }, 0)).toBeNull();
    expect(classifyInjuryTransaction({ ...base, description: "New York Yankees placed C Sore Arm on the paternity list." }, 0)).toBeNull();
  });

  test("ignores an empty description", () => {
    expect(classifyInjuryTransaction({ ...base, description: "   " }, 0)).toBeNull();
    expect(classifyInjuryTransaction({ ...base }, 0)).toBeNull();
  });

  test("falls back to a positional id when the feed omits one", () => {
    const entry = classifyInjuryTransaction(
      { person: { id: 10 }, description: "Placed on the 10-day injured list." },
      4
    );
    expect(entry?.id).toBe("10-4");
    expect(entry?.playerName).toBe("Unknown player");
  });

  test("labels a move plainly when no length is given", () => {
    const entry = classifyInjuryTransaction({ ...base, description: "Placed on the injured list." }, 0);
    expect(entry?.listLabel).toBe("IL");
  });
});

describe("buildInjuryReport", () => {
  test("leads with players going out and ends with players coming back", () => {
    const report = buildInjuryReport([
      { id: 1, person: { fullName: "Back" }, team: { id: 147 }, description: "Activated from the 10-day injured list." },
      { id: 2, person: { fullName: "Out" }, team: { id: 147 }, description: "Placed on the 10-day injured list." },
      { id: 3, person: { fullName: "Nothing" }, team: { id: 147 }, description: "Signed as a free agent." },
    ]);
    expect(report.map((r) => r.playerName)).toEqual(["Out", "Back"]);
  });

  test("is empty when nothing injury-related happened", () => {
    expect(buildInjuryReport([{ description: "Recalled RHP X from Triple-A." }])).toHaveLength(0);
    expect(buildInjuryReport([])).toHaveLength(0);
  });
});

describe("summarizeSlate", () => {
  function game(over: Partial<RecapGame> = {}): RecapGame {
    return {
      gamePk: 1,
      state: "Final",
      detailedState: "Final",
      gameDate: "2025-08-03T17:00:00Z",
      innings: 9,
      isExtras: false,
      away: { id: 147, abbr: "NYY", name: "Yankees", score: 3, isWinner: false },
      home: { id: 111, abbr: "BOS", name: "Red Sox", score: 4, isWinner: true },
      ...over,
    };
  }

  test("counts games by state", () => {
    const totals = summarizeSlate([
      game(),
      game({ gamePk: 2, state: "Live" }),
      game({ gamePk: 3, state: "Preview", away: { id: 147, abbr: "NYY", name: "Yankees", score: null, isWinner: false }, home: { id: 111, abbr: "BOS", name: "Red Sox", score: null, isWinner: false } }),
    ]);
    expect(totals).toMatchObject({ games: 3, final: 1, live: 1, scheduled: 1 });
  });

  test("adds up runs and flags close, long, and lopsided games", () => {
    const totals = summarizeSlate([
      game(),
      game({ gamePk: 2, isExtras: true, innings: 11 }),
      game({
        gamePk: 3,
        away: { id: 147, abbr: "NYY", name: "Yankees", score: 0, isWinner: false },
        home: { id: 111, abbr: "BOS", name: "Red Sox", score: 8, isWinner: true },
      }),
    ]);
    expect(totals.runs).toBe(3 + 4 + 3 + 4 + 0 + 8);
    expect(totals.extraInnings).toBe(1);
    expect(totals.oneRunGames).toBe(2);
    expect(totals.shutouts).toBe(1);
  });

  test("does not score a game that has not been decided", () => {
    const totals = summarizeSlate([
      game({
        state: "Live",
        away: { id: 147, abbr: "NYY", name: "Yankees", score: 0, isWinner: false },
        home: { id: 111, abbr: "BOS", name: "Red Sox", score: 0, isWinner: false },
      }),
    ]);
    expect(totals.shutouts).toBe(0);
    expect(totals.oneRunGames).toBe(0);
    expect(totals.runs).toBe(0);
  });

  test("skips games with no score posted yet", () => {
    const totals = summarizeSlate([
      game({
        state: "Preview",
        away: { id: 147, abbr: "NYY", name: "Yankees", score: null, isWinner: false },
        home: { id: 111, abbr: "BOS", name: "Red Sox", score: null, isWinner: false },
      }),
    ]);
    expect(totals.runs).toBe(0);
    expect(totals.games).toBe(1);
  });

  test("an empty slate is all zeroes", () => {
    expect(summarizeSlate([])).toMatchObject({ games: 0, final: 0, runs: 0 });
  });
});
