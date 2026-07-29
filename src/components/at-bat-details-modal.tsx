"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, Target, ListOrdered } from "lucide-react";
import { StrikeZone } from "@/components/strike-zone";
import { PlayerCard } from "@/components/player-card";
import { CountDisplay } from "@/components/count-display";
import { PitchSequenceList } from "@/components/pitch-sequence-list";
import { safeToFixed } from "@/components/pitch-log-entry";
import { getTeamColor } from "@/lib/team-colors";
import type { EnrichedPitch } from "@/lib/types";

interface AtBatDetailsModalProps {
  /** All pitches belonging to a single at-bat, any order. */
  pitches: EnrichedPitch[];
  awayTeamId?: number;
  homeTeamId?: number;
  onClose: () => void;
}

/**
 * Gameday-style "At Bat Details" modal: batter/pitcher matchup, live count,
 * strike zone plot with every pitch numbered, and the full pitch sequence.
 */
export function AtBatDetailsModal({ pitches, awayTeamId, homeTeamId, onClose }: AtBatDetailsModalProps) {
  const [selectedPitch, setSelectedPitch] = useState<EnrichedPitch | null>(null);

  const sortedPitches = useMemo(
    () => [...pitches].sort((a, b) => a.pitchNumber - b.pitchNumber),
    [pitches]
  );
  const firstPitch = sortedPitches[0];
  const lastPitch = sortedPitches[sortedPitches.length - 1];

  if (!firstPitch || !lastPitch) return null;

  const isTopInning = firstPitch.halfInning === "top";
  const battingTeamId = isTopInning ? awayTeamId : homeTeamId;
  const pitchingTeamId = isTopInning ? homeTeamId : awayTeamId;
  const battingColor = battingTeamId != null ? getTeamColor(battingTeamId).primary : undefined;
  const pitchingColor = pitchingTeamId != null ? getTeamColor(pitchingTeamId).primary : undefined;

  const inPlayResult = lastPitch.isInPlay ? lastPitch : null;
  const exitVelo = safeToFixed(inPlayResult?.exitVelocity, 1);
  const launchAngle = safeToFixed(inPlayResult?.launchAngle, 0);
  const hitDistance = safeToFixed(inPlayResult?.hitDistance, 0);
  const hasBattedBallStats = exitVelo != null || launchAngle != null || hitDistance != null;

  const selectedPitchId = selectedPitch ? `${selectedPitch.atBatIndex}-${selectedPitch.pitchNumber}` : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="glass-strong rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-chalk shrink-0">
          <h2 className="font-scoreboard text-lg font-bold text-chalk uppercase tracking-wide">At-Bat Details</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-white/5 transition-colors"
            aria-label="Close at-bat details"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Batted-ball stats bar */}
        {hasBattedBallStats && (
          <div className="grid grid-cols-3 gap-2 border-b border-chalk px-4 py-3 shrink-0 bg-warning-track/5">
            <StatBlock label="Exit Velo" value={exitVelo} unit="mph" />
            <StatBlock label="Distance" value={hitDistance} unit="ft" />
            <StatBlock label="Launch Angle" value={launchAngle} unit="deg" />
          </div>
        )}

        {/* Matchup + count */}
        <div className="flex items-center justify-between gap-3 border-b border-chalk px-4 py-4 shrink-0">
          <PlayerCard
            playerId={firstPitch.pitcherId}
            name={firstPitch.pitcherName}
            role="pitcher"
            handedness={firstPitch.pitchHand}
            accentColor={pitchingColor}
          />
          <CountDisplay balls={lastPitch.balls} strikes={lastPitch.strikes} outs={lastPitch.outs} />
          <PlayerCard
            playerId={firstPitch.batterId}
            name={firstPitch.batterName}
            role="batter"
            handedness={firstPitch.batterSide}
            accentColor={battingColor}
          />
        </div>

        {/* Strike zone + sequence */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 label-sm text-slate-400">
              <Target className="h-3.5 w-3.5 text-cobalt" />
              Pitch Locations
            </div>
            <StrikeZone
              pitches={sortedPitches}
              szTop={lastPitch.szTop}
              szBot={lastPitch.szBot}
              batterSide={firstPitch.batterSide}
              selectedPitchId={selectedPitchId}
              onSelectPitch={setSelectedPitch}
              numberAll
            />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 label-sm text-slate-400">
              <ListOrdered className="h-3.5 w-3.5 text-warning-track" />
              Pitch Sequence
            </div>
            <PitchSequenceList
              pitches={sortedPitches}
              selectedPitchId={selectedPitchId}
              onSelectPitch={setSelectedPitch}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatBlock({ label, value, unit }: { label: string; value: string | null; unit: string }) {
  if (value == null) return <div />;
  return (
    <div className="text-center">
      <div className="font-scoreboard text-xl font-black text-warning-track num">
        {value} <span className="text-xs font-medium text-slate-400">{unit}</span>
      </div>
      <div className="label-xs text-slate-500">{label}</div>
    </div>
  );
}
