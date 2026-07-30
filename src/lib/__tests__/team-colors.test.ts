import { test, expect, describe } from "bun:test";
import { TEAM_COLORS, TEAM_IDS, getDisplayTeamColor, getTeamColor } from "@/lib/team-colors";

/** WCAG relative luminance — mirrors the threshold getDisplayTeamColor targets. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return 0;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

describe("getTeamColor", () => {
  test("returns the branded colours for a known team", () => {
    expect(getTeamColor(147).primary).toBe("#003087");
  });

  test("falls back for an unknown team id", () => {
    expect(getTeamColor(-1)).toEqual({ primary: "#4DA3FF", secondary: "#e67e22" });
  });
});

describe("getDisplayTeamColor", () => {
  test("every team clears the legibility threshold on the midnight background", () => {
    for (const { id, abbr } of TEAM_IDS) {
      if (!TEAM_COLORS[id]) continue;
      const lum = luminance(getDisplayTeamColor(id));
      expect(`${abbr}:${lum >= 0.18}`).toBe(`${abbr}:true`);
    }
  });

  test("leaves already-bright brands untouched", () => {
    // Pirates gold and Mets orange are legible as-branded.
    expect(getDisplayTeamColor(134)).toBe(TEAM_COLORS[134].primary);
    expect(getDisplayTeamColor(121)).toBe(TEAM_COLORS[121].primary);
  });

  test("lifts the near-black navies that the old #000000 guard missed", () => {
    // Yankees, Rays and Astros are all far below the threshold as branded.
    for (const id of [147, 139, 117]) {
      expect(luminance(TEAM_COLORS[id].primary)).toBeLessThan(0.18);
      expect(getDisplayTeamColor(id)).not.toBe(TEAM_COLORS[id].primary);
    }
  });

  test("preserves saturation, so a lifted colour still reads as that team's", () => {
    // The regression this guards: mixing toward white instead of raising
    // lightness turned Yankees navy into grey-blue and Rays navy into grey.
    for (const id of [147, 139, 117, 133]) {
      const before = saturation(TEAM_COLORS[id].primary);
      const after = saturation(getDisplayTeamColor(id));
      expect(after).toBeGreaterThanOrEqual(before - 0.05);
    }
  });

  test("returns a well-formed hex colour", () => {
    for (const { id } of TEAM_IDS) {
      expect(getDisplayTeamColor(id)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  test("is stable across calls and terminates for an unknown id", () => {
    expect(getDisplayTeamColor(147)).toBe(getDisplayTeamColor(147));
    expect(getDisplayTeamColor(-1)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
