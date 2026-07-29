import { test, expect, describe } from "bun:test";
import { cn, statcastSeasons, FIRST_STATCAST_SEASON } from "@/lib/utils";

describe("cn", () => {
  test("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  test("drops falsy entries", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  test("later tailwind utilities win over earlier conflicting ones", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });
});

describe("statcastSeasons", () => {
  test("starts at the current year and descends", () => {
    const seasons = statcastSeasons(new Date("2026-07-29T00:00:00Z"));
    expect(seasons[0]).toBe(2026);
    expect(seasons[1]).toBe(2025);
  });

  test("ends at the first Statcast season", () => {
    const seasons = statcastSeasons(new Date("2026-07-29T00:00:00Z"));
    expect(seasons.at(-1)).toBe(FIRST_STATCAST_SEASON);
  });

  test("includes the current year as the year rolls over", () => {
    // The regression this guards: the list was hardcoded with 2026 newest
    // while the store defaults to getFullYear(), so in 2027 the default
    // selection had no matching option.
    const seasons = statcastSeasons(new Date("2027-01-01T00:00:00Z"));
    expect(seasons).toContain(2027);
    expect(seasons[0]).toBe(2027);
  });

  test("is strictly descending with no gaps or duplicates", () => {
    const seasons = statcastSeasons(new Date("2030-06-01T00:00:00Z"));
    for (let i = 1; i < seasons.length; i++) {
      expect(seasons[i]).toBe(seasons[i - 1] - 1);
    }
    expect(new Set(seasons).size).toBe(seasons.length);
  });

  test("covers every season inclusively", () => {
    const seasons = statcastSeasons(new Date("2026-07-29T00:00:00Z"));
    expect(seasons).toHaveLength(2026 - FIRST_STATCAST_SEASON + 1);
  });
});
