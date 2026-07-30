"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True for a beat after `value` rises, false otherwise.
 *
 * For celebrating a run crossing the plate. Deliberately narrower than "the
 * number changed":
 *
 * - It stays false on first render. The component mounts with whatever the
 *   score already is, and a game joined in the 7th inning should not flash
 *   five times on load.
 * - It ignores decreases. Scores are corrected downward occasionally when a
 *   play is rescored, and that is not something to celebrate.
 */
export function useScored(value: number, holdMs = 700): boolean {
  const previous = useRef(value);
  const [scored, setScored] = useState(false);

  useEffect(() => {
    const rose = value > previous.current;
    previous.current = value;
    if (!rose) return;

    setScored(true);
    const timer = setTimeout(() => setScored(false), holdMs);
    return () => clearTimeout(timer);
  }, [value, holdMs]);

  return scored;
}
