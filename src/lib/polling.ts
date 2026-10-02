/** Poll the heavy enriched-game endpoint only while it can produce live changes. */
export function gameFeedPollInterval(
  abstractState: string | null | undefined,
  hasSocketSnapshot: boolean
): number | false {
  if (abstractState === "Preview" || abstractState === "Final" || hasSocketSnapshot) return false;
  return 5_000;
}

/** A visible modal can refresh slowly before first pitch, but never after final. */
export function playByPlayPollInterval(abstractState: string | null | undefined): number | false {
  if (abstractState === "Final") return false;
  return abstractState === "Live" ? 10_000 : 60_000;
}

/** Secondary live-game data can refresh quickly in play and slowly pregame. */
export function supplementalPollInterval(abstractState: string | null | undefined): number | false {
  if (abstractState === "Final") return false;
  return abstractState === "Live" ? 15_000 : 60_000;
}
