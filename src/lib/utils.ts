import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** First season with public Statcast tracking data. */
export const FIRST_STATCAST_SEASON = 2015

/**
 * Selectable seasons, newest first: the current year down to the start of the
 * Statcast era. Derived rather than hardcoded so the list keeps including the
 * current season — the store defaults `lbYear` to `getFullYear()`, so a stale
 * list would leave the default selection with no matching option.
 */
export function statcastSeasons(now: Date = new Date()): number[] {
  const latest = now.getFullYear()
  const seasons: number[] = []
  for (let y = latest; y >= FIRST_STATCAST_SEASON; y--) seasons.push(y)
  return seasons
}
