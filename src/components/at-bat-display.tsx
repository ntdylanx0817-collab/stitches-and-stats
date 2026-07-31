"use client";

import { useMemo, useState } from "react";
import { Target, ListOrdered } from "lucide-react";
import { StrikeZone } from "@/components/strike-zone";
import { PlayerCard } from "@/components/player-card";
import { CountDisplay } from "@/components/count-display";
import { PitchSequenceList } from "@/components/pitch-sequence-list";
import { AnimatedCounter } from "@/components/animated-counter";
import { getDisplayTeamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";
import type { EnrichedPitch } from "@/lib/types";

interface AtBatDisplayProps {
  /** All pitches belonging to a single at-bat, any order. */
  pitches: EnrichedPitch[];
  awayTeamId?: number;
  homeTeamId?: number;
  /**
   * "modal" keeps the compact proportions of the pop-up; "page" spreads out
   * for a full tab, where there's room for a bigger zone and taller sequence.
   */
  variant?: "modal" | "page";
  className?: string;
}

/**
 * The body of an at-bat: batter/pitcher matchup, live count, every pitch
 * plotted on the strike zone, and the pitch-by-pitch sequence.
 *
 * Shared by the At-Bat Details modal and the Live At-Bat tab so the two can
 * never drift apart. Selection is two-way — clicking a dot highlights the
 * sequence row and vice versa.
 */
export function AtBatDisplay({
  pitches, awayTeamId, homeTeamId, variant = "modal", className,
}: AtBatDisplayProps) {
  const [selectedPitch, setSelectedPitch] = useState<EnrichedPitch | null>(null);

  const sortedPitches = useMemo(
    () => [...pitches].sort((a, b) => a.pitchNumber - b.pitchNumber),
    [pitches]
  );
  const firstPitch = sortedPitches[0];
  const lastPitch = sortedPitches[sortedPitches.length - 1];

  if (!firstPitch || !lastPitch) return null;

  const isPage = variant === "page";
  const isTopInning = firstPitch.halfInning === "top";
  const battingTeamId = isTopInning ? awayTeamId : homeTeamId;
  const pitchingTeamId = isTopInning ? homeTeamId : awayTeamId;
  // Display variants: these tint a ring and glow around the headshot, so a
  // near-black brand colour would render no visible ring at all.
  const battingColor = battingTeamId != null ? getDisplayTeamColor(battingTeamId) : undefined;
  const pitchingColor = pitchingTeamId != null ? getDisplayTeamColor(pitchingTeamId) : undefined;

  const inPlayResult = lastPitch.isInPlay ? lastPitch : null;
  // Raw numbers rather than formatted strings: StatBlock animates the
  // count-up and does its own rounding.
  const exitVelo = toNumber(inPlayResult?.exitVelocity);
  const launchAngle = toNumber(inPlayResult?.launchAngle);
  const hitDistance = toNumber(inPlayResult?.hitDistance);
  const hasBattedBallStats = exitVelo != null || launchAngle != null || hitDistance != null;

  const selectedPitchId = selectedPitch
    ? `${selectedPitch.atBatIndex}-${selectedPitch.pitchNumber}`
    : null;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Batted-ball stats bar */}
      {hasBattedBallStats && (
        <div className="grid shrink-0 grid-cols-3 gap-2 border-b border-chalk bg-warning-track/5 px-4 py-3">
          <StatBlock label="Exit Velo" value={exitVelo} decimals={1} unit="mph" large={isPage} />
          <StatBlock label="Distance" value={hitDistance} unit="ft" large={isPage} />
          <StatBlock label="Launch Angle" value={launchAngle} unit="deg" large={isPage} />
        </div>
      )}

      {/* Matchup + count — always a row, even on phones. Stacking these three
          blocks vertically on narrow viewports was the single biggest thing
          pushing the strike zone below the fold on mobile (~200px). */}
      <div className="flex shrink-0 flex-row items-center justify-between gap-1.5 border-b border-chalk px-3 py-3 sm:gap-3 sm:px-4">
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
      <div className={cn(
        "grid flex-1 grid-cols-1 gap-4 p-4",
        isPage ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "overflow-y-auto scrollbar-thin lg:grid-cols-2"
      )}>
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
            // The whole point of the tab is room to look at things, so let the
            // plot grow well past the default cap when it has a column to itself.
            className={isPage ? "max-w-[520px]" : undefined}
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
    </div>
  );
}

/** Coerce a feed value to a finite number, or null. Mirrors safeToFixed's
  * guards but keeps the number so it can be animated. */
function toNumber(val: unknown): number | null {
  if (val == null) return null;
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? n : null;
}

function StatBlock({ label, value, decimals = 0, unit, large }: {
  label: string;
  /** Raw number so the readout can count up; null renders an empty cell. */
  value: number | null;
  decimals?: number;
  unit: string;
  large?: boolean;
}) {
  if (value == null) return <div />;
  return (
    <div className="text-center">
      <div className={cn(
        "font-scoreboard font-black text-warning-track num",
        large ? "text-xl sm:text-3xl" : "text-lg sm:text-xl"
      )}>
        {/* Counts up on mount, the way a broadcast reveals a batted ball.
            These only render once a ball is actually in play, so the reveal
            marks a real moment rather than firing on every render. */}
        <AnimatedCounter value={value} decimals={decimals} />
        {" "}
        <span className="text-xs font-medium text-slate-400">{unit}</span>
      </div>
      <div className="label-xs text-slate-500">{label}</div>
    </div>
  );
}
