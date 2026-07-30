"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/player-avatar";
import { getDisplayTeamColor, getTeamColor } from "@/lib/team-colors";
import { useSavantStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Skeleton, ErrorState } from "@/components/loading-states";

interface TeamData {
  team: {
    id: number;
    name: string;
    abbreviation: string;
    locationName?: string;
    teamName?: string;
    league?: string;
    division?: string;
    firstYearOfPlay?: number;
  };
  roster: Array<{
    id: number;
    name: string;
    position: string;
    status: string;
    number: string;
  }>;
  last10: Array<{
    date: string;
    opponent: string;
    opponentName: string;
    myScore: number;
    oppScore: number;
    won: boolean;
    isHome: boolean;
  }>;
  last10Record: string;
}

export function TeamProfileView({ teamId, onClose }: { teamId: number; onClose: () => void }) {
  const setSelectedPlayer = useSavantStore((s) => s.setSelectedPlayer);
  const setView = useSavantStore((s) => s.setView);
  const color = getTeamColor(teamId);

  const { data, isLoading, error, refetch } = useQuery<TeamData>({
    queryKey: ["team", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/team/${teamId}`);
      if (!res.ok) throw new Error("team fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6">
        <div className="card-broadcast rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <ErrorState title="Couldn't load team data" onRetry={() => refetch()} />
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" onClick={onClose}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
        </div>
      </div>
    );
  }

  const t = data.team;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6">
      {/* Hero header */}
      <div
        className="card-broadcast rounded-2xl p-5 mb-4 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color.primary}20, ${color.secondary}10)` }}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color.primary }} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="font-scoreboard flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-2xl font-black uppercase"
              style={{ background: `linear-gradient(135deg, ${color.primary}40, ${color.secondary}20)`, color: getDisplayTeamColor(teamId) }}
            >
              {t.abbreviation}
            </div>
            <div>
              <h1 className="font-scoreboard text-2xl font-bold text-chalk">{t.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                {t.league && <span>{t.league}</span>}
                {t.division && <span>· {t.division}</span>}
                {data.last10Record && <span>· Last 10: {data.last10Record}</span>}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="border-chalk bg-midnight/40 hover:bg-white/5">
            <ArrowLeft className="mr-1 h-4 w-4" /> Close
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Last 10 games */}
        <div className="glass rounded-2xl p-4">
          <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
            <Calendar className="h-4 w-4 text-warning-track" />
            Last 10 Games
          </h3>
          <div className="space-y-1">
            {data.last10.map((g, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5",
                  g.won ? "border-mint/20 bg-mint/5" : "border-crimson/20 bg-crimson/5"
                )}
              >
                <span className={cn("font-scoreboard text-[10px] font-bold uppercase w-6", g.won ? "text-mint" : "text-crimson")}>
                  {g.won ? "W" : "L"}
                </span>
                <span className="font-scoreboard text-[10px] text-slate-500 w-12">
                  {new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span className="text-xs text-slate-400 w-6">{g.isHome ? "vs" : "@"}</span>
                <span className="font-scoreboard text-xs font-bold text-chalk w-8">{g.opponent}</span>
                <span className="font-scoreboard text-xs text-chalk num ml-auto">{g.myScore}-{g.oppScore}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Roster */}
        <div className="glass rounded-2xl p-4">
          <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
            <Users className="h-4 w-4 text-cobalt" />
            Roster
          </h3>
          <div className="grid grid-cols-2 gap-1.5 max-h-[400px] overflow-y-auto scrollbar-thin">
            {data.roster.map((p, i) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.01, 0.3) }}
                onClick={() => {
                  setSelectedPlayer({ id: p.id, name: p.name, type: p.position === "P" ? "pitcher" : "batter" });
                  setView("players");
                }}
                className="flex items-center gap-2 rounded-lg border border-chalk bg-midnight/30 p-1.5 hover:bg-white/5 transition-colors text-left"
              >
                <PlayerAvatar playerId={p.id} size={28} fallbackText={p.name} className="rounded-md shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium text-chalk">{p.name}</div>
                  <div className="font-scoreboard text-[9px] text-slate-500">{p.position}{p.number && ` · #${p.number}`}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
