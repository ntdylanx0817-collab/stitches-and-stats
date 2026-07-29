"use client";

import { useEffect, useMemo } from "react";
import { AtBatDisplay } from "@/components/at-bat-display";
import { GameSelectorStrip } from "@/components/game-selector-strip";
import { EmptyState } from "@/components/loading-states";
import { groupPitchesByAtBat } from "@/lib/at-bat";
import { useGamePitches } from "@/hooks/use-game-pitches";
import { useSavantStore } from "@/lib/store";
import { Calendar } from "lucide-react";

/**
 * Live At-Bat tab: Pick a game from the strip, then watch the current at-bat
 * update in real-time as new pitches arrive. Auto-advance to the next at-bat
 * when the current one completes (if enabled).
 */
export function LiveAtBatView() {
  const selectedGamePk = useSavantStore((s) => s.selectedGamePk);
  const selectedAtBatIndex = useSavantStore((s) => s.selectedAtBatIndex);
  const atBatAutoAdvanceEnabled = useSavantStore((s) => s.atBatAutoAdvanceEnabled);
  const setSelectedAtBatIndex = useSavantStore((s) => s.setSelectedAtBatIndex);
  const setAtBatAutoAdvanceEnabled = useSavantStore((s) => s.setAtBatAutoAdvanceEnabled);

  const gamePitches = useGamePitches(selectedGamePk ?? 0);

  const atBatGroups = useMemo(
    () => (selectedGamePk ? groupPitchesByAtBat(gamePitches.pitches) : []),
    [gamePitches.pitches, selectedGamePk]
  );

  useEffect(() => {
    if (atBatGroups.length > 0 && selectedAtBatIndex == null) {
      const incomplete = atBatGroups.findLast((g) => !g.isComplete);
      const latest = incomplete ?? atBatGroups[atBatGroups.length - 1];
      setSelectedAtBatIndex(latest.atBatIndex);
    }
  }, [atBatGroups, selectedAtBatIndex, setSelectedAtBatIndex]);

  useEffect(() => {
    if (!atBatAutoAdvanceEnabled || selectedAtBatIndex == null || !selectedGamePk) return;

    const current = atBatGroups.find((g) => g.atBatIndex === selectedAtBatIndex);
    if (!current || !current.isComplete) return;

    const timeout = setTimeout(() => {
      const currentIdx = atBatGroups.findIndex((g) => g.atBatIndex === selectedAtBatIndex);
      if (currentIdx < atBatGroups.length - 1) {
        setSelectedAtBatIndex(atBatGroups[currentIdx + 1].atBatIndex);
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [selectedAtBatIndex, atBatGroups, atBatAutoAdvanceEnabled, setSelectedAtBatIndex, selectedGamePk]);

  if (!selectedGamePk) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <GameSelectorStrip />
        <EmptyState
          icon={Calendar}
          title="Select a game to begin"
          description="Choose a game from the strip above to start watching live at-bats."
        />
      </div>
    );
  }

  const selectedAtBat = selectedAtBatIndex != null
    ? atBatGroups.find((g) => g.atBatIndex === selectedAtBatIndex)
    : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <GameSelectorStrip />

      {gamePitches.isLoadingInitial ? (
        <div className="text-center text-slate-400 py-12">Loading at-bats…</div>
      ) : atBatGroups.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No at-bats yet"
          description="Check back when the game starts."
        />
      ) : selectedAtBat ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">
              At-Bat {selectedAtBat.atBatIndex + 1} of {atBatGroups.length}
            </div>
            <button
              onClick={() => setAtBatAutoAdvanceEnabled(!atBatAutoAdvanceEnabled)}
              className="text-xs px-3 py-1 rounded-lg border border-chalk/30 hover:border-chalk/60 transition-colors text-slate-400 hover:text-chalk"
            >
              {atBatAutoAdvanceEnabled ? "Auto-Advance: On" : "Auto-Advance: Off"}
            </button>
          </div>
          <AtBatDisplay
            pitches={selectedAtBat.pitches}
            awayTeamId={gamePitches.teams?.away?.id}
            homeTeamId={gamePitches.teams?.home?.id}
            variant="page"
            className="h-full"
          />
        </div>
      ) : null}
    </div>
  );
}
