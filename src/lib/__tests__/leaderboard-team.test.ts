import { test, expect, describe } from "bun:test";
import { parseLeaderboardCSV } from "@/lib/mlb-api";
import { resolveTeamId } from "@/lib/team-colors";

describe("resolveTeamId", () => {
  test("accepts a numeric team id, as a number or a string", () => {
    expect(resolveTeamId(147)).toBe(147);
    expect(resolveTeamId("147")).toBe(147);
  });

  test("accepts an abbreviation, case-insensitively", () => {
    expect(resolveTeamId("NYY")).toBe(147);
    expect(resolveTeamId("nyy")).toBe(147);
    expect(resolveTeamId(" TB ")).toBe(139);
  });

  test("accepts a bare or full team name", () => {
    expect(resolveTeamId("Yankees")).toBe(147);
    expect(resolveTeamId("New York Yankees")).toBe(147);
    expect(resolveTeamId("Boston Red Sox")).toBe(111);
  });

  test("returns null rather than guessing when nothing matches", () => {
    // A wrong team colour is worse than none, so unknown input must not
    // fall through to a default.
    for (const v of [null, undefined, "", "   ", "ZZZ", "Not A Team", 9999]) {
      expect(resolveTeamId(v)).toBeNull();
    }
  });
});

describe("parseLeaderboardCSV team normalisation", () => {
  const row = (header: string, values: string) => parseLeaderboardCSV(`${header}\n${values}`)[0];

  test("picks up whichever team column Savant returned", () => {
    expect(row("player_id,team_name_alt", "592450,NYY").team).toBe("NYY");
    expect(row("player_id,team_name", "592450,Yankees").team).toBe("Yankees");
    expect(row("player_id,team_id", "592450,147").team).toBe(147);
    expect(row("player_id,team", "592450,NYY").team).toBe("NYY");
  });

  test("prefers the earlier candidate when several are present", () => {
    expect(row("player_id,team_name_alt,team_name", "592450,NYY,Yankees").team).toBe("NYY");
  });

  test("leaves team unset when the column is absent or blank", () => {
    expect(row("player_id,woba", "592450,0.42").team).toBeUndefined();
    expect(row("player_id,team_name", "592450,").team).toBeUndefined();
  });

  test("still parses every other column when no team is present", () => {
    // The whole point of the fallback: losing team data must not lose the rest.
    const r = row("player_id,player_name,woba", '592450,"Judge, Aaron",0.42');
    expect(r.player_id).toBe(592450);
    // Number(): the row type declares woba as a string, but the parser
    // coerces numeric cells, so the runtime value here is 0.42 the number.
    expect(Number(r.woba)).toBe(0.42);
    expect(r.team).toBeUndefined();
  });

  test("normalised team resolves to a usable id for each returned form", () => {
    for (const [header, value, expected] of [
      ["player_id,team_name_alt", "592450,NYY", 147],
      ["player_id,team_name", "592450,Red Sox", 111],
      ["player_id,team_id", "592450,139", 139],
    ] as const) {
      expect(resolveTeamId(row(header, value).team)).toBe(expected);
    }
  });
});

describe("fetchLeaderboard team-column fallback", () => {
  const CSV = 'player_id,player_name,woba\n592450,"Judge, Aaron",0.42\n';
  const originalFetch = globalThis.fetch;

  /** Run fetchLeaderboard against a stubbed fetch, recording every URL tried. */
  async function run(handler: (url: string, attempt: number) => Response, opts: object) {
    const { fetchLeaderboard } = await import("@/lib/mlb-api");
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      return handler(url, urls.length);
    }) as unknown as typeof fetch;
    try {
      const rows = await fetchLeaderboard(opts);
      return { rows, urls };
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  const ok = () => new Response(CSV, { status: 200 });
  const boom = () => new Response("bad selection", { status: 400 });
  const hasTeamCols = (url: string) => decodeURIComponent(url).includes("team_name_alt");

  test("asks for the team columns on the first attempt", async () => {
    // Distinct opts per test: fetchLeaderboard memoises on its arguments.
    const { rows, urls } = await run(ok, { year: 2001, min: 1 });
    expect(urls).toHaveLength(1);
    expect(hasTeamCols(urls[0])).toBe(true);
    expect(rows).toHaveLength(1);
  });

  test("retries without them when Savant rejects the request", async () => {
    const { rows, urls } = await run((_u, attempt) => (attempt === 1 ? boom() : ok()), {
      year: 2002,
      min: 2,
    });
    expect(urls).toHaveLength(2);
    expect(hasTeamCols(urls[0])).toBe(true);
    // The retry must be the exact selection list that worked before.
    expect(hasTeamCols(urls[1])).toBe(false);
    // And the leaderboard still comes back — losing team data is not an outage.
    expect(rows).toHaveLength(1);
    expect(rows[0].player_id).toBe(592450);
  });

  test("surfaces the error when the plain request fails too", async () => {
    // A genuine upstream outage must still be reported, not swallowed by the
    // fallback and turned into a silent empty leaderboard.
    await expect(run(boom, { year: 2003, min: 3 })).rejects.toThrow();
  });
});

describe("team-column diagnostics", () => {
  const originalFetch = globalThis.fetch;

  /** Capture what the logger writes while a fetch runs. */
  async function capture(csv: string, opts: object, failFirst = false) {
    const { fetchLeaderboard } = await import("@/lib/mlb-api");
    const lines: string[] = [];
    /* eslint-disable no-console -- the point of this helper is to intercept
       the logger's console sinks; the originals are restored in `finally`. */
    const saved = {
      log: console.log, warn: console.warn, error: console.error,
      level: process.env.LOG_LEVEL,
    };
    // The suite runs with LOG_LEVEL=silent; the threshold is re-read on every
    // write, so lifting it here is enough. warn has its own console sink.
    process.env.LOG_LEVEL = "debug";
    const sink = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
    console.log = sink; console.warn = sink; console.error = sink;

    let attempt = 0;
    globalThis.fetch = (async () => {
      attempt++;
      if (failFirst && attempt === 1) return new Response("nope", { status: 400 });
      return new Response(csv, { status: 200 });
    }) as unknown as typeof fetch;

    try {
      await fetchLeaderboard(opts);
    } finally {
      globalThis.fetch = originalFetch;
      console.log = saved.log; console.warn = saved.warn; console.error = saved.error;
      if (saved.level === undefined) delete process.env.LOG_LEVEL;
      else process.env.LOG_LEVEL = saved.level;
    }
    /* eslint-enable no-console */
    return lines.join("\n");
  }

  const WITH_TEAM = 'player_id,team_name_alt,woba\n592450,NYY,0.42\n';
  const WITHOUT_TEAM = 'player_id,woba\n592450,0.42\n';

  test("names the column that resolved", async () => {
    const out = await capture(WITH_TEAM, { year: 2011, min: 11 });
    expect(out).toContain("team column resolved");
    expect(out).toContain("team_name_alt");
  });

  test("says so when the response carried no team column", async () => {
    // Savant accepted the request but has no such column.
    const out = await capture(WITHOUT_TEAM, { year: 2012, min: 12 });
    expect(out).toContain("no team column");
  });

  test("the rejection path is distinguishable from the missing-column path", async () => {
    const out = await capture(WITHOUT_TEAM, { year: 2013, min: 13 }, true);
    expect(out).toContain("rejected");
    // The retry drops the columns, so the no-column line must not also fire —
    // otherwise the two failure modes would look identical in the logs.
    expect(out).not.toContain("no team column");
  });
});
