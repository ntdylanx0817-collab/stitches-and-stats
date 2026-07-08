"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown, Zap } from "lucide-react";
import type { EnrichedPitch } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getPitchColor } from "@/components/strike-zone";

interface PitchLogEntryProps {
  pitch: EnrichedPitch;
  index: number;
  isSelected?: boolean;
  onSelect?: () => void;
  isLatest?: boolean;
}

/** Safely convert any value to a fixed-decimal string. Handles strings, numbers, null, undefined. */
function safeToFixed(val: unknown, digits: number): string | null {
  if (val == null) return null;
  const n = typeof val === "number" ? val : Number(val);
  if (isNaN(n)) return null;
  return n.toFixed(digits);
}

/** Extract a string call code from either a string or a {code, description} object. */
function extractCallCode(call: unknown): string | null {
  if (call == null) return null;
  if (typeof call === "string") return call;
  if (typeof call === "object" && call !== null) {
    const c = call as { code?: string };
    if (typeof c.code === "string") return c.code;
  }
  return null;
}

function formatCall(p: EnrichedPitch): { label: string; color: string } {
  if (p.isInPlay) {
    const result = typeof p.playResult === "string" && p.playResult ? p.playResult : "In Play";
    if (p.isBarrel) return { label: result, color: "text-crimson" };
    return { label: result, color: "text-amber" };
  }
  const callCode = extractCallCode(p.call);
  if (callCode === "B" || p.isBall) return { label: "Ball", color: "text-slate-400" };
  if (callCode === "C") return { label: "Called Strike", color: "text-cobalt" };
  if (callCode === "S") return { label: "Swinging Strike", color: "text-crimson" };
  if (callCode === "F") return { label: "Foul", color: "text-amber" };
  if (callCode === "H") return { label: "HBP", color: "text-mint" };
  // Fallback: use callCode if it's a non-empty string, else description snippet
  const desc = typeof p.description === "string" ? p.description.slice(0, 12) : "";
  return { label: callCode || desc || "—", color: "text-slate-400" };
}

export function PitchLogEntry({ pitch, index, isSelected, onSelect, isLatest }: PitchLogEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const call = formatCall(pitch);
  const color = getPitchColor(pitch.pitchType);

  // Safely extract numeric values
  const startSpeed = safeToFixed(pitch.startSpeed, 1);
  const exitVelo = safeToFixed(pitch.exitVelocity, 1);
  const launchAngle = safeToFixed(pitch.launchAngle, 0);
  const hitDist = safeToFixed(pitch.hitDistance, 0);
  const xba = safeToFixed(pitch.xBA, 3);
  const spinRate = safeToFixed(pitch.spinRate, 0);
  const batSpeed = safeToFixed(pitch.batSpeed, 1);
  const breakX = safeToFixed(pitch.breakX, 1);
  const ivb = safeToFixed(pitch.inducedBreakZ, 1);
  const extension = safeToFixed(pitch.extension, 1);
  const plateTime = safeToFixed(pitch.plateTime, 3);
  const pX = safeToFixed(pitch.pX, 2);
  const pZ = safeToFixed(pitch.pZ, 2);

  const exitVeloNum = typeof pitch.exitVelocity === "number" ? pitch.exitVelocity : Number(pitch.exitVelocity);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cn(
        "rounded-xl border transition-colors",
        isSelected
          ? "border-cobalt/40 bg-cobalt/8"
          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]",
        isLatest && "ring-1 ring-mint/30"
      )}
    >
      <button
        onClick={() => { onSelect?.(); setExpanded(!expanded); }}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-[10px] font-mono font-bold text-slate-400">
          {index + 1}
        </div>

        <div
          className="h-8 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">
              {pitch.pitchName ?? pitch.pitchType ?? "Pitch"}
            </span>
            {pitch.isBarrel && (
              <span className="flex items-center gap-0.5 rounded-full bg-crimson/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-crimson">
                <Zap className="h-2.5 w-2.5" fill="currentColor" /> Barrel
              </span>
            )}
            {isLatest && (
              <span className="rounded-full bg-mint/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-mint animate-pulse-glow">
                Live
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {pitch.batterName ?? "—"} vs {pitch.pitcherName ?? "—"}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-right">
          <div className="text-right">
            <div className={cn("text-xs font-bold", call.color)}>{call.label}</div>
            <div className="text-[10px] text-slate-500 font-mono">
              {pitch.balls ?? 0}-{pitch.strikes ?? 0} · {pitch.outs ?? 0} out
            </div>
          </div>
          {startSpeed != null && (
            <div className="text-right min-w-[44px]">
              <div className="text-sm font-bold text-white num">
                {startSpeed}
              </div>
              <div className="text-[9px] text-slate-500 uppercase">MPH</div>
            </div>
          )}
        </div>

        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", expanded && "rotate-180")}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
              {exitVelo != null && (
                <Stat label="Exit Velo" value={exitVelo} unit="MPH" tone={!isNaN(exitVeloNum) && exitVeloNum >= 95 ? "crimson" : "default"} />
              )}
              {launchAngle != null && (
                <Stat label="Launch Angle" value={`${launchAngle}°`} tone="amber" />
              )}
              {hitDist != null && (
                <Stat label="Distance" value={hitDist} unit="ft" tone="default" />
              )}
              {xba != null && (
                <Stat label="xBA" value={xba.replace(/^0/, "")} tone="cobalt" />
              )}
              {spinRate != null && (
                <Stat label="Spin Rate" value={spinRate} unit="rpm" tone="default" />
              )}
              {batSpeed != null && (
                <Stat label="Bat Speed" value={batSpeed} unit="MPH" tone="default" />
              )}
              {breakX != null && (
                <Stat label="Break X" value={breakX} unit="in" tone="default" />
              )}
              {ivb != null && (
                <Stat label="IVB" value={ivb} unit="in" tone="default" />
              )}
              {extension != null && (
                <Stat label="Extension" value={extension} unit="ft" tone="default" />
              )}
              {plateTime != null && (
                <Stat label="Plate Time" value={plateTime} unit="s" tone="default" />
              )}
              {pX != null && pZ != null && (
                <Stat label="Plate Loc" value={`${pX}, ${pZ}`} unit="ft" tone="default" />
              )}
              {pitch.zone != null && (
                <Stat label="Zone" value={`${pitch.zone}`} tone="cobalt" />
              )}
            </div>
            {typeof pitch.description === "string" && pitch.description && (
              <div className="px-3 pb-3 text-xs text-slate-400 italic">
                {pitch.description}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Stat({ label, value, unit, tone = "default" }: { label: string; value: string; unit?: string; tone?: "default" | "cobalt" | "crimson" | "amber" | "mint" }) {
  const toneCls = {
    default: "text-white",
    cobalt: "text-cobalt",
    crimson: "text-crimson",
    amber: "text-amber",
    mint: "text-mint",
  }[tone];
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("text-sm font-bold num", toneCls)}>
        {value}
        {unit && <span className="ml-1 text-[9px] font-normal text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}
