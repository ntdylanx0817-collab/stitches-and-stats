"use client";

import { motion } from "framer-motion";
import type { EnrichedPitch } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCall, safeToFixed } from "@/components/pitch-log-entry";

interface PitchSequenceListProps {
  /** Pitches for a single at-bat, in throw order (pitch 1 first). */
  pitches: EnrichedPitch[];
  selectedPitchId?: string | null;
  onSelectPitch?: (pitch: EnrichedPitch) => void;
  className?: string;
}

/** Numbered pitch-by-pitch log for a single at-bat, e.g. "① 98.4 mph Sinker · Ball · 1-0". */
export function PitchSequenceList({ pitches, selectedPitchId, onSelectPitch, className }: PitchSequenceListProps) {
  if (pitches.length === 0) {
    return <div className="py-6 text-center text-xs text-slate-500">No pitches recorded for this at-bat yet.</div>;
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {pitches.map((p, idx) => {
        const call = formatCall(p);
        const speed = safeToFixed(p.startSpeed, 1);
        const pitchLabel = p.pitchName ?? p.pitchType ?? "Pitch";
        const circleColor = p.isInPlay ? "cobalt" : p.isBall ? "mint" : "crimson";
        const isSelected = selectedPitchId === `${p.atBatIndex}-${p.pitchNumber}`;

        return (
          <motion.button
            key={`${p.atBatIndex}-${p.pitchNumber}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.4) }}
            onClick={() => onSelectPitch?.(p)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors",
              isSelected ? "border-cobalt/40 bg-cobalt/8" : "border-chalk/5 bg-chalk/[0.02] hover:bg-chalk/[0.04]"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-scoreboard text-[11px] font-bold num",
                circleColor === "cobalt" && "bg-cobalt/20 text-cobalt border border-cobalt/40",
                circleColor === "mint" && "bg-mint/20 text-mint border border-mint/40",
                circleColor === "crimson" && "bg-crimson/20 text-crimson border border-crimson/40"
              )}
            >
              {idx + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-chalk truncate">
                {speed != null ? `${speed} mph ` : ""}
                {pitchLabel}
              </div>
              <div className={cn("text-[10px] font-medium", call.color)}>{call.label}</div>
            </div>

            <div className="shrink-0 font-scoreboard text-xs font-bold text-slate-400 num">
              {p.balls}-{p.strikes}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
