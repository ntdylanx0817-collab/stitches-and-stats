import { describe, expect, test } from "bun:test";
import { ymd } from "@/lib/mlb-api";

describe("ymd", () => {
  test("uses the previous Chicago calendar day before winter midnight", () => {
    expect(ymd(new Date("2026-01-01T05:30:00Z"))).toBe("2025-12-31");
  });

  test("uses the previous Chicago calendar day before summer midnight", () => {
    expect(ymd(new Date("2026-07-01T04:30:00Z"))).toBe("2026-06-30");
  });

  test("rolls over at Chicago midnight", () => {
    expect(ymd(new Date("2026-07-01T05:00:00Z"))).toBe("2026-07-01");
  });
});
