"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpectedVsActualProps {
  stats: {
    batting_avg?: string | number;
    slg_percent?: string | number;
    on_base_percent?: string | number;
    woba?: string | number;
    xba?: string | number;
    xslg?: string | number;
    xwoba?: string | number;
  };
  className?: string;
}

export function ExpectedVsActual({ stats, className }: ExpectedVsActualProps) {
  const comparisons = [
    { label: "BA vs xBA", actual: stats.batting_avg, expected: stats.xba, format: "avg" },
    { label: "SLG vs xSLG", actual: stats.slg_percent, expected: stats.xslg, format: "avg" },
    { label: "wOBA vs xwOBA", actual: stats.woba, expected: stats.xwoba, format: "avg" },
  ].filter(c => c.actual != null && c.expected != null && c.actual !== "" && c.expected !== "");

  if (comparisons.length === 0) return null;

  return (
    <div className={className}>
      <div className="glass rounded-2xl p-4">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <TrendingUp className="h-4 w-4 text-warning-track" />
          Expected vs Actual
        </h3>
        <p className="mb-3 text-[10px] text-slate-500">
          Expected stats based on exit velocity & launch angle — shows if a player is over/underperforming
        </p>

        <div className="space-y-3">
          {comparisons.map((comp, i) => {
            const actualNum = typeof comp.actual === "number" ? comp.actual : parseFloat(String(comp.actual));
            const expectedNum = typeof comp.expected === "number" ? comp.expected : parseFloat(String(comp.expected));
            if (isNaN(actualNum) || isNaN(expectedNum)) return null;

            const diff = actualNum - expectedNum;
            const isOverperforming = diff > 0.010;
            const isUnderperforming = diff < -0.010;
            const pct = Math.min(100, (actualNum / 0.500) * 100);
            const expPct = Math.min(100, (expectedNum / 0.500) * 100);

            return (
              <motion.div
                key={comp.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="font-scoreboard text-slate-400 uppercase tracking-wide">{comp.label}</span>
                  <div className="flex items-center gap-2">
                    {isOverperforming && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase text-mint">
                        <TrendingUp className="h-2.5 w-2.5" /> Lucky
                      </span>
                    )}
                    {isUnderperforming && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase text-crimson">
                        <TrendingDown className="h-2.5 w-2.5" /> Unlucky
                      </span>
                    )}
                    <span className={cn(
                      "font-scoreboard font-bold num",
                      isOverperforming ? "text-mint" : isUnderperforming ? "text-crimson" : "text-slate-400"
                    )}>
                      {diff > 0 ? "+" : ""}{diff.toFixed(3).replace(/^0/, "")}
                    </span>
                  </div>
                </div>
                {/* Bar chart */}
                <div className="relative h-6 overflow-hidden rounded-md bg-midnight">
                  {/* Expected (ghost/dashed bar) */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-md border-r-2 border-dashed border-slate-600 bg-slate-700/20"
                    style={{ width: `${expPct}%` }}
                  />
                  {/* Actual (solid bar) */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: i * 0.1 + 0.2, duration: 0.5, ease: "easeOut" }}
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-md opacity-80",
                      isOverperforming ? "bg-mint/40" : isUnderperforming ? "bg-crimson/40" : "bg-cobalt/40"
                    )}
                  />
                  {/* Labels inside bars */}
                  <div className="absolute inset-0 flex items-center justify-between px-2">
                    <span className="font-scoreboard text-[10px] font-bold text-chalk num">
                      {actualNum.toFixed(3).replace(/^0/, "")}
                    </span>
                    <span className="font-scoreboard text-[10px] text-slate-500 num">
                      x{expectedNum.toFixed(3).replace(/^0/, "")}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
