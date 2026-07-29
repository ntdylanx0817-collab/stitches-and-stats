"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/loading-states";
import { useSavantStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface ScheduleGame {
  gamePk: number;
  gameDate: string;
  gameDay?: string;
  gameNumber?: number;
  doubleHeader?: string;
  status: { abstractGameState: string; detailedState: string; statusCode: string; reason?: string };
  venue?: { name: string };
  away: { id: number; name: string; abbreviation?: string; score: number | null; record?: { wins: number; losses: number } };
  home: { id: number; name: string; abbreviation?: string; score: number | null; record?: { wins: number; losses: number } };
}

/**
 * Horizontal strip of today's games, with the selected one highlighted.
 *
 * Owns the schedule query and the auto-pick, and reads/writes the selected game
 * straight from the store — so the Live Feed and Live At-Bat tabs stay on the
 * same game as you move between them.
 */
export function GameSelectorStrip({ className }: { className?: string }) {
  const selectedGamePk = useSavantStore((s) => s.selectedGamePk);
  const setSelectedGame = useSavantStore((s) => s.setSelectedGame);

  const { data, isLoading, error, refetch } = useQuery<{ games: ScheduleGame[]; date: string }>({
    queryKey: ["schedule"],
    queryFn: async () => {
      const res = await fetch("/api/schedule");
      if (!res.ok) throw new Error("schedule failed");
      return res.json();
    },
    refetchInterval: 60_000,
    retry: 2,
  });

  // Live first, then Preview, then Final — live games are visible without
  // scrolling. The `?? []` lives inside the memo: as a separate statement it
  // produced a new array identity every render, so the memo never hit.
  const games = useMemo(() => {
    const order = { Live: 0, Preview: 1, Final: 2 };
    return [...(data?.games ?? [])].sort((a, b) => {
      const aOrder = order[a.status.abstractGameState as keyof typeof order] ?? 3;
      const bOrder = order[b.status.abstractGameState as keyof typeof order] ?? 3;
      return aOrder - bOrder;
    });
  }, [data?.games]);

  // Auto-pick when nothing is selected yet.
  // Priority: Live > Final (has pitch data) > Preview (today's upcoming).
  useEffect(() => {
    if (!selectedGamePk && games.length > 0) {
      const live = games.find((g) => g.status.abstractGameState === "Live");
      const final = games.find((g) => g.status.abstractGameState === "Final");
      const preview = games.find((g) => g.status.abstractGameState === "Preview");
      setSelectedGame((live ?? final ?? preview ?? games[0]).gamePk);
    }
  }, [games, selectedGamePk, setSelectedGame]);

  const liveCount = games.filter((g) => g.status.abstractGameState === "Live").length;

  return (
    <div className={cn("mb-4", className)}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-scoreboard flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-chalk">
          <Calendar className="h-4 w-4 text-warning-track" />
          {data?.date ?? "—"}
        </h2>
        {liveCount > 0 && (
          <Badge variant="outline" className="border-mint/30 bg-mint/10 text-mint font-scoreboard">
            <Radio className="mr-1 h-3 w-3 animate-live-dot" /> {liveCount} LIVE
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-2 overflow-hidden pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="min-w-[200px] shrink-0 rounded-xl border border-chalk bg-midnight/40 p-3">
              <div className="mb-2 flex justify-between">
                <Skeleton className="h-2 w-12" />
                <Skeleton className="h-2 w-10" />
              </div>
              <div className="mb-1.5 flex justify-between">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-4" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-4" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load today's schedule"
          description="The MLB Stats API may be temporarily unavailable."
          onRetry={() => refetch()}
        />
      ) : games.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No games today"
          description="There are no MLB games scheduled for today or yesterday. Check back later."
        />
      ) : (
        <div className="-webkit-overflow-scrolling-touch w-full overflow-x-auto scrollbar-thin">
          <div className="flex min-w-min gap-2 pb-2">
            {games.map((g) => {
              const isLive = g.status.abstractGameState === "Live";
              const isFinal = g.status.abstractGameState === "Final";
              const isSelected = selectedGamePk === g.gamePk;
              // Preview games show their local start time.
              const gameDate = g.gameDate ? new Date(g.gameDate) : null;
              const startTime = gameDate
                ? gameDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
                : null;
              const isDelayed = g.status?.detailedState?.includes("Delayed") || g.status?.detailedState?.includes("Postponed");
              return (
                <button
                  key={`${g.gamePk}-${g.gameDay}-${g.status.abstractGameState}`}
                  onClick={() => setSelectedGame(g.gamePk)}
                  aria-pressed={isSelected}
                  className={cn(
                    "hover-lift relative flex min-w-[190px] shrink-0 flex-col gap-1 rounded-xl border p-2.5 text-left transition-all",
                    isSelected
                      ? "border-warning-track/40 bg-warning-track/8 box-glow-warning"
                      : isLive
                      ? "border-mint/25 bg-mint/5 shimmer-sweep"
                      : isFinal
                      ? "border-chalk bg-midnight/30 opacity-70"
                      : "border-chalk bg-midnight/40"
                  )}
                >
                  <div className="font-scoreboard flex items-center justify-between text-[9px] uppercase tracking-wide">
                    <span className={cn(
                      "flex items-center gap-1 font-bold",
                      isLive ? "text-mint" : isFinal ? "text-slate-600" : isDelayed ? "text-crimson" : "text-warning-track"
                    )}>
                      {isLive && <span className="h-1.5 w-1.5 animate-live-dot rounded-full bg-mint" />}
                      {isLive ? "LIVE" : isFinal ? "FINAL" : isDelayed ? "DELAYED" : startTime}
                    </span>
                    <span className="text-[8px] text-slate-600">
                      {g.venue?.name?.split(" ").pop()}
                      {g.doubleHeader === "Y" && g.gameNumber && g.gameNumber > 1 ? ` · G${g.gameNumber}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-scoreboard truncate font-semibold text-slate-200">{g.away.abbreviation ?? g.away.name}</span>
                    <span className={cn("font-scoreboard font-bold num", isLive ? "text-chalk" : "text-slate-300")}>{g.away.score ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-scoreboard truncate font-semibold text-slate-200">{g.home.abbreviation ?? g.home.name}</span>
                    <span className={cn("font-scoreboard font-bold num", isLive ? "text-chalk" : "text-slate-300")}>{g.home.score ?? 0}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
