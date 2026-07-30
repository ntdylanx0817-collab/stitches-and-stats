"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, X, Activity } from "lucide-react";
import { Portal } from "@/components/ui/portal";
import { getTeamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";
import type { EnrichedPitch, GameFeedResponse, GameStatus, Linescore } from "@/lib/types";

/** One inning row in the linescore. */
type InningLine = Linescore["innings"][number];

/** An at-bat reconstructed from the flat pitch list. */
interface BuiltPlay {
  atBatIndex: number;
  inning: number;
  halfInning: "top" | "bottom";
  batterName: string;
  description: string;
  awayScore: number;
  homeScore: number;
  outs: number;
  isScoringPlay: boolean;
  exitVelocity: number | null;
  launchAngle: number | null;
  hitDistance: number | null;
  pitchType: string | null;
  startSpeed: number | null;
}

interface PlayByPlayModalProps {
  gamePk: number;
  awayAbbr: string;
  homeAbbr: string;
  awayName: string;
  homeName: string;
  awayTeamId: number;
  homeTeamId: number;
  awayScore: number;
  homeScore: number;
  status: GameStatus | null | undefined;
  onClose: () => void;
}

/**
 * Full-screen play-by-play modal. Shared between HeroScoreboard and
 * StickyMiniScoreboard so users can open it from either place.
 *
 * Uses the same React Query cache key as the parent GameFeed so it reads
 * already-fetched data instead of duplicating the request.
 */
export function PlayByPlayModal({
  gamePk,
  awayAbbr,
  homeAbbr,
  awayName,
  homeName,
  awayTeamId,
  homeTeamId,
  awayScore,
  homeScore,
  status,
  onClose,
}: PlayByPlayModalProps) {
  const { data, isLoading } = useQuery<GameFeedResponse>({
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

  // For Preview games, show a friendly "hasn't started" message
  // but still render the modal so the user sees the structure.
  return (
    <Portal>
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
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-white/5 transition-colors"
            aria-label="Close play-by-play"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Score bar */}
        <div
          className="flex items-center justify-center gap-8 py-3 border-b border-chalk shrink-0"
          style={{ background: `linear-gradient(90deg, ${awayColor.primary}15, ${homeColor.primary}15)` }}
        >
          <div className="text-center">
            <div
              className="font-scoreboard text-sm font-bold uppercase"
              style={{ color: awayColor.primary === "#000000" || awayColor.primary === "#27251F" ? "#f8f9fa" : awayColor.primary }}
              title={awayName}
            >
              {awayAbbr}
            </div>
            <div className="font-scoreboard text-3xl font-black text-chalk num">{awayScore}</div>
          </div>
          <div className="font-scoreboard text-xs text-slate-600">
            {state === "Live"
              ? `${status?.inningState ?? data?.status?.inningState ?? ""} ${status?.inning ?? data?.status?.inning ?? ""}`
              : state}
          </div>
          <div className="text-center">
            <div
              className="font-scoreboard text-sm font-bold uppercase"
              style={{ color: homeColor.primary === "#000000" || homeColor.primary === "#27251F" ? "#f8f9fa" : homeColor.primary }}
              title={homeName}
            >
              {homeAbbr}
            </div>
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
              {linescore.innings.map((inn: InningLine) => (
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
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <Activity className="h-6 w-6 text-slate-600" />
              <span>{state === "Preview" ? "Game hasn't started yet" : "No play data available yet"}</span>
              {state === "Live" && (
                <span className="text-[10px] font-scoreboard uppercase tracking-wide text-warning-track">
                  Updates every 10s
                </span>
              )}
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
                    <div
                      className="font-scoreboard shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase"
                      style={{
                        backgroundColor: play.halfInning === "top" ? `${awayColor.primary}20` : `${homeColor.primary}20`,
                        color:
                          play.halfInning === "top"
                            ? awayColor.primary === "#000000" || awayColor.primary === "#27251F"
                              ? "#f8f9fa"
                              : awayColor.primary
                            : homeColor.primary === "#000000" || homeColor.primary === "#27251F"
                              ? "#f8f9fa"
                              : homeColor.primary,
                      }}
                    >
                      {play.halfInning === "top" ? "▲" : "▼"} {play.inning}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-chalk truncate">{play.batterName}</span>
                        {play.isScoringPlay && (
                          <span className="rounded-full bg-crimson/15 px-1.5 py-0.5 text-[8px] font-bold uppercase text-crimson">
                            SCORING
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 leading-snug">{play.description}</div>
                      {play.exitVelocity != null && (
                        <div className="mt-1 flex gap-3 text-[10px] font-scoreboard num">
                          <span className="text-crimson">{play.exitVelocity.toFixed(1)} mph EV</span>
                          {play.launchAngle != null && <span className="text-amber">{play.launchAngle.toFixed(0)}° LA</span>}
                          {play.hitDistance != null && <span className="text-cobalt">{play.hitDistance.toFixed(0)} ft</span>}
                          {play.pitchType && <span className="text-slate-500">{play.pitchType}</span>}
                          {play.startSpeed != null && <span className="text-slate-500">{play.startSpeed.toFixed(1)} mph</span>}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-scoreboard text-sm font-bold text-chalk num">
                        {play.awayScore}-{play.homeScore}
                      </div>
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
    </Portal>
  );
}

/** Build a list of plays (at-bats) from enriched pitch data */
function buildPlaysFromPitches(pitches: EnrichedPitch[]): BuiltPlay[] {
  if (!pitches || pitches.length === 0) return [];
  const playMap = new Map<number, BuiltPlay>();
  for (const p of pitches) {
    const idx = p.atBatIndex;
    let play = playMap.get(idx);
    if (!play) {
      play = {
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
      };
      playMap.set(idx, play);
    }
    if (p.exitVelocity != null) play.exitVelocity = p.exitVelocity;
    if (p.launchAngle != null) play.launchAngle = p.launchAngle;
    if (p.hitDistance != null) play.hitDistance = p.hitDistance;
    if (p.pitchType) play.pitchType = p.pitchName ?? p.pitchType;
    if (p.startSpeed != null) play.startSpeed = p.startSpeed;
    if (p.description) play.description = p.description;
    if (p.awayScore != null) play.awayScore = p.awayScore;
    if (p.homeScore != null) play.homeScore = p.homeScore;
    if (p.outs != null) play.outs = p.outs;
    if (p.isInPlay && p.exitVelocity != null && p.exitVelocity >= 90) {
      play.isScoringPlay = true;
    }
  }
  return Array.from(playMap.values()).sort((a, b) => b.atBatIndex - a.atBatIndex);
}
