"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Activity, Target, TrendingUp, Radio,
  Flame,
  type LucideIcon,
} from "lucide-react";
import { BaseballMark } from "@/components/ui/baseball-mark";
import { Skeleton } from "@/components/loading-states";
import { cn } from "@/lib/utils";
import type { EnrichedPitch, GameFeedResponse } from "@/lib/types";

interface PlayData {
  atBatIndex: number;
  inning: number;
  halfInning: string;
  batterName: string;
  pitcherName: string;
  event: string;
  description: string;
  homeScore: number;
  awayScore: number;
  outs: number;
  exitVelocity: number | null;
  launchAngle: number | null;
  hitDistance: number | null;
  isBarrel: boolean;
  isInPlay: boolean;
  isScoringPlay: boolean;
  pitchType: string | null;
  startSpeed: number | null;
}

interface CommentaryEntry {
  id: string;
  type: "home_run" | "strikeout" | "walk" | "hit" | "out" | "scoring" | "barrel" | "info";
  icon: LucideIcon;
  color: string;
  bgColor: string;
  text: string;
  inning: string;
  timestamp: string;
}

export function LiveGameThread({ gamePk }: { gamePk: number }) {
  const { data, isLoading } = useQuery<GameFeedResponse>({
    queryKey: ["game-thread", gamePk],
    queryFn: async () => {
      const res = await fetch(`/api/game/${gamePk}`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const commentary = generateCommentary(data?.pitches ?? []);

  if (isLoading && commentary.length === 0) {
    return (
      <div className="glass rounded-2xl p-4">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Radio className="h-4 w-4 text-mint" />
          Live Game Thread
        </h3>
        {/* Commentary rows: an icon bubble and two lines of text each. */}
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="h-6 w-6 shrink-0 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-2.5" style={{ width: `${78 - i * 9}%` }} />
                <Skeleton className="h-2" style={{ width: `${58 - i * 7}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (commentary.length === 0) {
    return (
      <div className="glass rounded-2xl p-4">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Radio className="h-4 w-4 text-mint" />
          Live Game Thread
        </h3>
        <div className="flex flex-col items-center gap-2 py-6">
          <BaseballMark size={32} className="text-slate-700" />
          <p className="text-xs text-slate-500">Waiting for game action…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="font-scoreboard flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Radio className="h-4 w-4 text-mint animate-live-dot" />
          Live Game Thread
        </h3>
        <span className="font-scoreboard text-[9px] uppercase tracking-wide text-slate-500">
          {commentary.length} plays
        </span>
      </div>

      <div className="max-h-[400px] space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
        <AnimatePresence initial={false}>
          {commentary.map((entry, i) => {
            const Icon = entry.icon;
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-2",
                  entry.bgColor
                )}
              >
                <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", entry.color)} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] leading-snug text-slate-200">{entry.text}</p>
                </div>
                <span className="font-scoreboard shrink-0 text-[8px] text-slate-600 uppercase">
                  {entry.inning}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function generateCommentary(pitches: EnrichedPitch[]): CommentaryEntry[] {
  if (!pitches || pitches.length === 0) return [];

  // Group pitches by at-bat
  const playMap = new Map<number, PlayData>();
  for (const p of pitches) {
    const idx = p.atBatIndex;
    if (!playMap.has(idx)) {
      playMap.set(idx, {
        atBatIndex: idx,
        inning: p.inning ?? 0,
        halfInning: p.halfInning ?? "top",
        batterName: p.batterName ?? "Unknown",
        pitcherName: p.pitcherName ?? "Unknown",
        event: p.playResult ?? "",
        description: p.description ?? "",
        homeScore: p.homeScore ?? 0,
        awayScore: p.awayScore ?? 0,
        outs: p.outs ?? 0,
        exitVelocity: p.exitVelocity ?? null,
        launchAngle: p.launchAngle ?? null,
        hitDistance: p.hitDistance ?? null,
        isBarrel: p.isBarrel ?? false,
        isInPlay: p.isInPlay ?? false,
        isScoringPlay: false,
        pitchType: p.pitchName ?? p.pitchType ?? null,
        startSpeed: p.startSpeed ?? null,
      });
    }
    // Update with latest pitch data
    const play = playMap.get(idx)!;
    if (p.exitVelocity != null) play.exitVelocity = p.exitVelocity;
    if (p.launchAngle != null) play.launchAngle = p.launchAngle;
    if (p.hitDistance != null) play.hitDistance = p.hitDistance;
    if (p.description) play.description = p.description;
    if (p.homeScore != null) play.homeScore = p.homeScore;
    if (p.awayScore != null) play.awayScore = p.awayScore;
    if (p.pitchName) play.pitchType = p.pitchName;
    if (p.startSpeed != null) play.startSpeed = p.startSpeed;
  }

  // Determine scoring plays (score changed from previous play)
  const plays = Array.from(playMap.values()).sort((a, b) => b.atBatIndex - a.atBatIndex);
  let prevHome = plays[0]?.homeScore ?? 0;
  let prevAway = plays[0]?.awayScore ?? 0;
  for (let i = 1; i < plays.length; i++) {
    const p = plays[i];
    if (p.homeScore !== prevHome || p.awayScore !== prevAway) {
      plays[i - 1].isScoringPlay = true;
    }
    prevHome = p.homeScore;
    prevAway = p.awayScore;
  }

  const entries: CommentaryEntry[] = [];

  for (const play of plays) {
    const inningLabel = `${play.halfInning === "top" ? "▲" : "▼"}${play.inning}`;
    const event = play.event.toLowerCase();
    let type: CommentaryEntry["type"] = "info";
    let icon = Activity;
    let color = "text-slate-400";
    let bgColor = "border-chalk bg-midnight/20";
    let text = "";

    // Home run
    if (event.includes("home_run")) {
      type = "home_run";
      icon = Flame;
      color = "text-crimson";
      bgColor = "border-crimson/20 bg-crimson/5";
      const ev = play.exitVelocity ? ` at ${play.exitVelocity.toFixed(0)} mph` : "";
      const dist = play.hitDistance ? `, ${play.hitDistance.toFixed(0)} ft` : "";
      const la = play.launchAngle != null ? `, ${play.launchAngle.toFixed(0)}° launch` : "";
      text = `🔥 HOME RUN! ${play.batterName} launches one${ev}${dist}${la}. ${play.awayScore}-${play.homeScore}.`;
    }
    // Strikeout
    else if (event.includes("strikeout") || event.includes("strike_out")) {
      type = "strikeout";
      icon = Zap;
      color = "text-cobalt";
      bgColor = "border-cobalt/15 bg-cobalt/5";
      const pitch = play.pitchType ? ` on a ${play.pitchType}` : "";
      const speed = play.startSpeed ? ` (${play.startSpeed.toFixed(0)} mph)` : "";
      text = `⚡ Strikeout! ${play.batterName} fans${pitch}${speed}. ${play.pitcherName} gets the K.`;
    }
    // Walk
    else if (event.includes("walk") || event.includes("intent_walk")) {
      type = "walk";
      icon = TrendingUp;
      color = "text-mint";
      bgColor = "border-mint/15 bg-mint/5";
      text = `🎯 Walk. ${play.batterName} earns a free pass from ${play.pitcherName}.`;
    }
    // Hit (single, double, triple)
    else if (event.includes("single") || event.includes("double") || event.includes("triple")) {
      type = "hit";
      icon = Target;
      const ev = play.exitVelocity ? ` at ${play.exitVelocity.toFixed(0)} mph` : "";
      const label = event.includes("triple") ? "Triple" : event.includes("double") ? "Double" : "Single";
      color = event.includes("triple") ? "text-violet" : event.includes("double") ? "text-cobalt" : "text-mint";
      bgColor = `border-${event.includes("triple") ? "violet" : event.includes("double") ? "cobalt" : "mint"}/15 bg-${event.includes("triple") ? "violet" : event.includes("double") ? "cobalt" : "mint"}/5`;
      text = `${label}! ${play.batterName}${ev}. ${play.awayScore}-${play.homeScore}.`;
    }
    // Barrel (hard contact but out)
    else if (play.isBarrel && play.exitVelocity && play.exitVelocity >= 95) {
      type = "barrel";
      icon = Flame;
      color = "text-amber";
      bgColor = "border-amber/15 bg-amber/5";
      text = `🔥 Hard contact! ${play.batterName} hits it at ${play.exitVelocity.toFixed(0)} mph but ${play.event === "field_out" ? "flies out" : "is retired"}. Barrel!`;
    }
    // Scoring play (RBI groundout, sac fly, etc.)
    else if (play.isScoringPlay) {
      type = "scoring";
      icon = TrendingUp;
      color = "text-warning-track";
      bgColor = "border-warning-track/15 bg-warning-track/5";
      text = `⚡ Run scores! ${play.description}. ${play.awayScore}-${play.homeScore}.`;
    }
    // Other outs
    else if (event.includes("out") || event.includes("field") || event.includes("force") || event.includes("double_play") || event.includes("grounded")) {
      type = "out";
      icon = Activity;
      color = "text-slate-500";
      bgColor = "border-chalk bg-midnight/20";
      const ev = play.exitVelocity && play.exitVelocity >= 90 ? ` (${play.exitVelocity.toFixed(0)} mph EV)` : "";
      text = `${play.batterName} ${play.event.replace(/_/g, " ")}${ev}.`;
    }
    // HBP
    else if (event.includes("hit_by_pitch") || event.includes("hbp")) {
      type = "info";
      icon = Activity;
      color = "text-amber";
      text = `${play.batterName} hit by pitch.`;
    }
    // Default
    else if (play.event) {
      type = "info";
      icon = Activity;
      color = "text-slate-500";
      text = `${play.batterName}: ${play.event.replace(/_/g, " ")}.`;
    }

    if (text) {
      entries.push({
        id: `${play.atBatIndex}`,
        type, icon, color, bgColor, text,
        inning: inningLabel,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return entries;
}
