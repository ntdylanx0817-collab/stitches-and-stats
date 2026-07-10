"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeagueRank {
  label: string;
  value: string;
  rank: number;
  total: number;
}

interface LeagueRanksProps {
  data: LeagueRank[];
  className?: string;
}

export function LeagueRanks({ data, className }: LeagueRanksProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className={className}>
      <div className="glass rounded-2xl p-4">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Trophy className="h-4 w-4 text-warning-track" />
          MLB Rankings
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-3">
          {data.map((r, i) => {
            const isTop5 = r.rank <= 5;
            const isTop10 = r.rank <= 10;
            const color = isTop5 ? "text-crimson" : isTop10 ? "text-warning-track" : "text-slate-400";
            const border = isTop5 ? "border-crimson/30 bg-crimson/5" : isTop10 ? "border-warning-track/25 bg-warning-track/5" : "border-chalk bg-midnight/40";
            return (
              <motion.div
                key={r.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className={cn("rounded-lg border p-2 text-center hover-lift", border)}
              >
                <div className="font-scoreboard text-[8px] uppercase tracking-wide text-slate-500">{r.label}</div>
                <div className="font-scoreboard text-sm font-bold text-chalk num">{r.value}</div>
                <div className={cn("font-scoreboard text-[10px] font-bold", color)}>
                  #{r.rank}<span className="text-slate-600">/{r.total}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
