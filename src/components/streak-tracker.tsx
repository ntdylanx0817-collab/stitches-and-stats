"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, Snowflake, Loader2 } from "lucide-react";
import { getTeamColor } from "@/lib/team-colors";
import { useSavantStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface StreakEntry {
  type: "team_win" | "team_loss" | "player_hit" | "player_hr";
  name: string;
  abbr?: string;
  id: number;
  streak: number;
  streakType: string;
  description: string;
}

interface StreaksData {
  season: number;
  streaks: StreakEntry[];
  total: number;
}

export function StreakTracker({ className }: { className?: string }) {
  const setSelectedTeamId = useSavantStore((s) => s.setSelectedTeamId);
  const setView = useSavantStore((s) => s.setView);

  const { data, isLoading } = useQuery<StreaksData>({
    queryKey: ["streaks"],
    queryFn: async () => {
      const res = await fetch("/api/streaks");
      if (!res.ok) throw new Error("streaks fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className={className}>
        <div className="glass rounded-2xl p-4">
          <h3 className="font-scoreboard mb-3 text-sm font-bold text-chalk uppercase tracking-wide">Streak Tracker</h3>
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-warning-track" />
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.streaks.length === 0) return null;

  const winStreaks = data.streaks.filter(s => s.type === "team_win").slice(0, 5);
  const lossStreaks = data.streaks.filter(s => s.type === "team_loss").slice(0, 5);

  return (
    <div className={className}>
      <div className="glass rounded-2xl p-4">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Flame className="h-4 w-4 text-warning-track" />
          Streak Tracker
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Win streaks */}
          <div>
            <div className="mb-1.5 font-scoreboard text-[9px] uppercase tracking-wide text-mint flex items-center gap-1">
              <Flame className="icon-glow h-3 w-3" /> Hot Streaks
            </div>
            <div className="space-y-1">
              {winStreaks.map((s, i) => (
                <StreakRow key={`win-${i}`} entry={s} onClick={() => { setSelectedTeamId(s.id); setView("team"); }} />
              ))}
              {winStreaks.length === 0 && <p className="text-[10px] text-slate-600">No active win streaks</p>}
            </div>
          </div>

          {/* Loss streaks */}
          <div>
            <div className="mb-1.5 font-scoreboard text-[9px] uppercase tracking-wide text-crimson flex items-center gap-1">
              <Snowflake className="icon-glow h-3 w-3" /> Cold Streaks
            </div>
            <div className="space-y-1">
              {lossStreaks.map((s, i) => (
                <StreakRow key={`loss-${i}`} entry={s} onClick={() => { setSelectedTeamId(s.id); setView("team"); }} />
              ))}
              {lossStreaks.length === 0 && <p className="text-[10px] text-slate-600">No active loss streaks</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StreakRow({ entry, onClick }: { entry: StreakEntry; onClick: () => void }) {
  const color = getTeamColor(entry.id);
  const isWin = entry.type === "team_win";
  const teamColor = color.primary === "#000000" || color.primary === "#27251F" ? "#4DA3FF" : color.primary;

  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(entry.streak * 0.02, 0.3) }}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border p-1.5 text-left transition-colors hover:bg-white/5",
        isWin ? "border-mint/15 bg-mint/5" : "border-crimson/15 bg-crimson/5"
      )}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: teamColor }} />
      <span className="font-scoreboard text-xs font-bold w-8 shrink-0" style={{ color: teamColor }}>{entry.abbr}</span>
      <span className="flex-1 truncate text-[11px] text-slate-300">{entry.name.split(" ").slice(-1)[0]}</span>
      <span className={cn(
        "font-scoreboard flex items-center gap-0.5 text-sm font-black num shrink-0",
        isWin ? "text-mint" : "text-crimson"
      )}>
        {isWin ? <Flame className="icon-glow h-3 w-3" /> : <Snowflake className="icon-glow h-3 w-3" />}
        {entry.streak}
      </span>
    </motion.button>
  );
}
