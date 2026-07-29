import type { EnrichedPitch } from "@/lib/types";

/** One plate appearance: its pitches in throw order, plus how it ended. */
export interface AtBatGroup {
  atBatIndex: number;
  inning: number;
  halfInning: "top" | "bottom";
  batterName: string;
  pitcherName: string;
  /** Pitches in throw order (pitch 1 first). */
  pitches: EnrichedPitch[];
  /** True once the plate appearance has a recorded outcome. */
  isComplete: boolean;
  /** "Strikeout", "Single", "Walk", … or null while the at-bat is live. */
  result: string | null;
}

/**
 * The outcome of a plate appearance, or null while it's still in progress.
 *
 * MLB only populates a play's `result.event` once the plate appearance ends,
 * which makes it a far more reliable completion signal than reconstructing the
 * ending from ball/strike counts — fouls at two strikes and the varying
 * before/after-pitch count semantics both defeat that approach. Every pitch of
 * a finished play carries the same result, so any pitch can answer for the lot.
 */
export function atBatResult(pitches: EnrichedPitch[]): string | null {
  for (const p of pitches) {
    const event = p.playResult?.trim();
    if (event) return event;
  }
  // Savant's own result text is the fallback when the MLB play hasn't caught up.
  for (const p of pitches) {
    const result = p.result?.trim();
    if (result) return result;
  }
  return null;
}

/** Whether a plate appearance has finished. */
export function isAtBatComplete(pitches: EnrichedPitch[]): boolean {
  if (pitches.length === 0) return false;
  if (atBatResult(pitches) != null) return true;
  // A ball put in play ends the at-bat even if the result text lags behind.
  return pitches.some((p) => p.isInPlay);
}

/**
 * Group a game's pitches into plate appearances, oldest at-bat first.
 *
 * Accepts pitches in any order (the feed hands them over newest-first) and
 * sorts both the groups and the pitches within each group.
 */
export function groupPitchesByAtBat(pitches: EnrichedPitch[]): AtBatGroup[] {
  const byIndex = new Map<number, EnrichedPitch[]>();
  for (const p of pitches) {
    const bucket = byIndex.get(p.atBatIndex);
    if (bucket) bucket.push(p);
    else byIndex.set(p.atBatIndex, [p]);
  }

  return Array.from(byIndex.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([atBatIndex, group]) => {
      const ordered = [...group].sort((a, b) => a.pitchNumber - b.pitchNumber);
      const first = ordered[0];
      return {
        atBatIndex,
        inning: first.inning,
        halfInning: first.halfInning,
        batterName: first.batterName,
        pitcherName: first.pitcherName,
        pitches: ordered,
        isComplete: isAtBatComplete(ordered),
        result: atBatResult(ordered),
      };
    });
}

/** Highest at-bat index that has pitches, or null when the game has none yet. */
export function latestAtBatIndex(pitches: EnrichedPitch[]): number | null {
  let latest: number | null = null;
  for (const p of pitches) {
    if (latest == null || p.atBatIndex > latest) latest = p.atBatIndex;
  }
  return latest;
}

/** "Top 5" / "Bot 9" — compact half-inning label. */
export function halfInningLabel(halfInning: string, inning: number): string {
  return `${halfInning === "top" ? "Top" : "Bot"} ${inning}`;
}

/**
 * Where a step through the at-bat list should land the pin.
 *
 * Returns an at-bat index to pin, `null` to resume following the live at-bat,
 * or `undefined` when the step runs off either end (so nothing moves).
 *
 * Stepping onto the newest at-bat resolves to `null` rather than pinning it:
 * pinning the newest would silently freeze the view right as the next batter
 * comes up, which is the opposite of what stepping forward asks for.
 */
export function pinTargetForStep(
  groups: AtBatGroup[],
  fromPosition: number,
  step: -1 | 1,
  liveIndex: number | null,
): number | null | undefined {
  const target = groups[fromPosition + step];
  if (!target) return undefined;
  return target.atBatIndex === liveIndex ? null : target.atBatIndex;
}
