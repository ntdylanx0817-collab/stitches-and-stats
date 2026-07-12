"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Loader2, Radio, ChevronDown, X, Activity } from "lucide-react";
import { useAnimatedValue } from "@/components/animated-counter";
import { getTeamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";

interface HeroScoreboardProps {
  gamePk: number;
  awayTeamId: number;
  homeTeamId: number;
  awayAbbr: string;
  homeAbbr: string;
  awayName: string;
  homeName: string;
  awayScore: number;
  homeScore: number;
  status: any;
  linescore: any;
  gameDate?: string;
}

interface GameOdds {
  awayWinProb: number;
  homeWinProb: number;
  projectedTotal: number;
  awayProjectedRuns: number;
  homeProjectedRuns: number;
  awayMoneyline: number;
  homeMoneyline: number;
  runLine: number;
  insight: string;
}

export function HeroScoreboard({
  gamePk, awayTeamId, homeTeamId,
  awayAbbr, homeAbbr, awayName, homeName,
  awayScore, homeScore, status, linescore, gameDate,
}: HeroScoreboardProps) {
  const [expanded, setExpanded] = useState(false);
  const state = status?.abstractGameState ?? "Preview";
  const isInning = status?.inning != null && state === "Live";
  const inningLabel = isInning
    ? `${status.inningState ?? ""} ${status.inning ?? ""}`
    : state === "Final" ? "Final" : state === "Preview" ? "Preview" : state;

  // Fetch live game state for base runners
  const { data: liveState } = useQuery<{
    onFirst: boolean; onSecond: boolean; onThird: boolean;
    outs: number; balls: number; strikes: number;
    inning: number; inningState: string; isTopInning: boolean;
    currentBatter?: string; currentPitcher?: string;
  }>({
    queryKey: ["live-state", gamePk],
    queryFn: async () => {
      const res = await fetch(`/api/game/${gamePk}`);
      if (!res.ok) throw new Error("failed");
      const d = await res.json();
      const ls = d.linescore ?? {};
      // Get base runners from the current play
      const plays = d.status ? d : null;
      return {
        onFirst: false, onSecond: false, onThird: false, // Will be filled from snapshot
        outs: ls.outs ?? 0,
        balls: ls.balls ?? 0,
        strikes: ls.strikes ?? 0,
        inning: ls.currentInning ?? 0,
        inningState: ls.inningState ?? "",
        isTopInning: ls.isTopInning ?? true,
      };
    },
    refetchInterval: state === "Live" ? 5_000 : false,
    enabled: state === "Live",
    staleTime: 3_000,
  });

  // Fetch odds for preview games
  const { data: odds } = useQuery<GameOdds>({
    queryKey: ["odds", awayTeamId, homeTeamId],
    queryFn: async () => {
      const res = await fetch(`/api/odds?awayTeamId=${awayTeamId}&homeTeamId=${homeTeamId}&gamePk=${gamePk}`);
      if (!res.ok) throw new Error("odds failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    enabled: state === "Preview",
  });

  const awayColor = getTeamColor(awayTeamId);
  const homeColor = getTeamColor(homeTeamId);

  const startTime = gameDate
    ? new Date(gameDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    : null;

  const outs = liveState?.outs ?? 0;
  const balls = liveState?.balls ?? 0;
  const strikes = liveState?.strikes ?? 0;

  return (
    <>
    <motion.button
      onClick={() => setExpanded(true)}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      className="card-broadcast rounded-2xl overflow-hidden relative w-full text-left"
      style={{
        background: `linear-gradient(135deg, ${awayColor.primary}15, ${homeColor.primary}15)`,
      }}
    >
      {/* Team color accent strips */}
      <div className="absolute top-0 left-0 right-0 h-0.5 flex">
        <div className="flex-1" style={{ background: awayColor.primary }} />
        <div className="flex-1" style={{ background: homeColor.primary }} />
      </div>

      <div className="p-4 sm:p-5">
        {/* Top bar: status + inning */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {state === "Live" && (
              <span className="flex items-center gap-1.5 rounded-md bg-mint/15 px-2 py-0.5">
                <span className="h-1.5 w-1.5 animate-live-dot rounded-full bg-mint" />
                <span className="font-scoreboard text-[10px] font-bold uppercase tracking-wide text-mint">LIVE</span>
              </span>
            )}
            {state === "Final" && (
              <span className="font-scoreboard rounded-md bg-slate-700/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">FINAL</span>
            )}
            {state === "Preview" && startTime && (
              <span className="font-scoreboard rounded-md bg-warning-track/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-track">{startTime}</span>
            )}
          </div>
          {isInning && (
            <div className="font-scoreboard text-xs font-bold uppercase tracking-wide text-chalk">
              {status.inningState} {status.inning}
            </div>
          )}
        </div>

        {/* Main scoreboard: two teams + score */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Away team */}
          <div className="flex flex-col items-center sm:flex-row sm:justify-end sm:gap-4">
            <div className="text-center sm:text-right">
              <div
                className="font-scoreboard text-2xl sm:text-3xl font-black uppercase tracking-tight"
                style={{ color: awayColor.primary === "#000000" || awayColor.primary === "#27251F" ? "#f8f9fa" : awayColor.primary }}
              >
                {awayAbbr}
              </div>
              <div className="text-[9px] text-slate-500 truncate max-w-[120px]">{awayName}</div>
            </div>
            <motion.div
              key={awayScore}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="font-scoreboard text-5xl sm:text-6xl font-black num text-chalk leading-none mt-1 sm:mt-0"
            >
              <AnimatedScoreDisplay value={awayScore ?? 0} />
            </motion.div>
          </div>

          {/* Center: VS + base runners */}
          <div className="flex flex-col items-center gap-2">
            <div className="font-scoreboard text-xs text-slate-600">VS</div>
            {state === "Live" ? (
              <BaseRunnerDiamond outs={outs} balls={balls} strikes={strikes} />
            ) : odds ? (
              <div className="flex flex-col items-center gap-1 py-1">
                <div className="font-scoreboard text-[9px] uppercase text-slate-500">Proj Total</div>
                <div className="font-scoreboard text-lg font-bold text-warning-track num">{odds.projectedTotal.toFixed(1)}</div>
                <div className="font-scoreboard text-[8px] text-slate-600">runs</div>
              </div>
            ) : null}
          </div>

          {/* Home team */}
          <div className="flex flex-col items-center sm:flex-row sm:gap-4">
            <motion.div
              key={homeScore}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="font-scoreboard text-5xl sm:text-6xl font-black num text-chalk leading-none mb-1 sm:mb-0"
            >
              <AnimatedScoreDisplay value={homeScore ?? 0} />
            </motion.div>
            <div className="text-center sm:text-left">
              <div
                className="font-scoreboard text-2xl sm:text-3xl font-black uppercase tracking-tight"
                style={{ color: homeColor.primary === "#000000" || homeColor.primary === "#27251F" ? "#f8f9fa" : homeColor.primary }}
              >
                {homeAbbr}
              </div>
              <div className="text-[9px] text-slate-500 truncate max-w-[120px]">{homeName}</div>
            </div>
          </div>
        </div>

        {/* Odds row (preview games) */}
        {state === "Preview" && odds && (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-chalk pt-3">
            <div className="text-center">
              <div className="font-scoreboard text-[8px] uppercase text-slate-500">{awayAbbr} ML</div>
              <div className={cn("font-scoreboard text-sm font-bold num", odds.awayMoneyline < 0 ? "text-crimson" : "text-mint")}>
                {odds.awayMoneyline > 0 ? "+" : ""}{odds.awayMoneyline}
              </div>
            </div>
            <div className="text-center">
              <div className="font-scoreboard text-[8px] uppercase text-slate-500">O/U</div>
              <div className="font-scoreboard text-sm font-bold text-warning-track num">{odds.projectedTotal.toFixed(1)}</div>
            </div>
            <div className="text-center">
              <div className="font-scoreboard text-[8px] uppercase text-slate-500">{homeAbbr} ML</div>
              <div className={cn("font-scoreboard text-sm font-bold num", odds.homeMoneyline < 0 ? "text-crimson" : "text-mint")}>
                {odds.homeMoneyline > 0 ? "+" : ""}{odds.homeMoneyline}
              </div>
            </div>
          </div>
        )}

        {/* Inning-by-inning linescore (compact) */}
        {linescore?.innings && linescore.innings.length > 0 && (
          <div className="mt-3 overflow-x-auto scrollbar-thin">
            <div className="flex justify-center gap-px min-w-min">
              {/* Inning numbers */}
              <div className="flex flex-col items-center gap-px mr-1">
                <div className="font-scoreboard text-[8px] text-slate-600 h-4 flex items-center">{awayAbbr}</div>
                <div className="font-scoreboard text-[8px] text-slate-600 h-4 flex items-center">{homeAbbr}</div>
              </div>
              {linescore.innings.map((inn: any) => (
                <div key={inn.num} className="flex flex-col items-center gap-px">
                  <div className="font-scoreboard text-[8px] text-slate-600 w-5 text-center">{inn.num}</div>
                  <div className="font-scoreboard text-[10px] text-slate-300 w-5 text-center num">{inn.away?.runs ?? 0}</div>
                  <div className="font-scoreboard text-[10px] text-slate-300 w-5 text-center num">{inn.home?.runs ?? (inn.home?.runs === 0 ? 0 : "-")}</div>
                </div>
              ))}
              {/* R/H/E */}
              <div className="flex flex-col items-center gap-px ml-1 border-l border-chalk pl-1">
                <div className="font-scoreboard text-[8px] text-slate-600 w-5 text-center">R</div>
                <div className="font-scoreboard text-[10px] text-chalk w-5 text-center font-bold num">{linescore.teams?.away?.runs ?? awayScore ?? 0}</div>
                <div className="font-scoreboard text-[10px] text-chalk w-5 text-center font-bold num">{linescore.teams?.home?.runs ?? homeScore ?? 0}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Click to expand hint */}
      <div className="mt-3 flex items-center justify-center gap-1 text-[9px] text-slate-600 font-scoreboard uppercase tracking-wide">
        <ChevronDown className="h-3 w-3" />
        Click for full play-by-play
      </div>
    </motion.button>

    {/* Expanded play-by-play modal */}
    <AnimatePresence>
      {expanded && (
        <ExpandedGameBreakdown
          gamePk={gamePk}
          awayAbbr={awayAbbr}
          homeAbbr={homeAbbr}
          awayName={awayName}
          homeName={homeName}
          awayTeamId={awayTeamId}
          homeTeamId={homeTeamId}
          awayScore={awayScore}
          homeScore={homeScore}
          status={status}
          onClose={() => setExpanded(false)}
        />
      )}
    </AnimatePresence>
    </>
  );
}

/** Compact base runner diamond with outs/balls/strikes display */
function BaseRunnerDiamond({ outs, balls, strikes }: { outs: number; balls: number; strikes: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Base runner diamond */}
      <svg viewBox="0 0 60 50" className="w-12 h-10">
        {/* Diamond outline */}
        <polygon
          points="30,5 55,25 30,45 5,25"
          fill="rgba(248, 249, 250, 0.03)"
          stroke="rgba(248, 249, 250, 0.08)"
          strokeWidth="1"
        />
        {/* 2nd base (top) */}
        <rect x="26" y="3" width="8" height="8" fill="rgba(248, 249, 250, 0.06)" transform="rotate(45 30 7)" />
        {/* 3rd base (left) */}
        <rect x="3" y="23" width="8" height="8" fill="rgba(248, 249, 250, 0.06)" transform="rotate(45 7 27)" />
        {/* 1st base (right) */}
        <rect x="49" y="23" width="8" height="8" fill="rgba(248, 249, 250, 0.06)" transform="rotate(45 53 27)" />
        {/* Home plate (bottom) */}
        <polygon points="26,43 34,43 34,47 30,49 26,47" fill="rgba(248, 249, 250, 0.06)" />
      </svg>

      {/* Count display */}
      <div className="flex items-center gap-2 font-scoreboard text-[9px] text-slate-500">
        <span className="flex items-center gap-0.5">
          {[0, 1, 2].map(i => (
            <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i < outs ? "bg-crimson" : "bg-slate-700")} />
          ))}
          <span className="ml-0.5">{outs} OUT</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5 font-scoreboard text-[10px]">
        <span className={cn("font-bold num", balls >= 1 ? "text-cobalt" : "text-slate-700")}>{balls}</span>
        <span className="text-slate-600">-</span>
        <span className={cn("font-bold num", strikes >= 1 ? "text-crimson" : "text-slate-700")}>{strikes}</span>
      </div>
    </div>
  );
}

/** Score display that animates counting up */
function AnimatedScoreDisplay({ value }: { value: number }) {
  const display = useAnimatedValue(value, 0, 0.6);
  return <>{display}</>;
}

/** Full-screen play-by-play breakdown modal */
function ExpandedGameBreakdown({
  gamePk, awayAbbr, homeAbbr, awayName, homeName,
  awayTeamId, homeTeamId, awayScore, homeScore, status, onClose,
}: {
  gamePk: number;
  awayAbbr: string; homeAbbr: string;
  awayName: string; homeName: string;
  awayTeamId: number; homeTeamId: number;
  awayScore: number; homeScore: number;
  status: any;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<{
    pitches: any[];
    linescore: any;
    status: any;
    teams: any;
  }>({
    queryKey: ["game-feed-rest", gamePk],
    queryFn: async () => {
      const res = await fetch(`/api/game/${gamePk}`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const awayColor = getTeamColor(awayTeamId);
  const homeColor = getTeamColor(homeTeamId);
  const state = status?.abstractGameState ?? data?.status?.abstractGameState ?? "Preview";
  const linescore = data?.linescore;
  const pitches = data?.pitches ?? [];
  const plays = buildPlaysFromPitches(pitches);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="glass-strong rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ background: `linear-gradient(180deg, ${awayColor.primary}10, ${homeColor.primary}10, #050a14)` }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between p-4 border-b border-chalk shrink-0">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-warning-track" />
            <h2 className="font-scoreboard text-lg font-bold text-chalk uppercase tracking-wide">Play-by-Play</h2>
            {state === "Live" && (
              <span className="flex items-center gap-1 rounded-md bg-mint/15 px-2 py-0.5">
                <span className="h-1.5 w-1.5 animate-live-dot rounded-full bg-mint" />
                <span className="font-scoreboard text-[10px] font-bold uppercase text-mint">LIVE</span>
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5 transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Score bar */}
        <div className="flex items-center justify-center gap-8 py-3 border-b border-chalk shrink-0"
          style={{ background: `linear-gradient(90deg, ${awayColor.primary}15, ${homeColor.primary}15)` }}
        >
          <div className="text-center">
            <div className="font-scoreboard text-sm font-bold uppercase" style={{ color: awayColor.primary === "#000000" || awayColor.primary === "#27251F" ? "#f8f9fa" : awayColor.primary }}>{awayAbbr}</div>
            <div className="font-scoreboard text-3xl font-black text-chalk num">{awayScore}</div>
          </div>
          <div className="font-scoreboard text-xs text-slate-600">{state === "Live" ? `${status?.inningState ?? ""} ${status?.inning ?? ""}` : state}</div>
          <div className="text-center">
            <div className="font-scoreboard text-sm font-bold uppercase" style={{ color: homeColor.primary === "#000000" || homeColor.primary === "#27251F" ? "#f8f9fa" : homeColor.primary }}>{homeAbbr}</div>
            <div className="font-scoreboard text-3xl font-black text-chalk num">{homeScore}</div>
          </div>
        </div>

        {/* Inning-by-inning linescore */}
        {linescore?.innings && linescore.innings.length > 0 && (
          <div className="px-4 py-2 border-b border-chalk shrink-0 overflow-x-auto scrollbar-thin">
            <div className="flex justify-center gap-px min-w-min">
              <div className="flex flex-col items-center gap-px mr-1">
                <div className="font-scoreboard text-[8px] text-slate-600 h-3.5 flex items-center">{awayAbbr}</div>
                <div className="font-scoreboard text-[8px] text-slate-600 h-3.5 flex items-center">{homeAbbr}</div>
              </div>
              {linescore.innings.map((inn: any) => (
                <div key={inn.num} className="flex flex-col items-center gap-px">
                  <div className="font-scoreboard text-[8px] text-slate-600 w-5 text-center">{inn.num}</div>
                  <div className="font-scoreboard text-[10px] text-slate-300 w-5 text-center num">{inn.away?.runs ?? 0}</div>
                  <div className="font-scoreboard text-[10px] text-slate-300 w-5 text-center num">{inn.home?.runs ?? "-"}</div>
                </div>
              ))}
              <div className="flex flex-col items-center gap-px ml-1 border-l border-chalk pl-1">
                <div className="font-scoreboard text-[8px] text-slate-600 w-5 text-center">R</div>
                <div className="font-scoreboard text-[10px] text-chalk w-5 text-center font-bold num">{linescore.teams?.away?.runs ?? 0}</div>
                <div className="font-scoreboard text-[10px] text-chalk w-5 text-center font-bold num">{linescore.teams?.home?.runs ?? 0}</div>
              </div>
              <div className="flex flex-col items-center gap-px ml-1">
                <div className="font-scoreboard text-[8px] text-slate-600 w-5 text-center">H</div>
                <div className="font-scoreboard text-[10px] text-slate-300 w-5 text-center num">{linescore.teams?.away?.hits ?? 0}</div>
                <div className="font-scoreboard text-[10px] text-slate-300 w-5 text-center num">{linescore.teams?.home?.hits ?? 0}</div>
              </div>
              <div className="flex flex-col items-center gap-px ml-1">
                <div className="font-scoreboard text-[8px] text-slate-600 w-5 text-center">E</div>
                <div className="font-scoreboard text-[10px] text-slate-300 w-5 text-center num">{linescore.teams?.away?.errors ?? 0}</div>
                <div className="font-scoreboard text-[10px] text-slate-300 w-5 text-center num">{linescore.teams?.home?.errors ?? 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* Play-by-play feed */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-warning-track" />
            </div>
          ) : plays.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-slate-500">
              {state === "Preview" ? "Game hasn't started yet" : "No play data available"}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="font-scoreboard text-[10px] uppercase tracking-wide text-slate-500 mb-2 px-1">
                {plays.length} plays · newest first
              </div>
              {plays.map((play, i) => (
                <motion.div
                  key={`${play.atBatIndex}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.5) }}
                  className={cn(
                    "rounded-lg border p-2.5",
                    play.isScoringPlay
                      ? "border-crimson/20 bg-crimson/5"
                      : play.halfInning === "top"
                      ? "border-chalk bg-midnight/30"
                      : "border-chalk bg-midnight/20"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {/* Inning badge */}
                    <div className={cn(
                      "font-scoreboard shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase",
                      play.halfInning === "top" ? "bg-awayColor/10" : "bg-homeColor/10"
                    )}
                    style={{
                      backgroundColor: play.halfInning === "top" ? `${awayColor.primary}20` : `${homeColor.primary}20`,
                      color: play.halfInning === "top"
                        ? (awayColor.primary === "#000000" || awayColor.primary === "#27251F" ? "#f8f9fa" : awayColor.primary)
                        : (homeColor.primary === "#000000" || homeColor.primary === "#27251F" ? "#f8f9fa" : homeColor.primary),
                    }}>
                      {play.halfInning === "top" ? "▲" : "▼"} {play.inning}
                    </div>

                    {/* Play details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-chalk truncate">{play.batterName}</span>
                        {play.isScoringPlay && (
                          <span className="rounded-full bg-crimson/15 px-1.5 py-0.5 text-[8px] font-bold uppercase text-crimson">SCORING</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 leading-snug">{play.description}</div>
                      {play.exitVelocity != null && (
                        <div className="mt-1 flex gap-3 text-[10px] font-scoreboard num">
                          {play.exitVelocity != null && <span className="text-crimson">{play.exitVelocity.toFixed(1)} mph EV</span>}
                          {play.launchAngle != null && <span className="text-amber">{play.launchAngle.toFixed(0)}° LA</span>}
                          {play.hitDistance != null && <span className="text-cobalt">{play.hitDistance.toFixed(0)} ft</span>}
                          {play.pitchType && <span className="text-slate-500">{play.pitchType}</span>}
                          {play.startSpeed != null && <span className="text-slate-500">{play.startSpeed.toFixed(1)} mph</span>}
                        </div>
                      )}
                    </div>

                    {/* Score after play */}
                    <div className="shrink-0 text-right">
                      <div className="font-scoreboard text-sm font-bold text-chalk num">{play.awayScore}-{play.homeScore}</div>
                      <div className="font-scoreboard text-[8px] text-slate-600">{play.outs} out</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Build a list of plays (at-bats) from enriched pitch data */
function buildPlaysFromPitches(pitches: any[]): any[] {
  if (!pitches || pitches.length === 0) return [];
  const playMap = new Map<number, any>();
  for (const p of pitches) {
    const idx = p.atBatIndex;
    if (!playMap.has(idx)) {
      playMap.set(idx, {
        atBatIndex: idx,
        inning: p.inning ?? 0,
        halfInning: p.halfInning ?? "top",
        batterName: p.batterName ?? "Unknown",
        description: p.description ?? p.resultDescription ?? "",
        awayScore: p.awayScore ?? 0,
        homeScore: p.homeScore ?? 0,
        outs: p.outs ?? 0,
        isScoringPlay: false,
        exitVelocity: null,
        launchAngle: null,
        hitDistance: null,
        pitchType: null,
        startSpeed: null,
      });
    }
    const play = playMap.get(idx);
    // Update with the latest pitch's data
    if (p.exitVelocity != null) play.exitVelocity = p.exitVelocity;
    if (p.launchAngle != null) play.launchAngle = p.launchAngle;
    if (p.hitDistance != null) play.hitDistance = p.hitDistance;
    if (p.pitchType) play.pitchType = p.pitchName ?? p.pitchType;
    if (p.startSpeed != null) play.startSpeed = p.startSpeed;
    if (p.description) play.description = p.description;
    if (p.awayScore != null) play.awayScore = p.awayScore;
    if (p.homeScore != null) play.homeScore = p.homeScore;
    if (p.outs != null) play.outs = p.outs;
    // Mark scoring plays
    if (p.isInPlay && p.exitVelocity != null && p.exitVelocity >= 90) {
      play.isScoringPlay = true;
    }
  }
  // Sort newest first
  return Array.from(playMap.values()).sort((a, b) => b.atBatIndex - a.atBatIndex);
}
