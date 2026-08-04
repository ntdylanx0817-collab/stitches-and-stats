"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Sunrise, ChevronLeft, ChevronRight, Trophy, Activity, Stethoscope,
  ArrowUpRight, ArrowDownRight, Flame, CircleAlert, CalendarDays,
} from "lucide-react";

import { useSavantStore } from "@/lib/store";
import { getDisplayTeamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";
import { CardSkeleton, ErrorState, EmptyState } from "@/components/loading-states";
import {
  defaultRecapDate, localYmd, recapDayLabel, shiftYmd, slateIsSettled,
  RECAP_ROLLOVER_HOUR,
  type RecapGame, type RecapHitter, type RecapPitcher, type RecapInjury, type SlateTotals,
} from "@/lib/recap";
import type { PlayoffPicture, LeaguePicture, TeamStanding } from "@/lib/standings";

interface RecapPayload {
  date: string;
  season: number;
  isComplete: boolean;
  totals: SlateTotals & { homeRuns: number; hits: number; strikeOuts: number };
  games: RecapGame[];
  hitters: RecapHitter[];
  pitchers: RecapPitcher[];
  injuries: RecapInjury[];
  playoffs: PlayoffPicture | null;
  warnings: string[];
  generatedAt: number;
}

/** Section labels for the degraded-upstream banner. */
const WARNING_LABELS: Record<string, string> = {
  hitting: "batting leaders",
  pitching: "pitching leaders",
  injuries: "the injury report",
  playoffs: "the playoff picture",
};

export function RecapView() {
  const [today, setToday] = useState(() => localYmd(new Date()));
  const [date, setDate] = useState(() => defaultRecapDate(localYmd(new Date())));
  // Once someone steps to a specific day, stop moving the page under them.
  const [pinned, setPinned] = useState(false);

  // A tab left open overnight should wake up on the new slate rather than
  // still showing the day before last. One cheap minute-tick handles both the
  // midnight date change and the 5am settle, and survives sleep/wake in a way
  // a single long timeout does not.
  useEffect(() => {
    const tick = setInterval(() => {
      const nowYmd = localYmd(new Date());
      setToday((prev) => (prev === nowYmd ? prev : nowYmd));
      if (!pinned) {
        const next = defaultRecapDate(nowYmd);
        setDate((prev) => (prev === next ? prev : next));
      }
    }, 60_000);
    return () => clearInterval(tick);
  }, [pinned]);

  const { data, isLoading, error, refetch } = useQuery<RecapPayload>({
    queryKey: ["recap", date],
    queryFn: async () => {
      const res = await fetch(`/api/recap?date=${date}`);
      if (!res.ok) throw new Error("recap fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    // Keep polling only while the slate can still change.
    refetchInterval: (query) => (query.state.data?.isComplete ? false : 2 * 60_000),
  });

  const settled = useMemo(() => slateIsSettled(date, new Date()), [date]);
  const label = recapDayLabel(date, today);
  const atToday = date >= today;

  const step = (delta: number) => {
    setPinned(true);
    setDate((prev) => shiftYmd(prev, delta));
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6">
      <header className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-scoreboard flex items-center gap-2 text-lg font-bold uppercase tracking-wide text-chalk">
            <Sunrise className="h-5 w-5 text-amber drop-shadow-[0_0_8px_rgba(255,181,71,0.55)]" />
            Morning Recap
          </h2>

          {/* Day stepper */}
          <div className="flex items-center gap-1 rounded-lg border border-chalk bg-midnight/40 p-0.5">
            <button
              onClick={() => step(-1)}
              aria-label="Previous day"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-warning-track/10 hover:text-warning-track"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-scoreboard flex min-w-[9rem] items-center justify-center gap-1.5 px-2 text-xs font-bold uppercase tracking-wide text-chalk">
              <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
              {label}
            </span>
            <button
              onClick={() => step(1)}
              disabled={atToday}
              aria-label="Next day"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-warning-track/10 hover:text-warning-track disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="mt-1.5 text-xs text-slate-500">
          Everything that happened on{" "}
          <span className="num text-slate-400">{date}</span>
          {" — "}
          {data?.isComplete
            ? "final scores, standout performances, injuries, and where the playoff race stands."
            : settled
              ? "scores, standout performances, injuries, and the playoff race."
              : `the slate is still settling — every game is final by ${RECAP_ROLLOVER_HOUR}:00 AM.`}
        </p>
        <div className="mt-3 h-px bg-gradient-to-r from-warning-track/40 via-warning-track/10 to-transparent" />
      </header>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <CardSkeleton key={i} lines={4} />)}
        </div>
      )}

      {error && !isLoading && (
        <ErrorState
          title="Couldn't load the recap"
          description="The MLB Stats API may be temporarily unavailable."
          onRetry={() => refetch()}
        />
      )}

      {data && !isLoading && (
        <div className="space-y-6">
          {data.warnings.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber/30 bg-amber/5 px-3 py-2 text-xs text-amber">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Couldn&apos;t load{" "}
                {data.warnings.map((w) => WARNING_LABELS[w] ?? w).join(", ")}
                {" — the rest of the recap is complete."}
              </span>
            </div>
          )}

          {data.games.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No games on this date"
              description="Nothing was played — try stepping back a day."
            />
          ) : (
            <>
              <SlateStrip totals={data.totals} isComplete={data.isComplete} />
              <Section title="Scoreboard" icon={Activity} accent="text-warning-track">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {data.games.map((game, i) => (
                    <GameCard key={game.gamePk} game={game} index={i} />
                  ))}
                </div>
              </Section>
            </>
          )}

          {(data.hitters.length > 0 || data.pitchers.length > 0) && (
            <Section title="Standout Performances" icon={Flame} accent="text-crimson">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <PerformerCard title="At the Plate" tone="crimson">
                  {data.hitters.map((h, i) => (
                    <PerformerRow
                      key={h.playerId}
                      index={i}
                      playerId={h.playerId}
                      name={h.name}
                      teamId={h.teamId}
                      teamAbbr={h.teamAbbr}
                      line={h.line}
                      type="batter"
                    />
                  ))}
                </PerformerCard>
                <PerformerCard title="On the Mound" tone="cobalt">
                  {data.pitchers.map((p, i) => (
                    <PerformerRow
                      key={p.playerId}
                      index={i}
                      playerId={p.playerId}
                      name={p.name}
                      teamId={p.teamId}
                      teamAbbr={p.teamAbbr}
                      line={p.line}
                      type="pitcher"
                    />
                  ))}
                </PerformerCard>
              </div>
            </Section>
          )}

          <Section title="Injury Report" icon={Stethoscope} accent="text-crimson">
            <InjuryReport injuries={data.injuries} />
          </Section>

          {data.playoffs && (
            <Section title="Playoff Picture" icon={Trophy} accent="text-amber">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <PlayoffColumn picture={data.playoffs.AL} />
                <PlayoffColumn picture={data.playoffs.NL} />
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Section({
  title, icon: Icon, accent, children,
}: {
  title: string;
  icon: typeof Activity;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="font-scoreboard mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
        <Icon className={cn("h-3.5 w-3.5 icon-glow", accent)} />
        {title}
      </h3>
      {children}
    </section>
  );
}

function SlateStrip({ totals, isComplete }: { totals: RecapPayload["totals"]; isComplete: boolean }) {
  const stats: Array<{ label: string; value: number; tone?: string }> = [
    { label: "Games", value: totals.games },
    { label: "Runs", value: totals.runs, tone: "text-warning-track" },
    { label: "Home Runs", value: totals.homeRuns, tone: "text-crimson" },
    { label: "Strikeouts", value: totals.strikeOuts, tone: "text-cobalt" },
    { label: "Extra Innings", value: totals.extraInnings },
    { label: "One-Run", value: totals.oneRunGames },
    { label: "Shutouts", value: totals.shutouts, tone: "text-mint" },
  ];

  return (
    <div className="glass card-accent-left rounded-xl p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "font-scoreboard rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            isComplete
              ? "bg-mint/15 text-mint"
              : "bg-warning-track/15 text-warning-track animate-pulse-glow"
          )}
        >
          {isComplete ? "Final" : `${totals.live} in progress`}
        </span>
        {totals.scheduled > 0 && (
          <span className="font-scoreboard text-[9px] uppercase tracking-wide text-slate-500">
            {totals.scheduled} not started
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-y-3 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.28) }}
          >
            <div className={cn("font-scoreboard num text-xl font-black leading-none", s.tone ?? "text-chalk")}>
              {s.value.toLocaleString()}
            </div>
            <div className="label-xs mt-1 text-slate-500">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function GameCard({ game, index }: { game: RecapGame; index: number }) {
  const setSelectedGame = useSavantStore((s) => s.setSelectedGame);
  const setView = useSavantStore((s) => s.setView);

  // A postponed game sits in the "Preview" abstract state same as an
  // upcoming one — without this check it would render a start time as if it
  // were still about to be played, which reads as wrong the day after.
  const isPostponed = /postponed|suspended|cancelled/i.test(game.detailedState);

  const statusLabel = game.state === "Final"
    ? game.isExtras ? `F/${game.innings}` : "Final"
    : game.state === "Live"
      ? game.detailedState || "Live"
      : isPostponed
        ? game.detailedState
        : new Date(game.gameDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), type: "spring", stiffness: 320, damping: 28 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => { setSelectedGame(game.gamePk); setView("live"); }}
      className="glass glass-hover group w-full rounded-xl p-3 text-left"
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={cn(
            "font-scoreboard text-[9px] font-bold uppercase tracking-wide",
            game.state === "Live" ? "text-mint animate-live-dot" : isPostponed ? "text-crimson" : "text-slate-500"
          )}
        >
          {statusLabel}
          {game.gameNumber ? ` · G${game.gameNumber}` : ""}
        </span>
        {game.isExtras && game.state === "Final" && (
          <span className="font-scoreboard rounded bg-warning-track/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-warning-track">
            Extras
          </span>
        )}
      </div>

      <TeamLine side={game.away} decided={game.state === "Final"} />
      <TeamLine side={game.home} decided={game.state === "Final"} />

      {game.decisions?.winner && (
        <div className="mt-2 border-t border-faint pt-1.5 text-[10px] leading-relaxed text-slate-500">
          <span className="text-mint">W</span> {game.decisions.winner.name}
          {game.decisions.loser && (
            <>
              {" · "}
              <span className="text-crimson">L</span> {game.decisions.loser.name}
            </>
          )}
          {game.decisions.save && (
            <>
              {" · "}
              <span className="text-cobalt">S</span> {game.decisions.save.name}
            </>
          )}
        </div>
      )}
    </motion.button>
  );
}

/**
 * `decided` keeps the losing-side dimming off games that have not finished —
 * in a live game nobody has lost yet, and fading both teams made an in-progress
 * card read as less important than the finals around it.
 */
function TeamLine({ side, decided }: { side: RecapGame["away"]; decided: boolean }) {
  const ink = getDisplayTeamColor(side.id);
  const lost = decided && !side.isWinner;
  return (
    <div className={cn("flex items-center gap-2 py-0.5", lost && "opacity-70")}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ink }} />
      <span className="font-scoreboard w-9 shrink-0 text-xs font-bold uppercase" style={{ color: ink }}>
        {side.abbr}
      </span>
      {side.record && (
        <span className="font-scoreboard num hidden text-[9px] text-slate-600 sm:inline">
          {side.record}
        </span>
      )}
      <span
        className={cn(
          "font-scoreboard num ml-auto text-lg leading-none",
          side.isWinner
            ? "font-black text-chalk text-glow-warning"
            : lost
              ? "font-bold text-slate-400"
              : "font-bold text-chalk"
        )}
      >
        {side.score ?? "–"}
      </span>
    </div>
  );
}

function PerformerCard({
  title, tone, children,
}: {
  title: string;
  tone: "crimson" | "cobalt";
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-3">
      <h4
        className={cn(
          "font-scoreboard mb-2 border-b border-chalk pb-1.5 text-[10px] font-bold uppercase tracking-wide",
          tone === "crimson" ? "text-crimson" : "text-cobalt"
        )}
      >
        {title}
      </h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function PerformerRow({
  index, playerId, name, teamId, teamAbbr, line, type,
}: {
  index: number;
  playerId: number;
  name: string;
  teamId: number | null;
  teamAbbr: string;
  line: string;
  type: "batter" | "pitcher";
}) {
  const setSelectedPlayer = useSavantStore((s) => s.setSelectedPlayer);
  const setView = useSavantStore((s) => s.setView);
  const ink = teamId ? getDisplayTeamColor(teamId) : "#e67e22";

  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.24), type: "spring", stiffness: 320, damping: 28 }}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => { setSelectedPlayer({ id: playerId, name, type }); setView("players"); }}
      style={{ "--row-accent": `${ink}cc` } as React.CSSProperties}
      className="interactive-row group flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-3 text-left hover:bg-warning-track/10"
    >
      {index < 3 ? (
        <span className="animate-slide-in-medal w-4 shrink-0 text-center text-[11px] leading-none">
          {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
        </span>
      ) : (
        <span className="font-scoreboard num w-4 shrink-0 text-center text-[10px] font-bold text-slate-600">
          {index + 1}
        </span>
      )}
      <span className="font-scoreboard w-9 shrink-0 text-[10px] font-bold uppercase" style={{ color: ink }}>
        {teamAbbr}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-chalk transition-colors group-hover:text-warning-track">
        {name}
      </span>
      <span className="font-scoreboard num shrink-0 text-[10px] text-slate-400">{line}</span>
    </motion.button>
  );
}

function InjuryReport({ injuries }: { injuries: RecapInjury[] }) {
  if (injuries.length === 0) {
    return (
      <div className="glass rounded-xl px-3 py-4 text-center text-xs text-slate-500">
        No injured-list moves reported on this date.
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-3">
      <div className="space-y-0.5">
        {injuries.map((entry, i) => {
          const out = entry.move !== "activated";
          const ink = entry.teamId ? getDisplayTeamColor(entry.teamId) : "#e67e22";
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.025, 0.3) }}
              style={{ "--row-accent": `${ink}cc` } as React.CSSProperties}
              className="interactive-row flex items-start gap-2 rounded-md px-2 py-1.5 pl-3"
            >
              {out ? (
                <ArrowDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-crimson icon-glow" />
              ) : (
                <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint icon-glow" />
              )}
              <span
                className="font-scoreboard mt-0.5 w-9 shrink-0 text-[10px] font-bold uppercase"
                style={{ color: ink }}
              >
                {entry.teamAbbr}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-xs font-semibold text-chalk">{entry.playerName}</span>
                  <span
                    className={cn(
                      "font-scoreboard rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide",
                      out ? "bg-crimson/15 text-crimson" : "bg-mint/15 text-mint"
                    )}
                  >
                    {entry.move === "activated" ? "Activated" : entry.listLabel}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{entry.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function PlayoffColumn({ picture }: { picture: LeaguePicture }) {
  return (
    <div className="glass rounded-xl p-3">
      <h4 className="font-scoreboard mb-2 border-b border-chalk pb-1.5 text-[10px] font-bold uppercase tracking-wide text-chalk">
        {picture.league}
      </h4>
      <div className="space-y-2.5">
        <PlayoffGroup label="Division Leaders" tone="text-mint" teams={picture.divisionLeaders} showGb={false} />
        <PlayoffGroup label="Wild Card" tone="text-cobalt" teams={picture.wildCard} showGb />
        {picture.chasing.length > 0 && (
          <PlayoffGroup label="In the Hunt" tone="text-amber" teams={picture.chasing} showGb />
        )}
      </div>
    </div>
  );
}

function PlayoffGroup({
  label, tone, teams, showGb,
}: {
  label: string;
  tone: string;
  teams: TeamStanding[];
  showGb: boolean;
}) {
  const setSelectedTeamId = useSavantStore((s) => s.setSelectedTeamId);
  const setView = useSavantStore((s) => s.setView);

  return (
    <div>
      <div className={cn("label-xs mb-1", tone)}>{label}</div>
      {teams.map((team) => {
        const ink = getDisplayTeamColor(team.id);
        const gb = showGb ? team.wildCardGamesBack : team.gamesBack;
        return (
          <button
            key={team.id}
            onClick={() => { setSelectedTeamId(team.id); setView("team"); }}
            style={{ "--row-accent": `${ink}cc` } as React.CSSProperties}
            className="interactive-row flex w-full items-center gap-2 rounded-md px-2 py-1 pl-3 text-left hover:bg-warning-track/10"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ink }} />
            <span className="font-scoreboard w-9 shrink-0 text-[11px] font-bold uppercase" style={{ color: ink }}>
              {team.abbr}
            </span>
            <span className="font-scoreboard num text-[11px] text-chalk">
              {team.wins}-{team.losses}
            </span>
            <span className="font-scoreboard num ml-auto text-[10px] text-slate-500">
              {gb === "-" || gb === "0.0" ? "—" : gb}
            </span>
          </button>
        );
      })}
    </div>
  );
}
