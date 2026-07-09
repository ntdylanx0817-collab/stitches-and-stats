"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, UserX, Repeat, Zap, Activity, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/loading-states";
import { cn } from "@/lib/utils";

interface LineupPlayer {
  id: number;
  name: string;
  position: string;
  battingOrder: string;
  orderNumber: number;
  isSubstitute: boolean;
  isPinchHitter: boolean;
  isPinchRunner: boolean;
  status: string;
  team: string;
  teamSide: "away" | "home";
}

interface LineupChange {
  type: "starting_lineup" | "pitching_change" | "pinch_hit" | "pinch_run" | "defensive_sub" | "scratch";
  player: LineupPlayer;
  replacedPlayer?: LineupPlayer;
  description: string;
  inning?: number;
  timestamp: string;
}

interface LineupData {
  gamePk: number;
  awayTeam: string;
  homeTeam: string;
  awayLineup: LineupPlayer[];
  homeLineup: LineupPlayer[];
  awayPitchers: LineupPlayer[];
  homePitchers: LineupPlayer[];
  currentAwayPitcher?: LineupPlayer;
  currentHomePitcher?: LineupPlayer;
  changes: LineupChange[];
  lastUpdated: number;
}

const CHANGE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  scratch: { icon: UserX, color: "text-crimson", bg: "bg-crimson/10 border-crimson/30", label: "Scratched" },
  pitching_change: { icon: Repeat, color: "text-mint", bg: "bg-mint/10 border-mint/30", label: "Pitching Change" },
  pinch_hit: { icon: Zap, color: "text-amber", bg: "bg-amber/10 border-amber/30", label: "Pinch Hit" },
  pinch_run: { icon: Zap, color: "text-cobalt", bg: "bg-cobalt/10 border-cobalt/30", label: "Pinch Run" },
  defensive_sub: { icon: Users, color: "text-slate-400", bg: "bg-white/5 border-white/10", label: "Defensive Sub" },
  starting_lineup: { icon: Activity, color: "text-mint", bg: "bg-mint/10 border-mint/30", label: "Lineup" },
};

export function LineupChanges({ gamePk }: { gamePk: number }) {
  const { data, isLoading, error } = useQuery<LineupData>({
    queryKey: ["lineup", gamePk],
    queryFn: async () => {
      const res = await fetch(`/api/lineup?gamePk=${gamePk}`);
      if (!res.ok) throw new Error("lineup fetch failed");
      return res.json();
    },
    refetchInterval: 15_000, // Refresh every 15s for live updates
    staleTime: 10_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-cobalt" />
          <h3 className="text-sm font-semibold text-white">Lineup & Changes</h3>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass rounded-2xl p-4">
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-cobalt" />
          <h3 className="text-sm font-semibold text-white">Lineup & Changes</h3>
        </div>
        <p className="text-xs text-slate-500">Lineup data not available for this game.</p>
      </div>
    );
  }

  const hasChanges = data.changes.length > 0;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Users className="h-4 w-4 text-cobalt" />
          Lineup & Changes
        </h3>
        {hasChanges && (
          <Badge variant="outline" className="border-crimson/30 bg-crimson/10 text-crimson text-[10px]">
            <AlertCircle className="mr-1 h-3 w-3" />
            {data.changes.length} change{data.changes.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Current pitchers */}
      {(data.currentAwayPitcher || data.currentHomePitcher) && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {data.currentAwayPitcher && (
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">{data.awayTeam}</div>
              <div className="text-xs font-semibold text-white">⚾ {data.currentAwayPitcher.name}</div>
            </div>
          )}
          {data.currentHomePitcher && (
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">{data.homeTeam}</div>
              <div className="text-xs font-semibold text-white">⚾ {data.currentHomePitcher.name}</div>
            </div>
          )}
        </div>
      )}

      {/* Changes feed */}
      {hasChanges ? (
        <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
          <AnimatePresence initial={false}>
            {data.changes.slice().reverse().map((change, idx) => {
              const config = CHANGE_CONFIG[change.type] ?? CHANGE_CONFIG.defensive_sub;
              const Icon = config.icon;
              return (
                <motion.div
                  key={`${change.type}-${change.player.id}-${idx}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                  className={cn("rounded-lg border p-2.5", config.bg)}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", config.color)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-[9px] font-bold uppercase tracking-wide", config.color)}>
                          {config.label}
                        </span>
                        <span className="text-[9px] text-slate-500">· {change.player.team}</span>
                      </div>
                      <p className="mt-0.5 text-xs leading-snug text-slate-300">
                        {change.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Show starting lineups when no changes yet */}
          <p className="text-[11px] text-slate-500">No lineup changes yet. Showing starting lineups:</p>
          <div className="grid grid-cols-2 gap-3">
            <LineupList team={data.awayTeam} lineup={data.awayLineup} />
            <LineupList team={data.homeTeam} lineup={data.homeLineup} />
          </div>
        </div>
      )}
    </div>
  );
}

function LineupList({ team, lineup }: { team: string; lineup: LineupPlayer[] }) {
  const starters = lineup.filter((p) => !p.isSubstitute).slice(0, 9);
  if (starters.length === 0) {
    return (
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate">{team}</div>
        <p className="text-[10px] text-slate-600">Lineup not posted</p>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate">{team}</div>
      <div className="space-y-0.5">
        {starters.map((p, i) => (
          <div key={`${p.id}-${i}`} className="flex items-center gap-1.5 text-[10px]">
            <span className="w-3 shrink-0 text-slate-600 num">{p.orderNumber}</span>
            <span className="w-6 shrink-0 text-slate-500">{p.position}</span>
            <span className="truncate text-slate-300">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
