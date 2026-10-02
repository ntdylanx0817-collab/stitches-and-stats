import { describe, expect, test } from "bun:test";
import { gameFeedPollInterval, playByPlayPollInterval, supplementalPollInterval } from "../polling";

describe("gameFeedPollInterval", () => {
  test("polls while a disconnected live game can change", () => {
    expect(gameFeedPollInterval("Live", false)).toBe(5_000);
  });

  test("stops for preview and final games", () => {
    expect(gameFeedPollInterval("Preview", false)).toBe(false);
    expect(gameFeedPollInterval("Final", false)).toBe(false);
  });

  test("stops when a socket snapshot already carries updates", () => {
    expect(gameFeedPollInterval("Live", true)).toBe(false);
  });
});

describe("playByPlayPollInterval", () => {
  test("uses live and preview cadences but stops after final", () => {
    expect(playByPlayPollInterval("Live")).toBe(10_000);
    expect(playByPlayPollInterval("Preview")).toBe(60_000);
    expect(playByPlayPollInterval("Final")).toBe(false);
  });
});

describe("supplementalPollInterval", () => {
  test("slows pregame data and stops it after the final out", () => {
    expect(supplementalPollInterval("Live")).toBe(15_000);
    expect(supplementalPollInterval("Preview")).toBe(60_000);
    expect(supplementalPollInterval("Final")).toBe(false);
  });
});
