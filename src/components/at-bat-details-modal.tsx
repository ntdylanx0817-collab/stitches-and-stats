"use client";

import { motion } from "framer-motion";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import { Maximize2, X } from "lucide-react";
import { Portal } from "@/components/ui/portal";
import { AtBatDisplay } from "@/components/at-bat-display";
import type { EnrichedPitch } from "@/lib/types";

interface AtBatDetailsModalProps {
  /** All pitches belonging to a single at-bat, any order. */
  pitches: EnrichedPitch[];
  awayTeamId?: number;
  homeTeamId?: number;
  onClose: () => void;
  /** When provided, shows a button that pins this at-bat in the Live At-Bat tab and switches to it. */
  onOpenInTab?: () => void;
}

/**
 * Gameday-style "At Bat Details" pop-up — the modal chrome around
 * {@link AtBatDisplay}. The Live At-Bat tab renders the same body full-width.
 */
export function AtBatDetailsModal({ pitches, awayTeamId, homeTeamId, onClose, onOpenInTab }: AtBatDetailsModalProps) {
  // Escape, the focus trap and focus restoration all live in the hook.
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  if (pitches.length === 0) return null;

  return (
    <Portal>
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
        ref={dialogRef}
        tabIndex={-1}
        className="glass-strong flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="at-bat-details-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-chalk p-4">
          <h2 id="at-bat-details-title" className="font-scoreboard text-lg font-bold uppercase tracking-wide text-chalk">
            At-Bat Details
          </h2>
          <div className="flex items-center gap-1">
            {onOpenInTab && (
              <button
                onClick={onOpenInTab}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/5"
                title="Open in Live At-Bat tab"
                aria-label="Open in Live At-Bat tab"
              >
                <Maximize2 className="h-4 w-4 text-slate-400" />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/5"
              aria-label="Close at-bat details"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
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
    </Portal>
  );
}
