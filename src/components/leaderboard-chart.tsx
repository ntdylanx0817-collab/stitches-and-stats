"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { getTeamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";

interface LeaderboardChartProps {
  rows: any[];
  sortKey: string;
  sortDir: "asc" | "desc" | null;
  isBatter: boolean;
  className?: string;
}

export function LeaderboardChart({ rows, sortKey, sortDir, isBatter, className }: LeaderboardChartProps) {
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
            const color = getTeamColor(row.player_id || 0);
            const teamColor = color.primary === "#000000" || color.primary === "#27251F" ? "#4DA3FF" : color.primary;

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
                <span className={cn(
                  "font-scoreboard w-5 shrink-0 text-center text-[10px] font-bold num",
                  i === 0 ? "text-crimson" : i === 1 ? "text-amber" : i === 2 ? "text-warning-track" : "text-slate-600"
                )}>
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
                      background: `linear-gradient(90deg, ${teamColor}30, ${teamColor}80)`,
                      boxShadow: `0 0 6px ${teamColor}30`,
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
