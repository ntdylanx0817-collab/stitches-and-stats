import { describe, expect, it } from "bun:test";
import { dateParam, enumParam, integerParam, numberParam, stringParam } from "../api-params";

describe("API parameter parsing", () => {
  it("accepts bounded integers and defaults missing values", () => {
    expect(integerParam("25", { min: 1, max: 100 })).toBe(25);
    expect(integerParam(null, { defaultValue: 10, min: 1 })).toBe(10);
  });

  it("rejects partial, unsafe, and out-of-range integers", () => {
    expect(integerParam("12px", { min: 1 })).toBeNull();
    expect(integerParam("1.5", { min: 1 })).toBeNull();
    expect(integerParam("0", { min: 1 })).toBeNull();
    expect(integerParam("9007199254740992")).toBeNull();
  });

  it("accepts only finite decimals within range", () => {
    expect(numberParam("95.5", { min: 80, max: 110 })).toBe(95.5);
    expect(numberParam("Infinity", { min: 80, max: 110 })).toBeNull();
    expect(numberParam("1e2", { min: 80, max: 110 })).toBeNull();
    expect(numberParam("120", { min: 80, max: 110 })).toBeNull();
  });

  it("validates enums instead of trusting type assertions", () => {
    expect(enumParam("pitcher", ["batter", "pitcher"] as const, "batter")).toBe("pitcher");
    expect(enumParam("admin", ["batter", "pitcher"] as const, "batter")).toBeNull();
    expect(enumParam(null, ["batter", "pitcher"] as const, "batter")).toBe("batter");
  });

  it("accepts only real canonical calendar dates", () => {
    expect(dateParam("2026-09-30")).toBe("2026-09-30");
    expect(dateParam("2026-02-30")).toBeNull();
    expect(dateParam("2026-9-3")).toBeNull();
  });

  it("bounds and patterns free-form strings", () => {
    expect(stringParam("  NYY ", { maxLength: 3, pattern: /^[A-Z]*$/ })).toBe("NYY");
    expect(stringParam("TOOLONG", { maxLength: 3 })).toBeNull();
    expect(stringParam("NYY!", { pattern: /^[A-Z]*$/ })).toBeNull();
  });
});
