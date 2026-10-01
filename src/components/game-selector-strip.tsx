"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/loading-states";
import { useSavantStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { BaseballMark } from "@/components/ui/baseball-mark";
import { getDisplayTeamColor } from "@/lib/team-colors";

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
  const finalCount = games.filter((g) => g.status.abstractGameState === "Final").length;
  const upcomingCount = games.filter((g) => g.status.abstractGameState === "Preview").length;
  const displayDate = data?.date
    ? new Date(`${data.date}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "Loading today’s slate";

  return (
    <div className={cn("mb-5", className)}>
      <section className="scorebook-panel mb-4 px-5 py-5 sm:px-7 sm:py-6" aria-labelledby="slate-heading">
        <BaseballMark
          size={230}
          className="pointer-events-none text-heritage-red/[0.07]"
          style={{ position: "absolute", right: "-2.5rem", top: "-4.5rem" }}
        />
        <div className="relative grid items-end gap-5 lg:grid-cols-[1fr_auto]">
          <div>
            <span className="editorial-kicker">Daily scorebook</span>
            <h1 id="slate-heading" className="mt-3 max-w-3xl font-scoreboard text-4xl font-black uppercase leading-[0.9] tracking-[-0.025em] text-chalk sm:text-5xl">
              The Diamond <span className="text-heritage-red">Desk</span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="font-scoreboard text-sm font-semibold uppercase tracking-[0.08em] text-slate-400">
                {displayDate}
              </p>
              <span className="hidden h-3 w-px bg-slate-500 sm:block" aria-hidden />
              <p className="max-w-xl text-xs leading-relaxed text-slate-500 sm:text-sm">
                Every score, pitch, and pressure moment from around the league.
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-3 border-y border-chalk sm:min-w-[360px] sm:border sm:bg-background/20">
            {[
              { label: "Live", value: liveCount, tone: "text-mint" },
              { label: "Upcoming", value: upcomingCount, tone: "text-warning-track" },
              { label: "Final", value: finalCount, tone: "text-slate-300" },
            ].map((item, index) => (
              <div key={item.label} className={cn("px-3 py-3 text-center sm:px-5", index > 0 && "border-l border-chalk")}>
                <dd className={cn("broadcast-number text-3xl font-black leading-none", item.tone)}>{item.value}</dd>
                <dt className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">{item.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mb-2 flex items-end justify-between gap-4">
        <div>
          <span className="editorial-kicker">League board</span>
          <h2 className="mt-1 font-scoreboard text-lg font-bold uppercase tracking-wide text-chalk">Choose a matchup</h2>
        </div>
        {liveCount > 0 && (
          <Badge variant="outline" className="scorecard-cut border-mint/30 bg-mint/10 font-scoreboard text-mint">
            <Radio className="mr-1 h-3 w-3 animate-live-dot" /> {liveCount} LIVE
          </Badge>
        )}
      </div>
      <div className="scorebook-rule mb-3" />

      {isLoading ? (
        <div className="flex gap-2 overflow-hidden pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="scorecard-cut min-w-[220px] shrink-0 border border-chalk bg-midnight/40 p-3">
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
          <div className="flex min-w-min gap-2 pb-1.5">
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
                    "scorecard-cut hover-lift relative flex min-w-[220px] shrink-0 flex-col gap-2 overflow-hidden border px-3 pb-3 pt-2.5 text-left transition-all",
                    isSelected
                      ? "border-heritage-red/55 bg-heritage-red/8 shadow-[0_8px_30px_-16px_rgba(213,74,67,0.8)]"
                      : isLive
                      ? "border-mint/25 bg-mint/5 shimmer-sweep"
                      : isFinal
                      ? "border-chalk bg-midnight/30 opacity-70"
                      : "border-chalk bg-midnight/40"
                  )}
                >
                  <span className="absolute inset-x-0 top-0 flex h-[3px]" aria-hidden>
                    <span className="flex-1" style={{ backgroundColor: getDisplayTeamColor(g.away.id) }} />
                    <span className="flex-1" style={{ backgroundColor: getDisplayTeamColor(g.home.id) }} />
                  </span>
                  <div className="font-scoreboard flex items-center justify-between text-[9px] uppercase tracking-wide">
                    <span className={cn(
                      "flex items-center gap-1 font-bold",
                      isLive ? "text-mint" : isFinal ? "text-slate-600" : isDelayed ? "text-crimson" : "text-warning-track"
                    )}>
                      {isLive && <span className="h-1.5 w-1.5 animate-live-dot rounded-full bg-mint" />}
                      {isLive ? "LIVE" : isFinal ? "FINAL" : isDelayed ? "DELAYED" : startTime}
                    </span>
                    <span className="max-w-[105px] truncate font-mono text-[7px] tracking-[0.12em] text-slate-600">
                      {isSelected ? "ON THE DESK" : g.venue?.name?.split(" ").pop()}
                      {g.doubleHeader === "Y" && g.gameNumber && g.gameNumber > 1 ? ` · G${g.gameNumber}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getDisplayTeamColor(g.away.id) }} aria-hidden />
                      <span className="font-scoreboard truncate text-sm font-bold uppercase tracking-wide text-slate-200">{g.away.abbreviation ?? g.away.name}</span>
                    </span>
                    <span className={cn("broadcast-number text-2xl font-black leading-none", isLive ? "text-chalk" : "text-slate-300")}>{g.away.score ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-dashed border-chalk pt-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getDisplayTeamColor(g.home.id) }} aria-hidden />
                      <span className="font-scoreboard truncate text-sm font-bold uppercase tracking-wide text-slate-200">{g.home.abbreviation ?? g.home.name}</span>
                    </span>
                    <span className={cn("broadcast-number text-2xl font-black leading-none", isLive ? "text-chalk" : "text-slate-300")}>{g.home.score ?? 0}</span>
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
