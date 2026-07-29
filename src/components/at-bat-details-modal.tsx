"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { AtBatDisplay } from "@/components/at-bat-display";
import type { EnrichedPitch } from "@/lib/types";

interface AtBatDetailsModalProps {
  /** All pitches belonging to a single at-bat, any order. */
  pitches: EnrichedPitch[];
  awayTeamId?: number;
  homeTeamId?: number;
  onClose: () => void;
}

/**
 * Gameday-style "At Bat Details" pop-up — the modal chrome around
 * {@link AtBatDisplay}. The Live At-Bat tab renders the same body full-width.
 */
export function AtBatDetailsModal({ pitches, awayTeamId, homeTeamId, onClose }: AtBatDetailsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (pitches.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="glass-strong flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="at-bat-details-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-chalk p-4">
          <h2 id="at-bat-details-title" className="font-scoreboard text-lg font-bold uppercase tracking-wide text-chalk">
            At-Bat Details
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/5"
            aria-label="Close at-bat details"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <AtBatDisplay
          pitches={pitches}
          awayTeamId={awayTeamId}
          homeTeamId={homeTeamId}
          variant="modal"
          className="min-h-0 flex-1 overflow-y-auto scrollbar-thin"
        />
      </motion.div>
    </motion.div>
  );
}
