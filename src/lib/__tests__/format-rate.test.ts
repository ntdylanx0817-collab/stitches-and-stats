import { test, expect, describe } from "bun:test";

/**
 * Mirrors formatRate in leaderboards-view. Kept here rather than exported from
 * the component so the rule can be pinned without pulling React into the suite.
 */
function formatRate(v: number | string | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(3).replace(/^(-?)0\./, "$1.");
}

describe("rate stat formatting", () => {
  test("keeps three decimals, so a trailing zero survives", () => {
    // The old String() path printed .64 for a .640 slugging.
    expect(formatRate(0.64)).toBe(".640");
    expect(formatRate(0.5)).toBe(".500");
  });

  test("rounds away float representation noise", () => {
    // .402 arrives from the parser as 0.40199999999999997 and used to print in full.
    expect(formatRate(0.40199999999999997)).toBe(".402");
  });

  test("renders a genuine zero rather than treating it as missing", () => {
    // The old truthy guard turned a real .000 into an em dash.
    expect(formatRate(0)).toBe(".000");
  });

  test("still accepts the string form the feed may send", () => {
    expect(formatRate("0.322")).toBe(".322");
  });

  test("reports missing and unparseable values as no data", () => {
    for (const v of [undefined, "", "n/a", NaN]) expect(formatRate(v as never)).toBe("—");
  });

  test("drops the leading zero without eating a minus sign", () => {
    expect(formatRate(-0.05)).toBe("-.050");
  });

  test("leaves values at or above one intact", () => {
    expect(formatRate(1.25)).toBe("1.250");
  });
});
