"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Gauge } from "lucide-react";
import { ListSkeleton } from "@/components/loading-states";
import { cn } from "@/lib/utils";
import { HomeRunDerby } from "@/components/home-run-derby";

interface FastestPitch {
  playId: string;
  pitcherName: string;
  pitcherId: number;
  team: string;
  pitchType: string;
  pitchName: string;
  velocity: number;
  spinRate: number;
  result: string;
  inning: number;
  date: string;
}

interface DerbyData {
  date: string;
  total: number;
  entries: FastestPitch[];
  fastest: FastestPitch | null;
}

export function DerbyTab() {
  return (
    <div className="mx-auto max-w-[800px] px-4 py-5 sm:px-6 space-y-6">
      <HomeRunDerby />
      <FastestPitches />
    </div>
  );
}

function FastestPitches() {
  const { data, isLoading } = useQuery<DerbyData>({
    queryKey: ["fastest-pitches"],
    queryFn: async () => {
      const res = await fetch("/api/fastest-pitches?limit=20&minVel=97");
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-4">
        <p className="mb-3 text-xs text-slate-500">Loading fastest pitches…</p>
        <ListSkeleton rows={5} marker="none" />
      </div>
    );
  }

  if (!data || data.entries.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <Gauge className="mx-auto mb-2 h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-400">No pitch velocity data available.</p>
      </div>
    );
  }

  const entries = data.entries;

  return (
    <div className="space-y-4">
      {/* Fastest pitch spotlight */}
      {data.fastest && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-broadcast rounded-2xl p-4 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(77,163,255,0.08), rgba(230,126,34,0.06))" }}
        >
          <div className="absolute top-0 right-0 h-20 w-20 rounded-full bg-cobalt/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cobalt to-warning-track">
              <Gauge className="h-7 w-7 text-chalk" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-scoreboard text-[9px] uppercase tracking-wide text-cobalt">Fastest Pitch Today</div>
              <div className="font-scoreboard text-base font-bold text-chalk truncate">{data.fastest.pitcherName}</div>
              <div className="text-[10px] text-slate-500">{data.fastest.pitchName} · {data.fastest.team}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-scoreboard text-3xl font-black text-cobalt num">{data.fastest.velocity.toFixed(1)}</div>
              <div className="font-scoreboard text-[9px] uppercase text-slate-500">MPH</div>
            </div>
          </div>
          {data.fastest.spinRate > 0 && (
            <div className="mt-2 flex justify-end text-[10px] font-scoreboard num text-slate-500">
              <span className="text-mint">{data.fastest.spinRate.toFixed(0)} rpm</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Leaderboard */}
      <div className="glass rounded-2xl p-3">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Gauge className="h-4 w-4 text-cobalt" />
          Fastest Pitches
        </h3>
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {entries.map((entry, i) => {
              const velColor = entry.velocity >= 101 ? "text-crimson" :
                               entry.velocity >= 100 ? "text-warning-track" :
                               entry.velocity >= 98 ? "text-amber" : "text-cobalt";
              return (
                <motion.div
                  key={`${entry.playId}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-2 transition-all",
                    i === 0 ? "border-cobalt/20 bg-cobalt/5" : "border-chalk bg-midnight/30"
                  )}
                >
                  <div className={cn(
                    "font-scoreboard w-6 shrink-0 text-center text-sm font-bold num",
                    i === 0 ? "text-cobalt" : i === 1 ? "text-amber" : i === 2 ? "text-warning-track" : "text-slate-600"
                  )}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-chalk">{entry.pitcherName}</div>
                    <div className="text-[10px] text-slate-500">{entry.pitchName} · {entry.team}</div>
                  </div>
                  {entry.spinRate > 0 && (
                    <span className="font-scoreboard text-[10px] text-mint num hidden sm:inline">{entry.spinRate.toFixed(0)} rpm</span>
                  )}
                  <div className="text-right shrink-0">
                    <div className={cn("font-scoreboard text-lg font-bold num", velColor)}>{entry.velocity.toFixed(1)}</div>
                    <div className="font-scoreboard text-[8px] uppercase text-slate-600">MPH</div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
