"use client";

import { useMemo, useState } from "react";
import { Target, ListOrdered } from "lucide-react";
import { StrikeZone } from "@/components/strike-zone";
import { PlayerCard } from "@/components/player-card";
import { CountDisplay } from "@/components/count-display";
import { PitchSequenceList } from "@/components/pitch-sequence-list";
import { safeToFixed } from "@/components/pitch-log-entry";
import { getTeamColor } from "@/lib/team-colors";
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
  const battingColor = battingTeamId != null ? getTeamColor(battingTeamId).primary : undefined;
  const pitchingColor = pitchingTeamId != null ? getTeamColor(pitchingTeamId).primary : undefined;

  const inPlayResult = lastPitch.isInPlay ? lastPitch : null;
  const exitVelo = safeToFixed(inPlayResult?.exitVelocity, 1);
  const launchAngle = safeToFixed(inPlayResult?.launchAngle, 0);
  const hitDistance = safeToFixed(inPlayResult?.hitDistance, 0);
  const hasBattedBallStats = exitVelo != null || launchAngle != null || hitDistance != null;

  const selectedPitchId = selectedPitch
    ? `${selectedPitch.atBatIndex}-${selectedPitch.pitchNumber}`
    : null;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Batted-ball stats bar */}
      {hasBattedBallStats && (
        <div className="grid shrink-0 grid-cols-3 gap-2 border-b border-chalk bg-warning-track/5 px-4 py-3">
          <StatBlock label="Exit Velo" value={exitVelo} unit="mph" large={isPage} />
          <StatBlock label="Distance" value={hitDistance} unit="ft" large={isPage} />
          <StatBlock label="Launch Angle" value={launchAngle} unit="deg" large={isPage} />
        </div>
      )}

      {/* Matchup + count */}
      <div className="flex shrink-0 flex-col items-center gap-3 border-b border-chalk px-4 py-3 sm:flex-row sm:justify-between sm:gap-3">
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

function StatBlock({ label, value, unit, large }: {
  label: string;
  value: string | null;
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
        {value} <span className="text-xs font-medium text-slate-400">{unit}</span>
      </div>
      <div className="label-xs text-slate-500">{label}</div>
    </div>
  );
}
