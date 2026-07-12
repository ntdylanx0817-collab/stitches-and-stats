"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Zap, TrendingUp, Loader2, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

interface HomeRunEntry {
  playId: string;
  batterName: string;
  batterId: number;
  team: string;
  opponent: string;
  exitVelocity: number;
  launchAngle: number;
  distance: number;
  inning: number;
  date: string;
  isBarrel: boolean;
}

interface DerbyData {
  date: string;
  total: number;
  entries: HomeRunEntry[];
  hardest: HomeRunEntry | null;
}

export function HomeRunDerby() {
  const { data, isLoading } = useQuery<DerbyData>({
    queryKey: ["hr-derby"],
    queryFn: async () => {
      const res = await fetch("/api/home-run-derby?limit=25&minEV=95");
      if (!res.ok) throw new Error("derby fetch failed");
      return res.json();
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-warning-track" />
        <p className="mt-2 text-xs text-slate-500">Loading today's hardest-hit balls…</p>
      </div>
    );
  }

  if (!data || data.entries.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <Flame className="mx-auto mb-2 h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-400">No hard-hit data available yet today.</p>
        <p className="text-[11px] text-slate-600">Check back once games start!</p>
      </div>
    );
  }

  const entries = data.entries;
  const hardest = data.hardest;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card-broadcast rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-scoreboard flex items-center gap-2 text-lg font-bold text-chalk uppercase tracking-wide">
            <Flame className="h-5 w-5 text-crimson" />
            Home Run Derby
          </h2>
          <Badge>{entries.length} hard-hit balls</Badge>
        </div>
        <p className="text-[11px] text-slate-500">
          Today's hardest contact across MLB · sorted by exit velocity · auto-refreshes every 2 min
        </p>
      </div>

      {/* Hardest hit spotlight */}
      {hardest && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-broadcast rounded-2xl p-4 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(255,59,92,0.08), rgba(230,126,34,0.06))" }}
        >
          <div className="absolute top-0 right-0 h-20 w-20 rounded-full bg-crimson/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-crimson to-warning-track">
              <Zap className="h-7 w-7 text-chalk" fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-scoreboard text-[9px] uppercase tracking-wide text-crimson">Hardest Hit Today</div>
              <div className="font-scoreboard text-base font-bold text-chalk truncate">{hardest.batterName}</div>
              <div className="text-[10px] text-slate-500">{hardest.team} · {hardest.opponent ? `vs ${hardest.opponent}` : ""}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-scoreboard text-3xl font-black text-crimson num">
                {hardest.exitVelocity.toFixed(1)}
              </div>
              <div className="font-scoreboard text-[9px] uppercase text-slate-500">MPH EV</div>
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-4 text-[10px] font-scoreboard num text-slate-500">
            <span><span className="text-amber">{hardest.launchAngle.toFixed(0)}°</span> LA</span>
            <span><span className="text-cobalt">{hardest.distance.toFixed(0)}</span> ft</span>
          </div>
        </motion.div>
      )}

      {/* Leaderboard */}
      <div className="glass rounded-2xl p-3">
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {entries.map((entry, i) => {
              const isHR = entry.distance > 380 && entry.exitVelocity > 100;
              const evColor = entry.exitVelocity >= 110 ? "text-crimson" :
                              entry.exitVelocity >= 105 ? "text-warning-track" :
                              entry.exitVelocity >= 100 ? "text-amber" : "text-slate-300";
              return (
                <motion.div
                  key={`${entry.playId}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-2 transition-all hover:border-chalk-strong",
                    i === 0 ? "border-crimson/20 bg-crimson/5" : "border-chalk bg-midnight/30"
                  )}
                >
                  {/* Rank */}
                  <div className={cn(
                    "font-scoreboard w-6 shrink-0 text-center text-sm font-bold num",
                    i === 0 ? "text-crimson" : i === 1 ? "text-amber" : i === 2 ? "text-warning-track" : "text-slate-600"
                  )}>
                    {i + 1}
                  </div>

                  {/* Player + team */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-chalk">{entry.batterName}</span>
                      {isHR && (
                        <span className="flex items-center gap-0.5 rounded-full bg-crimson/15 px-1.5 py-0.5 text-[8px] font-bold uppercase text-crimson">
                          <Zap className="h-2 w-2" fill="currentColor" /> HR
                        </span>
                      )}
                      {entry.isBarrel && !isHR && (
                        <span className="rounded-full bg-mint/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-mint">Barrel</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {entry.team} {entry.opponent ? `vs ${entry.opponent}` : ""} · {entry.inning > 0 ? `Inn ${entry.inning}` : ""}
                    </div>
                  </div>

                  {/* Exit velocity */}
                  <div className="text-right shrink-0">
                    <div className={cn("font-scoreboard text-lg font-bold num", evColor)}>
                      {entry.exitVelocity.toFixed(1)}
                    </div>
                    <div className="font-scoreboard text-[8px] uppercase text-slate-600">MPH</div>
                  </div>

                  {/* Launch angle + distance */}
                  <div className="hidden sm:flex flex-col items-end shrink-0 gap-0.5 text-[10px] font-scoreboard num">
                    <span className="text-amber">{entry.launchAngle.toFixed(0)}°</span>
                    <span className="text-cobalt">{entry.distance.toFixed(0)}ft</span>
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-scoreboard rounded-md border border-chalk bg-midnight/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
      {children}
    </span>
  );
}
