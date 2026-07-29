"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Clock, Radio, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AtBatDisplay } from "@/components/at-bat-display";
import { GameSelectorStrip } from "@/components/game-selector-strip";
import { EmptyState } from "@/components/loading-states";
import { useGamePitches, updatedAgoLabel } from "@/hooks/use-game-pitches";
import { groupPitchesByAtBat, halfInningLabel, latestAtBatIndex, pinTargetForStep } from "@/lib/at-bat";
import { useSavantStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { FeedTeam, Linescore } from "@/lib/types";
import type { AtBatGroup } from "@/lib/at-bat";

/**
 * The Live At-Bat tab: pick a game, and the current plate appearance is right
 * there — no clicking into a pitch to open it. It stays on the live at-bat by
 * itself as pitches arrive, so the tab can just be left open and watched.
 */
export function LiveAtBatView() {
  const selectedGamePk = useSavantStore((s) => s.selectedGamePk);

  return (
    <div className="mx-auto max-w-[1600px] p-3 sm:p-4">
      <GameSelectorStrip />
      {selectedGamePk ? (
        // Keyed so a game switch remounts: useGamePitches accumulates pitches
        // in state and relies on the caller to discard them per game.
        <AtBatWatcher key={selectedGamePk} gamePk={selectedGamePk} />
      ) : (
        <EmptyState
          icon={Target}
          title="Pick a game to watch"
          description="Choose a game above and the at-bat in progress shows up here, updating pitch by pitch."
        />
      )}
    </div>
  );
}

function AtBatWatcher({ gamePk }: { gamePk: number }) {
  const selectedAtBatIndex = useSavantStore((s) => s.selectedAtBatIndex);
  const setSelectedAtBatIndex = useSavantStore((s) => s.setSelectedAtBatIndex);

  const { pitches, linescore, status, teams, isLoadingInitial, connected, lastUpdated } =
    useGamePitches(gamePk);

  // Ticks the "updated Xs ago" label without refetching anything.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const groups = useMemo(() => groupPitchesByAtBat(pitches), [pitches]);

  // Arrow keys step through at-bats. Registered before the early returns so the
  // hook order stays fixed; `groups`/`position` are read fresh inside.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      // Don't steal arrow keys from the player search or any other field.
      const el = e.target as HTMLElement | null;
      if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? "")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const from = groups.findIndex((g) => g.atBatIndex === (selectedAtBatIndex ?? latestAtBatIndex(pitches)));
      if (from < 0) return;
      const target = pinTargetForStep(groups, from, e.key === "ArrowLeft" ? -1 : 1, latestAtBatIndex(pitches));
      if (target === undefined) return;
      e.preventDefault();
      setSelectedAtBatIndex(target);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [groups, pitches, selectedAtBatIndex, setSelectedAtBatIndex]);

  // A null selection means "follow the live at-bat", so the view advances on
  // its own as new plate appearances start — no timers, no auto-advance state.
  // The gap between at-bats leaves the finished one on screen with its result.
  const liveIndex = latestAtBatIndex(pitches);
  const isFollowingLive = selectedAtBatIndex == null;
  const shownIndex = selectedAtBatIndex ?? liveIndex;

  const position = groups.findIndex((g) => g.atBatIndex === shownIndex);
  const atBat = position >= 0 ? groups[position] : null;

  if (isLoadingInitial) {
    return <div className="glass flex h-96 items-center justify-center rounded-2xl text-slate-400">Loading at-bats…</div>;
  }

  if (groups.length === 0) {
    return status?.abstractGameState === "Preview" ? (
      <EmptyState
        icon={Clock}
        title="Game hasn't started"
        description={status?.detailedState ? `Status: ${status.detailedState}` : "The first pitch will show up here automatically."}
      />
    ) : (
      <EmptyState
        icon={Target}
        title="No pitches yet"
        description="Nothing has been thrown in this game yet. This updates on its own."
      />
    );
  }

  // Safety net: a pinned index with no matching at-bat would otherwise render
  // an empty page with no way out. Shouldn't happen now that the feed keeps the
  // whole game, but "nothing at all" is the worst possible failure here.
  if (!atBat) {
    return (
      <EmptyState
        icon={Target}
        title="That at-bat isn't in this game's feed"
        description="It may have been from a different game."
        action={
          <button
            onClick={() => setSelectedAtBatIndex(null)}
            className="font-scoreboard rounded-lg border border-warning-track/40 bg-warning-track/10 px-3 py-1.5 text-[10px] uppercase tracking-wide text-warning-track transition-colors hover:bg-warning-track/20"
          >
            Back to the live at-bat
          </button>
        }
      />
    );
  }

  const step = (direction: -1 | 1) => {
    const target = pinTargetForStep(groups, position, direction, liveIndex);
    if (target !== undefined) setSelectedAtBatIndex(target);
  };

  // Jumping onto the half-inning that holds the live at-bat resumes following
  // it, same as stepping onto it — landing on a pinned copy of the live
  // at-bat would freeze the view right as the next pitch arrives.
  const jumpToAtBat = (atBatIndex: number) => {
    setSelectedAtBatIndex(atBatIndex === liveIndex ? null : atBatIndex);
  };

  const freshness = updatedAgoLabel(lastUpdated, now);

  return (
    <div className="space-y-3">
      <div className="glass flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="font-scoreboard shrink-0 text-sm font-bold uppercase tracking-wide text-chalk">
            {halfInningLabel(atBat.halfInning, atBat.inning)}
          </span>
          <ScoreLine teams={teams} linescore={linescore} />
          {atBat.result ? (
            <Badge variant="outline" className="border-warning-track/40 bg-warning-track/10 text-warning-track font-scoreboard shrink-0 text-[10px]">
              {atBat.result}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-mint/30 bg-mint/10 text-mint font-scoreboard shrink-0 text-[10px]">
              <span className="mr-1 h-1.5 w-1.5 animate-live-dot rounded-full bg-mint" />
              At bat
            </Badge>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {freshness && <span className="hidden text-[10px] text-slate-500 sm:inline">{freshness}</span>}
          <Badge
            variant="outline"
            title={connected ? "Receiving live pitch-by-pitch updates" : "Live connection unavailable — falling back to periodic polling"}
            className={cn(
              "font-scoreboard text-[10px]",
              connected ? "border-mint/30 bg-mint/10 text-mint" : "border-warning-track/30 bg-warning-track/10 text-warning-track"
            )}
          >
            <span className={cn("mr-1 h-1.5 w-1.5 rounded-full", connected ? "animate-live-dot bg-mint" : "bg-warning-track")} />
            {connected ? "Live" : "Polling"}
          </Badge>
        </div>
      </div>

      <InningJumpStrip groups={groups} shownIndex={shownIndex} onJump={jumpToAtBat} />

      <AtBatDisplay
        pitches={atBat.pitches}
        awayTeamId={teams?.away?.id}
        homeTeamId={teams?.home?.id}
        variant="page"
        className="glass rounded-2xl"
      />

      <div className="flex items-center justify-between gap-2">
        <NavButton onClick={() => step(-1)} disabled={position <= 0} label="Previous at-bat" hint="Previous at-bat (left arrow)">
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </NavButton>

        {isFollowingLive ? (
          <span className="font-scoreboard flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-mint">
            <Radio className="h-3 w-3 animate-live-dot" />
            Following live
          </span>
        ) : (
          <button
            onClick={() => setSelectedAtBatIndex(null)}
            className="font-scoreboard rounded-lg border border-warning-track/40 bg-warning-track/10 px-3 py-1.5 text-[10px] uppercase tracking-wide text-warning-track transition-colors hover:bg-warning-track/20"
          >
            Jump to live at-bat
          </button>
        )}

        <NavButton onClick={() => step(1)} disabled={position >= groups.length - 1} label="Next at-bat" hint="Next at-bat (right arrow)">
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </NavButton>
      </div>
    </div>
  );
}

/** One button per half-inning that has pitches, for jumping straight there. */
function InningJumpStrip({ groups, shownIndex, onJump }: {
  groups: AtBatGroup[];
  shownIndex: number | null;
  onJump: (atBatIndex: number) => void;
}) {
  const halfInnings = useMemo(() => {
    const firstIndexByHalf = new Map<string, { inning: number; halfInning: "top" | "bottom"; atBatIndex: number }>();
    for (const g of groups) {
      const key = `${g.inning}-${g.halfInning}`;
      if (!firstIndexByHalf.has(key)) firstIndexByHalf.set(key, { inning: g.inning, halfInning: g.halfInning, atBatIndex: g.atBatIndex });
    }
    return Array.from(firstIndexByHalf.values());
  }, [groups]);

  const shownHalf = groups.find((g) => g.atBatIndex === shownIndex);

  if (halfInnings.length <= 1) return null;

  return (
    <div className="glass flex items-center gap-1.5 overflow-x-auto rounded-xl px-2 py-1.5 scrollbar-thin">
      <CalendarRange className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      {halfInnings.map((h) => {
        const isCurrent = shownHalf != null && shownHalf.inning === h.inning && shownHalf.halfInning === h.halfInning;
        return (
          <button
            key={`${h.inning}-${h.halfInning}`}
            onClick={() => onJump(h.atBatIndex)}
            aria-current={isCurrent}
            title={`Jump to ${halfInningLabel(h.halfInning, h.inning)}`}
            className={cn(
              "font-scoreboard shrink-0 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors",
              isCurrent
                ? "border-warning-track/50 bg-warning-track/15 text-warning-track"
                : "border-chalk bg-midnight/40 text-slate-400 hover:border-chalk/60 hover:text-chalk"
            )}
          >
            {halfInningLabel(h.halfInning, h.inning)}
          </button>
        );
      })}
    </div>
  );
}

function NavButton({ onClick, disabled, label, hint, children }: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  /** Tooltip — carries the keyboard shortcut, which is otherwise invisible. */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={hint ?? label}
      className="font-scoreboard flex items-center gap-1 rounded-lg border border-chalk bg-midnight/40 px-2.5 py-1.5 text-[10px] uppercase tracking-wide text-slate-300 transition-colors hover:border-chalk/60 hover:text-chalk disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-slate-300 sm:px-3"
    >
      {children}
    </button>
  );
}

/** "NYY 4 — 2 BOS", using whichever runs total the feed has. */
function ScoreLine({ teams, linescore }: {
  teams: { away?: FeedTeam; home?: FeedTeam } | null;
  linescore: Linescore | null;
}) {
  const away = teams?.away;
  const home = teams?.home;
  if (!away || !home) return null;
  return (
    <span className="font-scoreboard flex min-w-0 items-center gap-1.5 text-xs text-slate-300">
      <span className="truncate">{away.abbreviation ?? away.name}</span>
      <span className="num font-bold text-chalk">{linescore?.teams?.away?.runs ?? 0}</span>
      <span className="text-slate-600">—</span>
      <span className="num font-bold text-chalk">{linescore?.teams?.home?.runs ?? 0}</span>
      <span className="truncate">{home.abbreviation ?? home.name}</span>
    </span>
  );
}
