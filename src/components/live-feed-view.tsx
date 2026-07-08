"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Calendar, ChevronRight, Clock, Filter, Loader2, Radio,
  TrendingUp, Zap, Target, Gauge, CircleDot, ArrowUpRight, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StrikeZone } from "@/components/strike-zone";
import { PitchLogEntry } from "@/components/pitch-log-entry";
import { useSocket, type GameSnapshot } from "@/components/socket-provider";
import { useSavantStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { EnrichedPitch } from "@/lib/types";

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

  const { data: scheduleData, isLoading: scheduleLoading } = useQuery<{ games: ScheduleGame[]; date: string }>({
    queryKey: ["schedule"],
    queryFn: async () => {
      const res = await fetch("/api/schedule");
      if (!res.ok) throw new Error("schedule failed");
      return res.json();
    },
    refetchInterval: 60_000,
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
          <div className="flex h-20 items-center justify-center text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading schedule…
          </div>
        ) : (
          <ScrollArea className="w-full overflow-x-auto scrollbar-thin">
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
          </ScrollArea>
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
  const { subscribeGame, unsubscribeGame, onSnapshot, connected } = useSocket();
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [livePitches, setLivePitches] = useState<EnrichedPitch[]>([]);
  const [selectedPitch, setSelectedPitch] = useState<EnrichedPitch | null>(null);
  const snapshotVersionRef = useRef(0);

  // Subscribe to game via WS. The parent uses key={gamePk} so state auto-resets on game change.
  useEffect(() => {
    subscribeGame(gamePk);
    const offSnap = onSnapshot((snap) => {
      if (snap.gamePk !== gamePk) return;
      snapshotVersionRef.current++;
      setSnapshot(snap);
      // If we have a latest pitch and it's new, add to live pitches
      if (snap.latestPitch) {
        setLivePitches((prev) => {
          const key = `${snap.latestPitch!.atBatIndex}-${snap.latestPitch!.pitchNumber}`;
          if (prev.some((p) => `${p.atBatIndex}-${p.pitchNumber}` === key)) return prev;
          return [snap.latestPitch!, ...prev].slice(0, 60);
        });
      }
    });
    return () => {
      offSnap();
      unsubscribeGame(gamePk);
    };
  }, [gamePk, subscribeGame, unsubscribeGame, onSnapshot]);

  // Fallback: if WS not connected, fetch via REST periodically
  const { data: restData } = useQuery<{
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
    refetchInterval: !connected || !snapshot ? 10_000 : false,
  });

  // Use WS data if available, else REST
  const allPitches = useMemo<EnrichedPitch[]>(() => {
    if (snapshot?.savant?.exit_velocity?.length) {
      // Build enriched pitch list from snapshot
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
        // playEvents come from the play, but our snapshot only has lastEvent
        // So we synthesize one pitch per play if it has a pitch event
        if (play.lastEvent?.isPitch) {
          const key = `${inning}-${halfInning}-${abNumber}-${play.lastEvent.pitchNumber ?? 0}`;
          const sp = savantMap.get(key);
          pitches.push({
            playId: play.lastEvent.playId,
            atBatIndex: play.atBatIndex,
            inning,
            halfInning,
            pitchNumber: play.lastEvent.pitchNumber ?? 0,
            isPitch: true,
            batterId: play.matchup?.batter?.id,
            batterName: play.matchup?.batter?.fullName ?? "—",
            batterSide: play.matchup?.batterSide?.code,
            pitcherId: play.matchup?.pitcher?.id,
            pitcherName: play.matchup?.pitcher?.fullName ?? "—",
            pitchHand: play.matchup?.pitchHand?.code,
            description: play.lastEvent.details?.description ?? "",
            playResult: play.result?.event ?? "",
            call: play.lastEvent.details?.call?.code,
            callDescription: play.lastEvent.details?.call?.description,
            pitchType: sp?.pitch_type ?? play.lastEvent.details?.type?.code,
            pitchName: sp?.pitch_name ?? play.lastEvent.details?.type?.description,
            startSpeed: sp?.start_speed ?? play.lastEvent.pitchData?.startSpeed,
            endSpeed: sp?.end_speed ?? play.lastEvent.pitchData?.endSpeed,
            spinRate: sp?.spin_rate ?? play.lastEvent.pitchData?.spinRate,
            breakX: sp?.breakX ?? play.lastEvent.pitchData?.breakX,
            breakZ: sp?.breakZ ?? play.lastEvent.pitchData?.breakZ,
            inducedBreakZ: sp?.inducedBreakZ,
            extension: sp?.extension ?? play.lastEvent.pitchData?.extension,
            plateTime: sp?.plateTime ?? play.lastEvent.pitchData?.plateTime,
            pX: sp?.px ?? play.lastEvent.pitchData?.coordinates?.pX,
            pZ: sp?.pz ?? play.lastEvent.pitchData?.coordinates?.pZ,
            zone: sp?.zone ?? play.lastEvent.pitchData?.zone,
            szTop: sp?.sz_top ?? play.lastEvent.pitchData?.strikeZoneTop,
            szBot: sp?.sz_bot ?? play.lastEvent.pitchData?.strikeZoneBottom,
            isStrike: !!play.lastEvent.details?.isStrike,
            isBall: !!play.lastEvent.details?.isBall,
            isInPlay: !!play.lastEvent.details?.isInPlay,
            isBarrel: sp?.is_barrel === 1,
            isSword: !!sp?.isSword,
            exitVelocity: sp?.hit_speed != null ? parseFloat(sp.hit_speed) : null,
            launchAngle: sp?.hit_angle != null ? parseFloat(sp.hit_angle) : null,
            hitDistance: sp?.hit_distance != null ? parseFloat(sp.hit_distance) : null,
            xBA: sp?.xba != null && sp.xba !== "" ? parseFloat(sp.xba) : null,
            batSpeed: sp?.batSpeed ?? null,
            balls: play.count?.balls ?? 0,
            strikes: play.count?.strikes ?? 0,
            outs: play.count?.outs ?? 0,
            homeScore: play.result?.homeScore ?? 0,
            awayScore: play.result?.awayScore ?? 0,
            timestamp: play.lastEvent?.endTime ?? play.playEndTime,
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
    const map = new Map<string, { count: number; avgSpeed: number; total: number }>();
    for (const p of mergedPitches) {
      if (!p.pitchType) continue;
      const cur = map.get(p.pitchType) ?? { count: 0, avgSpeed: 0, total: 0 };
      cur.count++;
      if (p.startSpeed != null) {
        cur.total += p.startSpeed;
        cur.avgSpeed = cur.total / cur.count;
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
    if (latestPitch.startSpeed != null) {
      m.push({ label: "Pitch Velocity", value: `${latestPitch.startSpeed.toFixed(1)} mph`, tone: "cobalt", icon: Gauge });
    }
    if (latestPitch.exitVelocity != null) {
      const isHard = latestPitch.exitVelocity >= 95;
      m.push({
        label: "Exit Velocity",
        value: `${latestPitch.exitVelocity.toFixed(1)} mph`,
        tone: isHard ? "crimson" : "default",
        icon: Zap,
      });
    }
    if (latestPitch.launchAngle != null) {
      m.push({ label: "Launch Angle", value: `${latestPitch.launchAngle.toFixed(0)}°`, tone: "amber", icon: TrendingUp });
    }
    if (latestPitch.hitDistance != null) {
      m.push({ label: "Hit Distance", value: `${latestPitch.hitDistance.toFixed(0)} ft`, icon: ArrowUpRight });
    }
    if (latestPitch.spinRate != null) {
      m.push({ label: "Spin Rate", value: `${latestPitch.spinRate.toFixed(0)} rpm`, icon: CircleDot });
    }
    if (latestPitch.xBA != null) {
      m.push({ label: "xBA", value: latestPitch.xBA.toFixed(3).replace(/^0/, ""), tone: "mint", icon: Target });
    }
    if (latestPitch.batSpeed != null) {
      m.push({ label: "Bat Speed", value: `${latestPitch.batSpeed.toFixed(1)} mph`, icon: Gauge });
    }
    if (latestPitch.zone != null) {
      m.push({ label: "Zone", value: `${latestPitch.zone}`, tone: "cobalt", icon: Target });
    }
    return m;
  }, [latestPitch]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left column: Score + Strike Zone */}
      <div className="lg:col-span-4 space-y-4">
        <Scoreboard linescore={linescore} status={status} teams={teams} gamePk={gamePk} />
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
          <div className="mt-3 flex flex-wrap gap-1.5">
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
            <Badge variant="outline" className="border-mint/30 bg-mint/10 text-mint text-[10px]">
              <span className="mr-1 h-1.5 w-1.5 animate-live-dot rounded-full bg-mint" />
              {connected ? "Streaming" : "Polling"}
            </Badge>
          </div>
          <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px] pr-2">
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {mergedPitches.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-slate-400">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Waiting for pitches…
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
                      {p.count} · {pct.toFixed(0)}% · {p.avgSpeed > 0 ? `${p.avgSpeed.toFixed(0)}mph` : "—"}
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
