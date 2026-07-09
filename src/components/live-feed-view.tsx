"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Calendar, ChevronRight, Clock, Filter, Loader2, Radio,
  TrendingUp, Zap, Target, Gauge, CircleDot, ArrowUpRight, Search,
  AlertCircle, Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StrikeZone } from "@/components/strike-zone";
import { PitchLogEntry } from "@/components/pitch-log-entry";
import { LineupChanges } from "@/components/lineup-changes";
import { useSocket, type GameSnapshot } from "@/components/socket-provider";
import { useSavantStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { EnrichedPitch } from "@/lib/types";
import { EmptyState, ErrorState, PitchLogSkeleton, StrikeZoneSkeleton, Skeleton } from "@/components/loading-states";

interface ScheduleGame {
  gamePk: number;
  gameDate: string;
  status: { abstractGameState: string; detailedState: string; statusCode: string };
  venue?: { name: string };
  away: { id: number; name: string; abbreviation?: string; score: number | null; record?: { wins: number; losses: number } };
  home: { id: number; name: string; abbreviation?: string; score: number | null; record?: { wins: number; losses: number } };
}

export function LiveFeedView() {
  const selectedGamePk = useSavantStore((s) => s.selectedGamePk);
  const setSelectedGame = useSavantStore((s) => s.setSelectedGame);

  const { data: scheduleData, isLoading: scheduleLoading, error: scheduleError, refetch: refetchSchedule } = useQuery<{ games: ScheduleGame[]; date: string }>({
    queryKey: ["schedule"],
    queryFn: async () => {
      const res = await fetch("/api/schedule");
      if (!res.ok) throw new Error("schedule failed");
      return res.json();
    },
    refetchInterval: 60_000,
    retry: 2,
  });

  const games = scheduleData?.games ?? [];

  // Auto-pick the first live game if none selected.
  // Priority: Live > Final (has pitch data) > Preview (today's upcoming)
  useEffect(() => {
    if (!selectedGamePk && games.length > 0) {
      const live = games.find((g) => g.status.abstractGameState === "Live");
      const final = games.find((g) => g.status.abstractGameState === "Final");
      const preview = games.find((g) => g.status.abstractGameState === "Preview");
      setSelectedGame((live ?? final ?? preview ?? games[0]).gamePk);
    }
  }, [games, selectedGamePk, setSelectedGame]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      {/* Game selector strip */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <Calendar className="h-4 w-4" />
            Today's Games · {scheduleData?.date ?? "—"}
          </h2>
          <Badge variant="outline" className="border-mint/30 bg-mint/10 text-mint">
            <Radio className="mr-1 h-3 w-3" /> {games.filter(g => g.status.abstractGameState === "Live").length} Live
          </Badge>
        </div>
        {scheduleLoading ? (
          <div className="flex gap-2 overflow-hidden pb-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="min-w-[220px] shrink-0 rounded-xl border border-white/5 bg-white/[0.02] p-3">
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
        ) : scheduleError ? (
          <ErrorState
            title="Couldn't load today's schedule"
            description="The MLB Stats API may be temporarily unavailable."
            onRetry={() => refetchSchedule()}
          />
        ) : games.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No games today"
            description="There are no MLB games scheduled for today or yesterday. Check back later."
          />
        ) : (
          <div className="w-full overflow-x-auto scrollbar-thin -webkit-overflow-scrolling-touch">
            <div className="flex gap-2 pb-2 min-w-min">
              {games.map((g) => {
                const isLive = g.status.abstractGameState === "Live";
                const isFinal = g.status.abstractGameState === "Final";
                const isSelected = selectedGamePk === g.gamePk;
                return (
                  <button
                    key={g.gamePk}
                    onClick={() => setSelectedGame(g.gamePk)}
                    className={cn(
                      "glass-hover relative flex min-w-[220px] shrink-0 flex-col gap-1 rounded-xl border p-3 text-left transition-all",
                      isSelected
                        ? "border-cobalt/40 bg-cobalt/8 box-glow-cobalt"
                        : "border-white/5 hover:border-white/15"
                    )}
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wide">
                      <span className={cn(
                        "flex items-center gap-1 font-bold",
                        isLive ? "text-mint" : isFinal ? "text-slate-500" : "text-amber"
                      )}>
                        {isLive && <span className="h-1.5 w-1.5 animate-live-dot rounded-full bg-mint" />}
                        {g.status.abstractGameState}
                      </span>
                      <span className="text-slate-500">{g.venue?.name?.split(" ").pop()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate">{g.away.abbreviation ?? g.away.name}</span>
                      <span className="font-bold text-white num">{g.away.score ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate">{g.home.abbreviation ?? g.home.name}</span>
                      <span className="font-bold text-white num">{g.home.score ?? 0}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedGamePk ? (
        <GameFeed key={selectedGamePk} gamePk={selectedGamePk} />
      ) : (
        <div className="glass flex h-96 items-center justify-center rounded-2xl text-slate-400">
          Select a game above to view live pitch-by-pitch data
        </div>
      )}
    </div>
  );
}

function GameFeed({ gamePk }: { gamePk: number }) {
  const { subscribeGame, unsubscribeGame, onSnapshot, onPitch, connected } = useSocket();
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [livePitches, setLivePitches] = useState<EnrichedPitch[]>([]);
  const [selectedPitch, setSelectedPitch] = useState<EnrichedPitch | null>(null);

  // Subscribe to game via WS. The parent uses key={gamePk} so state auto-resets on game change.
  useEffect(() => {
    subscribeGame(gamePk);
    const offSnap = onSnapshot((snap) => {
      if (snap.gamePk !== gamePk) return;
      setSnapshot(snap);
      // NOTE: Do NOT push snap.latestPitch into livePitches here.
      // The server's latestPitch is a raw object with nested fields (batter, pitcher,
      // call, count are objects, not flattened strings/numbers). Pushing it raw
      // causes "Objects are not valid as a React child" crashes in PitchLogEntry.
      // The allPitches useMemo below already reconstructs every pitch from
      // snapshot.allPlays + snapshot.savant with proper flattening.
    });
    // Also subscribe to the granular game:pitch event for snappier UI feedback
    // when a new pitch arrives mid-at-bat (the snapshot polls every 8s, but
    // game:pitch fires immediately when a new pitch key is detected).
    const offPitch = onPitch((pitch: any) => {
      if (!pitch || pitch.atBatIndex == null || pitch.pitchNumber == null) return;
      setLivePitches((prev) => {
        const key = `${pitch.atBatIndex}-${pitch.pitchNumber}`;
        if (prev.some((p) => `${p.atBatIndex}-${p.pitchNumber}` === key)) return prev;
        // The game:pitch payload is shaped like EnrichedPitch but may be missing
        // some fields — coerce to the expected type with sensible defaults.
        const enriched: EnrichedPitch = {
          playId: pitch.playId,
          atBatIndex: pitch.atBatIndex,
          inning: pitch.inning ?? 0,
          halfInning: pitch.halfInning ?? "top",
          pitchNumber: pitch.pitchNumber,
          isPitch: true,
          batterId: pitch.batter?.id,
          batterName: pitch.batter?.fullName ?? "—",
          batterSide: pitch.batterSide,
          pitcherId: pitch.pitcher?.id,
          pitcherName: pitch.pitcher?.fullName ?? "—",
          pitchHand: pitch.pitchHand,
          description: pitch.description ?? "",
          playResult: pitch.result ?? "",
          call: pitch.call?.code ?? pitch.call,
          callDescription: pitch.call?.description,
          pitchType: pitch.pitchType,
          pitchName: pitch.pitchName,
          startSpeed: pitch.startSpeed,
          endSpeed: pitch.endSpeed,
          spinRate: pitch.spinRate,
          breakX: pitch.breakX,
          breakZ: pitch.breakZ,
          inducedBreakZ: pitch.inducedBreakZ,
          extension: pitch.extension,
          plateTime: pitch.plateTime,
          pX: pitch.pX ?? pitch.coordinates?.pX,
          pZ: pitch.pZ ?? pitch.coordinates?.pZ,
          zone: pitch.zone,
          szTop: pitch.szTop,
          szBot: pitch.szBot,
          isStrike: !!pitch.isStrike,
          isBall: !!pitch.isBall,
          isInPlay: !!pitch.isInPlay,
          isBarrel: pitch.isBarrel,
          isSword: pitch.isSword,
          exitVelocity: pitch.exitVelocity ?? null,
          launchAngle: pitch.launchAngle ?? null,
          hitDistance: pitch.hitDistance ?? null,
          xBA: pitch.xBA ?? null,
          batSpeed: pitch.batSpeed ?? null,
          balls: pitch.count?.balls ?? 0,
          strikes: pitch.count?.strikes ?? 0,
          outs: pitch.count?.outs ?? 0,
          homeScore: pitch.homeScore ?? 0,
          awayScore: pitch.awayScore ?? 0,
          timestamp: pitch.timestamp,
          result: pitch.result,
          resultDescription: pitch.resultDescription,
        };
        return [enriched, ...prev].slice(0, 60);
      });
    });
    return () => {
      offSnap();
      offPitch();
      unsubscribeGame(gamePk);
    };
  }, [gamePk, subscribeGame, unsubscribeGame, onSnapshot, onPitch]);

  // Fallback: if WS not connected, fetch via REST periodically.
  // For Preview (not-yet-started) games, only fetch once — no point polling.
  // For Live/Final games, poll every 5s for near-real-time updates.
  const { data: restData, isLoading: restLoading } = useQuery<{
    pitches: EnrichedPitch[];
    linescore: any;
    status: any;
    teams: any;
  }>({
    queryKey: ["game-feed-rest", gamePk],
    queryFn: async () => {
      const res = await fetch(`/api/game/${gamePk}`);
      if (!res.ok) throw new Error("feed failed");
      return res.json();
    },
    enabled: !connected || !snapshot,
    // TanStack Query passes the Query object; use query.state.data to avoid TDZ
    refetchInterval: (query: any) => {
      const data = query.state?.data;
      const state = data?.status?.abstractGameState;
      // Stop polling for Preview games (they haven't started)
      if (state === "Preview") return false;
      // Stop polling once WS is connected and we have a snapshot
      if (connected && snapshot) return false;
      return 5_000;
    },
    retry: 2,
  });

  // Use WS data if available, else REST
  const allPitches = useMemo<EnrichedPitch[]>(() => {
    if (snapshot?.savant?.exit_velocity?.length) {
      // Build enriched pitch list from snapshot — iterate ALL pitch events
      // in each play (not just the last one) so the strike zone and pitch log
      // show every pitch of every at-bat.
      const pitches: EnrichedPitch[] = [];
      const savantMap = new Map<string, any>();
      for (const sp of snapshot.savant.exit_velocity) {
        const k = `${sp.inning}-${sp.half_inning}-${sp.ab_number}-${sp.pitch_number ?? 0}`;
        savantMap.set(k, sp);
      }
      for (const play of snapshot.allPlays) {
        const inning = play.about.inning;
        const halfInning = play.about.halfInning;
        const abNumber = play.atBatIndex + 1;
        const events = play.playEvents ?? [];
        for (const ev of events) {
          if (!ev.isPitch) continue;
          const key = `${inning}-${halfInning}-${abNumber}-${ev.pitchNumber ?? 0}`;
          const sp = savantMap.get(key);
          pitches.push({
            playId: ev.playId,
            atBatIndex: play.atBatIndex,
            inning,
            halfInning,
            pitchNumber: ev.pitchNumber ?? 0,
            isPitch: true,
            batterId: play.matchup?.batter?.id,
            batterName: play.matchup?.batter?.fullName ?? "—",
            batterSide: play.matchup?.batterSide?.code,
            pitcherId: play.matchup?.pitcher?.id,
            pitcherName: play.matchup?.pitcher?.fullName ?? "—",
            pitchHand: play.matchup?.pitchHand?.code,
            description: ev.details?.description ?? "",
            playResult: play.result?.event ?? "",
            call: ev.details?.call?.code,
            callDescription: ev.details?.call?.description,
            pitchType: sp?.pitch_type ?? ev.details?.type?.code,
            pitchName: sp?.pitch_name ?? ev.details?.type?.description,
            startSpeed: sp?.start_speed ?? ev.pitchData?.startSpeed,
            endSpeed: sp?.end_speed ?? ev.pitchData?.endSpeed,
            spinRate: sp?.spin_rate ?? ev.pitchData?.spinRate,
            breakX: sp?.breakX ?? ev.pitchData?.breakX,
            breakZ: sp?.breakZ ?? ev.pitchData?.breakZ,
            inducedBreakZ: sp?.inducedBreakZ,
            extension: sp?.extension ?? ev.pitchData?.extension,
            plateTime: sp?.plateTime ?? ev.pitchData?.plateTime,
            pX: sp?.px ?? ev.pitchData?.coordinates?.pX,
            pZ: sp?.pz ?? ev.pitchData?.coordinates?.pZ,
            zone: sp?.zone ?? ev.pitchData?.zone,
            szTop: sp?.sz_top ?? ev.pitchData?.strikeZoneTop,
            szBot: sp?.sz_bot ?? ev.pitchData?.strikeZoneBottom,
            isStrike: !!ev.details?.isStrike,
            isBall: !!ev.details?.isBall,
            isInPlay: !!ev.details?.isInPlay,
            isBarrel: sp?.is_barrel === 1,
            isSword: !!sp?.isSword,
            exitVelocity: sp?.hit_speed != null ? parseFloat(sp.hit_speed) : null,
            launchAngle: sp?.hit_angle != null ? parseFloat(sp.hit_angle) : null,
            hitDistance: sp?.hit_distance != null ? parseFloat(sp.hit_distance) : null,
            xBA: sp?.xba != null && sp.xba !== "" ? parseFloat(sp.xba) : null,
            batSpeed: sp?.batSpeed ?? null,
            balls: ev.count?.balls ?? play.count?.balls ?? 0,
            strikes: ev.count?.strikes ?? play.count?.strikes ?? 0,
            outs: ev.count?.outs ?? play.count?.outs ?? 0,
            homeScore: play.result?.homeScore ?? 0,
            awayScore: play.result?.awayScore ?? 0,
            timestamp: ev.endTime ?? play.playEndTime,
            result: sp?.result,
            resultDescription: sp?.des,
          });
        }
      }
      return pitches.reverse(); // newest first
    }
    return (restData?.pitches ?? []).slice().reverse();
  }, [snapshot, restData]);

  const linescore = snapshot?.linescore ?? restData?.linescore ?? null;
  const status = snapshot?.status ?? restData?.status ?? null;
  const teams = snapshot?.teams ?? restData?.teams ?? null;

  // "Initial loading" = no snapshot yet AND REST is loading AND not a preview game
  const isLoadingInitial = !snapshot && restLoading && status?.abstractGameState !== "Preview";

  // The latest "live" pitches from the WS, which take priority over REST
  const mergedPitches = useMemo(() => {
    if (livePitches.length === 0) return allPitches;
    // Merge by pitch key (atBatIndex-pitchNumber), newest first
    const seen = new Set<string>();
    const result: EnrichedPitch[] = [];
    for (const p of livePitches) {
      const k = `${p.atBatIndex}-${p.pitchNumber}`;
      if (!seen.has(k)) {
        seen.add(k);
        result.push(p);
      }
    }
    for (const p of allPitches) {
      const k = `${p.atBatIndex}-${p.pitchNumber}`;
      if (!seen.has(k)) {
        seen.add(k);
        result.push(p);
      }
    }
    return result.slice(0, 80);
  }, [livePitches, allPitches]);

  const latestPitch = mergedPitches[0] ?? null;
  const recentZonePitches = mergedPitches.slice(0, 30).reverse(); // oldest to newest for strike zone
  const szTop = latestPitch?.szTop ?? 3.5;
  const szBot = latestPitch?.szBot ?? 1.5;

  // Pitch-type distribution
  const pitchTypeStats = useMemo(() => {
    const map = new Map<string, { count: number; avgSpeed: number; total: number; speedCount: number }>();
    for (const p of mergedPitches) {
      if (!p.pitchType) continue;
      const cur = map.get(p.pitchType) ?? { count: 0, avgSpeed: 0, total: 0, speedCount: 0 };
      cur.count++;
      const speed = typeof p.startSpeed === "number" ? p.startSpeed : Number(p.startSpeed);
      if (!isNaN(speed) && p.startSpeed != null) {
        cur.total += speed;
        cur.speedCount++;
        cur.avgSpeed = cur.total / cur.speedCount;
      }
      map.set(p.pitchType, cur);
    }
    return Array.from(map.entries())
      .map(([type, stats]) => ({ type, ...stats }))
      .sort((a, b) => b.count - a.count);
  }, [mergedPitches]);

  // Highlight metrics for the latest pitch
  const latestMetrics = useMemo(() => {
    if (!latestPitch) return [];
    const m: Array<{ label: string; value: string; tone?: string; icon?: any }> = [];
    const num = (v: unknown): number | null => {
      if (v == null) return null;
      const n = typeof v === "number" ? v : Number(v);
      return isNaN(n) ? null : n;
    };
    const fmt = (v: unknown, digits: number): string | null => {
      const n = num(v);
      return n == null ? null : n.toFixed(digits);
    };

    const sp = fmt(latestPitch.startSpeed, 1);
    if (sp != null) m.push({ label: "Pitch Velocity", value: `${sp} mph`, tone: "cobalt", icon: Gauge });

    const ev = num(latestPitch.exitVelocity);
    if (ev != null) {
      m.push({
        label: "Exit Velocity",
        value: `${ev.toFixed(1)} mph`,
        tone: ev >= 95 ? "crimson" : "default",
        icon: Zap,
      });
    }
    const la = fmt(latestPitch.launchAngle, 0);
    if (la != null) m.push({ label: "Launch Angle", value: `${la}°`, tone: "amber", icon: TrendingUp });
    const hd = fmt(latestPitch.hitDistance, 0);
    if (hd != null) m.push({ label: "Hit Distance", value: `${hd} ft`, icon: ArrowUpRight });
    const sr = fmt(latestPitch.spinRate, 0);
    if (sr != null) m.push({ label: "Spin Rate", value: `${sr} rpm`, icon: CircleDot });
    const xba = fmt(latestPitch.xBA, 3);
    if (xba != null) m.push({ label: "xBA", value: xba.replace(/^0/, ""), tone: "mint", icon: Target });
    const bs = fmt(latestPitch.batSpeed, 1);
    if (bs != null) m.push({ label: "Bat Speed", value: `${bs} mph`, icon: Gauge });
    if (latestPitch.zone != null) m.push({ label: "Zone", value: `${latestPitch.zone}`, tone: "cobalt", icon: Target });
    return m;
  }, [latestPitch]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left column: Score + Strike Zone + Lineup */}
      <div className="lg:col-span-4 space-y-4">
        <Scoreboard linescore={linescore} status={status} teams={teams} gamePk={gamePk} />
        <LineupChanges gamePk={gamePk} />
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Target className="h-4 w-4 text-cobalt" />
              Strike Zone
            </h3>
            <Badge variant="outline" className="border-white/10 text-[10px] text-slate-400">
              {recentZonePitches.length} pitches
            </Badge>
          </div>
          <StrikeZone
            pitches={recentZonePitches}
            szTop={szTop}
            szBot={szBot}
            batterSide={latestPitch?.batterSide}
            selectedPitchId={selectedPitch ? `${selectedPitch.atBatIndex}-${selectedPitch.pitchNumber}` : null}
            onSelectPitch={setSelectedPitch}
          />
          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-1.5 min-h-[20px]">
            {pitchTypeStats.length === 0 && (
              <span className="text-[10px] text-slate-600">No pitch types to display</span>
            )}
            {Object.entries({
              FF: "4-Seam", FT: "Sinker", SL: "Slider", CH: "Changeup", CU: "Curveball", FC: "Cutter", ST: "Sweeper", SI: "Sinker",
            }).map(([code, name]) => {
              const has = pitchTypeStats.some((p) => p.type === code);
              if (!has) return null;
              const color = (PITCH_COLOR_LEGEND as any)[code] ?? "#94A3B8";
              return (
                <span key={code} className="inline-flex items-center gap-1 rounded-full bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-300">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {name}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Middle column: Pitch Log */}
      <div className="lg:col-span-4 space-y-4">
        <div className="glass rounded-2xl p-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Activity className="h-4 w-4 text-mint" />
              Pitch-by-Pitch Feed
            </h3>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                connected
                  ? "border-mint/30 bg-mint/10 text-mint"
                  : "border-amber/30 bg-amber/10 text-amber"
              )}
            >
              <span className={cn(
                "mr-1 h-1.5 w-1.5 rounded-full",
                connected ? "animate-live-dot bg-mint" : "bg-amber"
              )} />
              {connected ? "WS Streaming" : "REST Polling"}
            </Badge>
          </div>
          <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px] pr-2">
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {mergedPitches.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
                    {status?.abstractGameState === "Preview" ? (
                      <>
                        <Clock className="h-6 w-6 text-amber" />
                        <div className="text-sm font-medium text-slate-300">Game hasn't started yet</div>
                        <div className="text-xs text-slate-500">Pitch-by-pitch data will appear here once the game begins.</div>
                      </>
                    ) : isLoadingInitial ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-cobalt" />
                        <div className="text-sm">Loading pitches…</div>
                      </>
                    ) : (
                      <>
                        <Activity className="h-6 w-6 text-slate-500" />
                        <div className="text-sm">No pitches available</div>
                        <div className="text-xs text-slate-500">Statcast data may not be available for this game.</div>
                      </>
                    )}
                  </div>
                ) : (
                  mergedPitches.map((p, idx) => (
                    <PitchLogEntry
                      key={`${p.atBatIndex}-${p.pitchNumber}-${idx}`}
                      pitch={p}
                      index={idx}
                      isSelected={selectedPitch?.atBatIndex === p.atBatIndex && selectedPitch?.pitchNumber === p.pitchNumber}
                      onSelect={() => setSelectedPitch(p)}
                      isLatest={idx === 0}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Right column: Latest pitch metrics + pitch mix */}
      <div className="lg:col-span-4 space-y-4">
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Zap className="h-4 w-4 text-crimson" />
              Latest Pitch Metrics
            </h3>
            {latestPitch?.isBarrel && (
              <Badge className="bg-crimson/20 text-crimson border-crimson/40 animate-pulse-glow">
                <Zap className="mr-1 h-3 w-3" fill="currentColor" /> BARREL
              </Badge>
            )}
          </div>
          {latestPitch ? (
            <div>
              <div className="mb-3 rounded-xl bg-white/[0.03] p-3 border border-white/5">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  {latestPitch.inning > 0 ? `${latestPitch.halfInning === "top" ? "Top" : "Bottom"} ${latestPitch.inning}` : "Pre-game"}
                </div>
                <div className="text-sm font-semibold text-white">{latestPitch.batterName}</div>
                <div className="text-xs text-slate-400">vs {latestPitch.pitcherName}</div>
                <div className="mt-1 text-xs text-slate-300">{latestPitch.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {latestMetrics.map((m, i) => {
                  const Icon = m.icon;
                  const toneCls =
                    m.tone === "crimson" ? "text-crimson" :
                    m.tone === "cobalt" ? "text-cobalt" :
                    m.tone === "amber" ? "text-amber" :
                    m.tone === "mint" ? "text-mint" : "text-white";
                  return (
                    <motion.div
                      key={`${m.label}-${i}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5"
                    >
                      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-slate-500">
                        {Icon && <Icon className="h-3 w-3" />}
                        {m.label}
                      </div>
                      <div className={cn("text-lg font-bold num", toneCls)}>{m.value}</div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-slate-400 text-sm">
              No pitches yet
            </div>
          )}
        </div>

        {/* Pitch mix */}
        <div className="glass rounded-2xl p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <Gauge className="h-4 w-4 text-cobalt" />
            Pitch Mix
          </h3>
          <div className="space-y-2">
            {pitchTypeStats.slice(0, 8).map((p) => {
              const color = (PITCH_COLOR_LEGEND as any)[p.type] ?? "#94A3B8";
              const pct = mergedPitches.length > 0 ? (p.count / mergedPitches.length) * 100 : 0;
              return (
                <div key={p.type}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-2 text-slate-300">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      {p.type}
                    </span>
                    <span className="text-slate-400 num">
                      {p.count} · {isFinite(pct) ? pct.toFixed(0) : 0}% · {p.avgSpeed > 0 && isFinite(p.avgSpeed) ? `${p.avgSpeed.toFixed(0)}mph` : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
                    />
                  </div>
                </div>
              );
            })}
            {pitchTypeStats.length === 0 && (
              <div className="text-xs text-slate-500 text-center py-4">No pitch data yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Scoreboard({ linescore, status, teams, gamePk }: { linescore: any; status: any; teams: any; gamePk: number }) {
  const innings = linescore?.innings ?? [];
  const away = linescore?.teams?.away;
  const home = linescore?.teams?.home;
  const awayName = teams?.away?.name ?? "Away";
  const homeName = teams?.home?.name ?? "Home";
  const awayAbbr = teams?.away?.abbreviation ?? "";
  const homeAbbr = teams?.home?.abbreviation ?? "";

  const state = status?.abstractGameState ?? "Final";
  const isInning = status?.inning != null && state === "Live";
  const inningLabel = isInning
    ? `${status.inningState ?? ""} ${status.inning ?? ""}${getOrdinal(status.inning ?? 0)}`
    : state === "Final" ? "Final" : state === "Preview" ? "Preview" : state;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Activity className="h-4 w-4 text-mint" />
          Scoreboard
        </h3>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-bold uppercase tracking-wide",
            state === "Live" ? "border-mint/40 bg-mint/10 text-mint" :
            state === "Final" ? "border-slate-600 bg-slate-700/30 text-slate-400" :
            "border-amber/40 bg-amber/10 text-amber"
          )}
        >
          {state === "Live" && <span className="mr-1 h-1.5 w-1.5 animate-live-dot rounded-full bg-mint" />}
          {inningLabel}
        </Badge>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        {innings.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            {state === "Preview" ? "Game starts soon" : "Scoreboard unavailable"}
          </div>
        ) : (
          <table className="w-full text-xs num">
            <thead>
              <tr className="text-[10px] uppercase text-slate-500">
                <th className="text-left py-1 pr-2 sticky left-0 bg-transparent"></th>
                {innings.map((inn: any) => (
                  <th key={inn.num} className="px-1.5 py-1 text-center min-w-[20px]">{inn.num}</th>
                ))}
                {(away || home) && (
                  <>
                    <th className="px-2 py-1 text-center border-l border-white/5">R</th>
                    <th className="px-1.5 py-1 text-center">H</th>
                    <th className="px-1.5 py-1 text-center">E</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-white/5">
                <td className="py-1.5 pr-2 sticky left-0 bg-transparent">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{awayAbbr}</span>
                    <span className="text-[10px] text-slate-500 hidden sm:inline truncate max-w-[100px]">{awayName.split(" ").slice(-1)[0]}</span>
                  </div>
                </td>
              {innings.map((inn: any) => (
                <td key={inn.num} className="px-1.5 py-1.5 text-center text-slate-300">
                  {inn.away.runs ?? 0}
                </td>
              ))}
              {away && (
                <>
                  <td className="px-2 py-1.5 text-center font-bold text-white border-l border-white/5">{away.runs ?? 0}</td>
                  <td className="px-1.5 py-1.5 text-center text-slate-300">{away.hits ?? 0}</td>
                  <td className="px-1.5 py-1.5 text-center text-slate-300">{away.errors ?? 0}</td>
                </>
              )}
            </tr>
            <tr className="border-t border-white/5">
              <td className="py-1.5 pr-2 sticky left-0 bg-transparent">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">{homeAbbr}</span>
                  <span className="text-[10px] text-slate-500 hidden sm:inline truncate max-w-[100px]">{homeName.split(" ").slice(-1)[0]}</span>
                </div>
              </td>
              {innings.map((inn: any) => (
                <td key={inn.num} className="px-1.5 py-1.5 text-center text-slate-300">
                  {inn.home.runs ?? 0}
                </td>
              ))}
              {home && (
                <>
                  <td className="px-2 py-1.5 text-center font-bold text-white border-l border-white/5">{home.runs ?? 0}</td>
                  <td className="px-1.5 py-1.5 text-center text-slate-300">{home.hits ?? 0}</td>
                  <td className="px-1.5 py-1.5 text-center text-slate-300">{home.errors ?? 0}</td>
                </>
              )}
            </tr>
          </tbody>
        </table>
        )}
      </div>
      <div className="mt-2 text-[10px] text-slate-500">GamePk: <span className="font-mono">{gamePk}</span></div>
    </div>
  );
}

function getOrdinal(n: number): string {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}

const PITCH_COLOR_LEGEND: Record<string, string> = {
  FF: "#FF6B6B",
  FT: "#FF8E72",
  FC: "#FFB547",
  SI: "#FF7A45",
  FS: "#C68BFF",
  SL: "#4DA3FF",
  ST: "#5DADEC",
  CU: "#3DDBA0",
  KC: "#7BE3B4",
  CS: "#A78BFA",
  SC: "#A78BFA",
  CH: "#FFB547",
  KN: "#94A3B8",
  PO: "#94A3B8",
  FO: "#94A3B8",
};
