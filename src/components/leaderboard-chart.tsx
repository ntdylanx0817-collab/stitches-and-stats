"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { getDisplayTeamColor, resolveTeamId } from "@/lib/team-colors";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/types";

/**
 * Bars are coloured by team when the feed supplies one, and by rank otherwise.
 *
 * The team column is requested from Savant but its exact name is discovered at
 * runtime, so a row may legitimately arrive without one. Rank is the fallback
 * because it is always known and matches the medals on the table below — and
 * it beats the previous behaviour, where a team lookup was handed `player_id`
 * against a map keyed by team id, missed on every row, and painted every bar
 * the same fallback blue.
 */
const PODIUM_COLORS = ["#FFB547", "#cbd5e1", "#cd7f32"] as const;
const FIELD_COLOR = "#e67e22";

interface LeaderboardChartProps {
  rows: LeaderboardRow[];
  sortKey: string;
  sortDir: "asc" | "desc" | null;
  isBatter: boolean;
  className?: string;
}

export function LeaderboardChart({ rows, sortKey, sortDir, isBatter: _isBatter, className }: LeaderboardChartProps) {
  const top10 = useMemo(() => {
    if (!sortKey || !sortDir) return [];
    const sorted = [...rows].sort((a, b) => {
      const av = Number(a[sortKey]);
      const bv = Number(b[sortKey]);
      if (isNaN(av) && isNaN(bv)) return 0;
      if (isNaN(av)) return 1;
      if (isNaN(bv)) return -1;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return sorted.slice(0, 10).filter(r => !isNaN(Number(r[sortKey])));
  }, [rows, sortKey, sortDir]);

  if (top10.length === 0) return null;

  const maxValue = Math.max(...top10.map(r => Math.abs(Number(r[sortKey]))));
  if (maxValue === 0) return null;

  return (
    <div className={className}>
      <div className="glass rounded-2xl p-4 mb-3">
        <h3 className="font-scoreboard mb-3 flex items-center justify-between text-sm font-bold text-chalk uppercase tracking-wide">
          <span>Top 10 — {sortKey.replace(/_/g, " ").replace(/p /, "").toUpperCase()}</span>
          <span className="text-[10px] text-slate-500">{sortDir === "desc" ? "↓ Highest" : "↑ Lowest"}</span>
        </h3>

        <div className="space-y-1.5">
          {top10.map((row, i) => {
            const value = Number(row[sortKey]);
            const pct = (Math.abs(value) / maxValue) * 100;
            const teamId = resolveTeamId(row.team);
            const barColor: string = teamId != null
              ? getDisplayTeamColor(teamId)
              : PODIUM_COLORS[i] ?? FIELD_COLOR;

            // Format value
            let displayValue = "";
            if (sortKey.includes("percent") || sortKey.includes("brea")) {
              displayValue = `${value.toFixed(1)}%`;
            } else if (sortKey.includes("speed")) {
              displayValue = `${value.toFixed(1)}`;
            } else if (sortKey.includes("avg") || sortKey.includes("woba") || sortKey.includes("slg") || sortKey.includes("obp") || sortKey.includes("xba") || sortKey.includes("xslg")) {
              displayValue = value.toFixed(3).replace(/^0/, "");
            } else if (sortKey === "era" || sortKey === "whip") {
              displayValue = value.toFixed(2);
            } else {
              displayValue = String(value);
            }

            return (
              <motion.div
                key={`${row.player_id}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
                className="flex items-center gap-2"
              >
                {/* Rank */}
                {/* Podium order matches the medals on the table and the bar
                    colours beside it; this used to lead with crimson, which
                    reads as "bad" everywhere else in the app. */}
                <span
                  className={cn(
                    "font-scoreboard w-5 shrink-0 text-center text-[10px] font-bold num",
                    i > 2 && "text-slate-600"
                  )}
                  style={i <= 2 ? { color: PODIUM_COLORS[i] } : undefined}
                >
                  {i + 1}
                </span>

                {/* Player name */}
                <span className="w-28 shrink-0 truncate text-[11px] text-slate-300">{row.player_name ?? "—"}</span>

                {/* Bar */}
                <div className="flex-1 h-5 overflow-hidden rounded-md bg-midnight">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: Math.min(i * 0.04, 0.4) + 0.1, duration: 0.5, ease: "easeOut" }}
                    className="h-full rounded-md flex items-center justify-end pr-1.5"
                    style={{
                      background: `linear-gradient(90deg, ${barColor}30, ${barColor}80)`,
                      boxShadow: `0 0 6px ${barColor}30`,
                    }}
                  >
                    <span className="font-scoreboard text-[10px] font-bold text-chalk num">{displayValue}</span>
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
