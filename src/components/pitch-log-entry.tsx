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

function formatCall(p: EnrichedPitch): { label: string; color: string } {
  if (p.isInPlay) {
    if (p.isBarrel) return { label: p.playResult || "In Play", color: "text-crimson" };
    return { label: p.playResult || "In Play", color: "text-amber" };
  }
  if (p.call === "B" || p.isBall) return { label: "Ball", color: "text-slate-400" };
  if (p.call === "C") return { label: "Called Strike", color: "text-cobalt" };
  if (p.call === "S") return { label: "Swinging Strike", color: "text-crimson" };
  if (p.call === "F") return { label: "Foul", color: "text-amber" };
  if (p.call === "H") return { label: "HBP", color: "text-mint" };
  return { label: p.call || p.description?.slice(0, 12) || "—", color: "text-slate-400" };
}

export function PitchLogEntry({ pitch, index, isSelected, onSelect, isLatest }: PitchLogEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const call = formatCall(pitch);
  const color = getPitchColor(pitch.pitchType);
  const reversedIndex = index; // we'll pass reversed list

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
          {reversedIndex + 1}
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
            {pitch.batterName} vs {pitch.pitcherName}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-right">
          <div className="text-right">
            <div className={cn("text-xs font-bold", call.color)}>{call.label}</div>
            <div className="text-[10px] text-slate-500 font-mono">
              {pitch.balls}-{pitch.strikes} · {pitch.outs} out
            </div>
          </div>
          {pitch.startSpeed != null && (
            <div className="text-right min-w-[44px]">
              <div className="text-sm font-bold text-white num">
                {pitch.startSpeed.toFixed(1)}
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
              {pitch.exitVelocity != null && (
                <Stat label="Exit Velo" value={`${pitch.exitVelocity.toFixed(1)}`} unit="MPH" tone={pitch.exitVelocity >= 95 ? "crimson" : "default"} />
              )}
              {pitch.launchAngle != null && (
                <Stat label="Launch Angle" value={`${pitch.launchAngle.toFixed(0)}°`} tone="amber" />
              )}
              {pitch.hitDistance != null && (
                <Stat label="Distance" value={`${pitch.hitDistance.toFixed(0)}`} unit="ft" tone="default" />
              )}
              {pitch.xBA != null && (
                <Stat label="xBA" value={pitch.xBA.toFixed(3).replace(/^0/, "")} tone="cobalt" />
              )}
              {pitch.spinRate != null && (
                <Stat label="Spin Rate" value={pitch.spinRate.toFixed(0)} unit="rpm" tone="default" />
              )}
              {pitch.batSpeed != null && (
                <Stat label="Bat Speed" value={pitch.batSpeed.toFixed(1)} unit="MPH" tone="default" />
              )}
              {pitch.breakX != null && (
                <Stat label="Break X" value={pitch.breakX.toFixed(1)} unit="in" tone="default" />
              )}
              {pitch.inducedBreakZ != null && (
                <Stat label="IVB" value={pitch.inducedBreakZ.toFixed(1)} unit="in" tone="default" />
              )}
              {pitch.extension != null && (
                <Stat label="Extension" value={pitch.extension.toFixed(1)} unit="ft" tone="default" />
              )}
              {pitch.plateTime != null && (
                <Stat label="Plate Time" value={pitch.plateTime.toFixed(3)} unit="s" tone="default" />
              )}
              {pitch.pX != null && pitch.pZ != null && (
                <Stat label="Plate Loc" value={`${pitch.pX.toFixed(2)}, ${pitch.pZ.toFixed(2)}`} unit="ft" tone="default" />
              )}
              {pitch.zone != null && (
                <Stat label="Zone" value={`${pitch.zone}`} tone="cobalt" />
              )}
            </div>
            {pitch.description && (
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
