"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Clock, Loader2,
  TrendingUp, Zap, Target, Gauge, CircleDot, ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StrikeZone } from "@/components/strike-zone";
import { PitchLogEntry } from "@/components/pitch-log-entry";
import { AtBatDetailsModal } from "@/components/at-bat-details-modal";
import { LineupChanges } from "@/components/lineup-changes";
import { WinProbabilityChart } from "@/components/win-probability-chart";
import { HeroScoreboard } from "@/components/hero-scoreboard";
import { StickyMiniScoreboard } from "@/components/sticky-mini-scoreboard";
import { LiveGameThread } from "@/components/live-game-thread";
import { WPALeaderboard } from "@/components/wpa-leaderboard";
import { StreakTracker } from "@/components/streak-tracker";
import { BullpenStatus } from "@/components/bullpen-status";
import { GameSelectorStrip } from "@/components/game-selector-strip";
import { useGamePitches, updatedAgoLabel } from "@/hooks/use-game-pitches";
import { latestAtBatIndex } from "@/lib/at-bat";
import { useSavantStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { EnrichedPitch, Linescore, GameStatus, FeedTeam } from "@/lib/types";

/** How many pitch rows the log renders at once. */
const PITCH_LOG_LIMIT = 80;

/** One inning row in the linescore. */
type InningLine = Linescore["innings"][number];


export function LiveFeedView() {
  const selectedGamePk = useSavantStore((s) => s.selectedGamePk);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
      {/* Same picker the Live At-Bat tab uses, so the selected game — and the
          auto-pick that chooses one on first load — stay in sync across tabs. */}
      <GameSelectorStrip />

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
  const setView = useSavantStore((s) => s.setView);
  const setSelectedAtBatIndex = useSavantStore((s) => s.setSelectedAtBatIndex);
  const [selectedPitch, setSelectedPitch] = useState<EnrichedPitch | null>(null);
  const [viewAtBatIndex, setViewAtBatIndex] = useState<number | null>(null);
  const [highLeverageOnly, setHighLeverageOnly] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Re-render once a second so the "updated Xs ago" label stays fresh without
  // needing a fetch — it's purely a clock tick against `lastUpdated`.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Every pitch of the game, merged from the WebSocket push and the REST
  // fallback. Shared with the Live At-Bat tab — see use-game-pitches.ts. The
  // parent mounts this with key={gamePk}, which the hook requires.
  const {
    pitches: mergedPitches,
    linescore,
    status,
    teams,
    isLoadingInitial,
    connected,
    lastUpdated: effectiveLastUpdated,
  } = useGamePitches(gamePk);

  const viewAtBatPitches = useMemo(
    () => (viewAtBatIndex != null ? mergedPitches.filter((p) => p.atBatIndex === viewAtBatIndex) : []),
    [mergedPitches, viewAtBatIndex]
  );

  // Deep-link into the Live At-Bat tab, pinned on whatever at-bat the modal was
  // showing. Pinning the still-live at-bat would freeze the tab right as it's
  // most interesting, so that case resolves to "follow live" instead.
  const openAtBatInTab = () => {
    if (viewAtBatIndex == null) return;
    const liveIndex = latestAtBatIndex(mergedPitches);
    setSelectedAtBatIndex(viewAtBatIndex === liveIndex ? null : viewAtBatIndex);
    setView("live-at-bat");
    setViewAtBatIndex(null);
  };

  // High-leverage filter: only show critical game situations
  // - Bases loaded (2+ runners)
  // - Full count (3-2)
  // - Late innings (7+)
  // - Scoring plays / RBIs
  // - 2 outs with runners on
  const displayPitches = useMemo(() => {
    const matching = highLeverageOnly
      ? mergedPitches.filter((p) => {
          // Full count (3-2)
          if (p.balls >= 3 && p.strikes >= 2) return true;
          // Late innings (7+)
          if (p.inning >= 7) return true;
          // In-play with RBI potential
          if (p.isInPlay && (p.exitVelocity ?? 0) >= 95) return true;
          // Barrel (hard-hit ball)
          if (p.isBarrel) return true;
          // 2 outs (pressure situation)
          if (p.outs >= 2 && (p.balls >= 2 || p.strikes >= 1)) return true;
          return false;
        })
      : mergedPitches;
    // The log animates a row per pitch, so it renders a window of the most
    // recent ones rather than the whole game the hook now hands over.
    return matching.slice(0, PITCH_LOG_LIMIT);
  }, [mergedPitches, highLeverageOnly]);

  const latestPitch = displayPitches[0] ?? mergedPitches[0] ?? null;
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
    const m: Array<{ label: string; value: string; tone?: string; icon?: LucideIcon }> = [];
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
    <div>
      {/* Sticky mini-scoreboard (appears on scroll) */}
      {teams?.away?.id && teams?.home?.id && (
        <StickyMiniScoreboard
          gamePk={gamePk}
          awayAbbr={teams.away.abbreviation ?? teams.away.name}
          homeAbbr={teams.home.abbreviation ?? teams.home.name}
          awayName={teams.away.name}
          homeName={teams.home.name}
          awayTeamId={teams.away.id}
          homeTeamId={teams.home.id}
          awayScore={linescore?.teams?.away?.runs ?? 0}
          homeScore={linescore?.teams?.home?.runs ?? 0}
          inning={status?.inning ?? 0}
          inningState={status?.inningState ?? ""}
          isLive={status?.abstractGameState === "Live"}
          isFinal={status?.abstractGameState === "Final"}
          outs={linescore?.outs ?? 0}
          balls={linescore?.balls ?? 0}
          strikes={linescore?.strikes ?? 0}
          status={status}
        />
      )}
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left column: Hero Scoreboard + Win Prob + Lineup + Strike Zone */}
      <div className="lg:col-span-4 space-y-4">
        {teams?.away?.id && teams?.home?.id ? (
          <HeroScoreboard
            gamePk={gamePk}
            awayTeamId={teams.away.id}
            homeTeamId={teams.home.id}
            awayAbbr={teams.away.abbreviation ?? teams.away.name}
            homeAbbr={teams.home.abbreviation ?? teams.home.name}
            awayName={teams.away.name}
            homeName={teams.home.name}
            awayScore={linescore?.teams?.away?.runs ?? 0}
            homeScore={linescore?.teams?.home?.runs ?? 0}
            status={status}
            linescore={linescore}
          />
        ) : (
          <Scoreboard linescore={linescore} status={status} teams={teams} gamePk={gamePk} />
        )}
        <WinProbabilityChart gamePk={gamePk} />
        <LineupChanges gamePk={gamePk} />
        <StreakTracker />
        {teams?.away?.id && <BullpenStatus teamId={teams.away.id} teamName={teams.away.abbreviation ?? teams.away.name} />}
        {teams?.home?.id && <BullpenStatus teamId={teams.home.id} teamName={teams.home.abbreviation ?? teams.home.name} />}
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
              const color = PITCH_COLOR_LEGEND[code] ?? "#94A3B8";
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
          <div className="mb-1 flex items-center justify-between px-1 gap-2">
            <h3 className="font-scoreboard flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
              <Activity className="h-4 w-4 text-mint" />
              Pitch Feed
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setHighLeverageOnly(!highLeverageOnly)}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wide font-scoreboard transition-all",
                  highLeverageOnly
                    ? "border-warning-track/40 bg-warning-track/15 text-warning-track box-glow-warning"
                    : "border-chalk bg-midnight/40 text-slate-400 hover:text-chalk"
                )}
              >
                <Zap className="h-3 w-3" fill={highLeverageOnly ? "currentColor" : "none"} />
                High Lev
              </button>
              <Badge
                variant="outline"
                title={connected ? "Receiving live pitch-by-pitch updates" : "Live connection unavailable — falling back to periodic polling"}
                className={cn(
                  "text-[10px]",
                  connected
                    ? "border-mint/30 bg-mint/10 text-mint"
                    : "border-warning-track/30 bg-warning-track/10 text-warning-track"
                )}
              >
                <span className={cn(
                  "mr-1 h-1.5 w-1.5 rounded-full",
                  connected ? "animate-live-dot bg-mint" : "bg-warning-track"
                )} />
                {connected ? "Live" : "Polling"}
              </Badge>
            </div>
          </div>
          {updatedAgoLabel(effectiveLastUpdated, now) && (
            <div className="mb-2 px-1 text-[10px] text-slate-500">
              {updatedAgoLabel(effectiveLastUpdated, now)}
            </div>
          )}
          <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px] pr-2">
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {displayPitches.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
                    {status?.abstractGameState === "Preview" ? (
                      <>
                        <Clock className="h-6 w-6 text-warning-track" />
                        <div className="font-scoreboard text-sm font-medium text-slate-300 uppercase tracking-wide">Game hasn't started</div>
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
                  displayPitches.map((p, idx) => (
                    <PitchLogEntry
                      key={`${p.atBatIndex}-${p.pitchNumber}`}
                      pitch={p}
                      index={idx}
                      isSelected={selectedPitch?.atBatIndex === p.atBatIndex && selectedPitch?.pitchNumber === p.pitchNumber}
                      onSelect={() => setSelectedPitch(p)}
                      isLatest={idx === 0}
                      onViewAtBat={setViewAtBatIndex}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Right column: WPA + Latest pitch metrics + pitch mix + Game Thread */}
      <div className="lg:col-span-4 space-y-4">
        <WPALeaderboard gamePk={gamePk} />
        <LiveGameThread gamePk={gamePk} />
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
              const color = PITCH_COLOR_LEGEND[p.type] ?? "#94A3B8";
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
    <AnimatePresence>
      {viewAtBatIndex != null && viewAtBatPitches.length > 0 && (
        <AtBatDetailsModal
          pitches={viewAtBatPitches}
          awayTeamId={teams?.away?.id}
          homeTeamId={teams?.home?.id}
          onClose={() => setViewAtBatIndex(null)}
          onOpenInTab={openAtBatInTab}
        />
      )}
    </AnimatePresence>
    </div>
  );
}

function Scoreboard({ linescore, status, teams, gamePk }: {
  linescore: Linescore | null;
  status: GameStatus | null;
  teams: { away?: FeedTeam; home?: FeedTeam } | null;
  gamePk: number;
}) {
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
    <div className="card-broadcast rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-scoreboard flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
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
                {innings.map((inn: InningLine) => (
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
              {innings.map((inn: InningLine) => (
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
              {innings.map((inn: InningLine) => (
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
