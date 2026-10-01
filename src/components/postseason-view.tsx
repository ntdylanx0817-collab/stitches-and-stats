"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  BellRing,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Clock3,
  Crown,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BaseballFieldMark } from "@/components/ui/baseball-field-mark";
import { ErrorState, Skeleton } from "@/components/loading-states";
import { MatchupStrikeZone } from "@/components/matchup-strike-zone";
import { getDisplayTeamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";
import type {
  PostseasonGame,
  PostseasonPayload,
  PostseasonRoundCode,
  PostseasonSeries,
  PostseasonTeam,
} from "@/lib/postseason";

interface LineupPlayer {
  id: number;
  name: string;
  position: string;
  orderNumber: number;
  isSubstitute: boolean;
  status: string;
  teamSide: "away" | "home";
}

interface LineupChange {
  type: string;
  description: string;
  player: LineupPlayer;
}

interface LineupData {
  awayLineup: LineupPlayer[];
  homeLineup: LineupPlayer[];
  changes: LineupChange[];
  lastUpdated: number;
}

type DetailTab = "preview" | "lineups" | "matchup";

export function PostseasonView() {
  const [roundFilter, setRoundFilter] = useState<"all" | PostseasonRoundCode>("all");
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("preview");
  const [selectedBatterId, setSelectedBatterId] = useState<number | null>(null);
  const season = new Date().getFullYear();

  const { data, isLoading, error, refetch, isFetching } = useQuery<PostseasonPayload>({
    queryKey: ["postseason", season],
    queryFn: async () => {
      const res = await fetch(`/api/postseason?season=${season}`);
      if (!res.ok) throw new Error("postseason fetch failed");
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 2,
  });

  const allGames = useMemo(() => data?.series.flatMap((series) => series.games) ?? [], [data?.series]);
  const fallbackGame = data?.liveGames[0] ?? data?.nextGames[0] ?? allGames.at(-1) ?? null;
  const selectedGame = allGames.find((game) => game.gamePk === selectedGamePk) ?? fallbackGame;
  const selectedSeries = selectedGame
    ? data?.series.find((series) => series.games.some((game) => game.gamePk === selectedGame.gamePk)) ?? null
    : null;

  const { data: lineup, isLoading: lineupLoading, error: lineupError } = useQuery<LineupData>({
    queryKey: ["postseason-lineup", selectedGame?.gamePk],
    queryFn: async () => {
      const res = await fetch(`/api/lineup?gamePk=${selectedGame?.gamePk}`);
      if (!res.ok) throw new Error("lineups pending");
      return res.json();
    },
    enabled: !!selectedGame?.gamePk,
    staleTime: 15_000,
    refetchInterval: selectedGame?.status.abstractGameState === "Live" ? 15_000 : 60_000,
    retry: false,
  });

  const batters = [...(lineup?.awayLineup ?? []), ...(lineup?.homeLineup ?? [])].filter((player) => player.id);
  const selectedBatter = batters.find((player) => player.id === selectedBatterId) ?? batters[0] ?? null;
  const opposingPitcher = selectedBatter && selectedGame
    ? selectedBatter.teamSide === "away"
      ? selectedGame.home.probablePitcher
      : selectedGame.away.probablePitcher
    : null;

  const filteredSeries = data?.series.filter((series) => roundFilter === "all" || series.round === roundFilter) ?? [];
  const currentRound = data?.rounds.find((round) => data.series.some((series) => series.round === round.code && !series.isComplete))
    ?? data?.rounds.at(-1);

  function selectGame(gamePk: number) {
    setSelectedGamePk(gamePk);
    setSelectedBatterId(null);
    setDetailTab("preview");
  }

  function selectRound(round: "all" | PostseasonRoundCode) {
    setRoundFilter(round);
    if (round === "all") return;
    const firstGame = data?.series.find((series) => series.round === round)?.games[0];
    if (firstGame && !data?.series.find((series) => series.round === round)?.games.some((game) => game.gamePk === selectedGame?.gamePk)) {
      selectGame(firstGame.gamePk);
    }
  }

  if (isLoading) return <PostseasonLoading />;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <ErrorState
          title="Couldn’t load the postseason"
          description="The official MLB postseason feed may be updating. Try again in a moment."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      <section aria-labelledby="postseason-title" className="scorebook-panel relative mb-5 px-6 py-8 sm:px-8 lg:px-10">
        <BaseballFieldMark
          size={390}
          className="pointer-events-none text-warning-track/[0.065]"
          style={{ position: "absolute", right: 8, top: -132 }}
        />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="editorial-kicker">The road to the title</span>
            <h1 id="postseason-title" className="font-scoreboard mt-3 text-4xl font-black uppercase leading-none tracking-[-0.04em] text-chalk sm:text-6xl">
              October command center.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Every series, every starter, and every late lineup turn from the Wild Card through the World Series.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <HeroStat value={currentRound?.shortLabel ?? "—"} label="Current round" compact />
            <HeroStat value={String(data.liveGames.length)} label="Live now" />
            <HeroStat value={String(data.completedGames)} label="Games final" />
          </div>
        </div>
      </section>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin" role="group" aria-label="Filter postseason bracket by round">
          <RoundFilterButton active={roundFilter === "all"} onClick={() => selectRound("all")}>Full bracket</RoundFilterButton>
          {data.rounds.map((round) => (
            <RoundFilterButton key={round.code} active={roundFilter === round.code} onClick={() => selectRound(round.code)}>
              {round.shortLabel}
            </RoundFilterButton>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-scoreboard text-[10px] uppercase tracking-[0.14em] text-slate-500">Official MLB feed · 60s refresh</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="scorecard-cut border-chalk/15 bg-card/30">
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {data.series.length === 0 ? (
        <div className="scorebook-panel flex min-h-[360px] flex-col items-center justify-center p-10 text-center">
          <Trophy className="mb-4 h-10 w-10 text-warning-track" />
          <h2 className="font-scoreboard text-2xl font-black uppercase text-chalk">The bracket is not set yet</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            This hub fills automatically when MLB publishes the {season} postseason schedule. The playoff picture remains available in Standings until then.
          </p>
        </div>
      ) : (
        <>
          <BracketBoard series={filteredSeries} selectedGamePk={selectedGame?.gamePk ?? null} onSelectGame={selectGame} />

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.55fr)]">
            {selectedGame && selectedSeries ? (
              <GameCenter
                game={selectedGame}
                series={selectedSeries}
                tab={detailTab}
                onTabChange={setDetailTab}
                lineup={lineup}
                lineupLoading={lineupLoading}
                lineupError={!!lineupError}
                batters={batters}
                selectedBatter={selectedBatter}
                onSelectBatter={setSelectedBatterId}
                opposingPitcher={opposingPitcher}
              />
            ) : null}

            <aside className="space-y-4">
              <NextGames games={data.nextGames} selectedGamePk={selectedGame?.gamePk ?? null} onSelectGame={selectGame} />
              <div className="scorecard-cut border border-chalk bg-card/30 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-mint" />
                  <h2 className="font-scoreboard text-sm font-bold uppercase tracking-wide text-chalk">How projections work</h2>
                </div>
                <p className="text-xs leading-5 text-slate-400">{data.methodology}</p>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function BracketBoard({ series, selectedGamePk, onSelectGame }: {
  series: PostseasonSeries[];
  selectedGamePk: number | null;
  onSelectGame: (gamePk: number) => void;
}) {
  const allRounds = ["F", "D", "L", "W"] as const;
  const populatedRounds = allRounds.filter((round) => series.some((item) => item.round === round));
  const rounds = populatedRounds.length === 1 ? populatedRounds : allRounds;
  return (
    <section aria-labelledby="bracket-title" className="scorecard-cut overflow-hidden border border-chalk bg-card/20">
      <div className="flex items-center justify-between border-b border-chalk px-4 py-3 sm:px-5">
        <div>
          <span className="editorial-kicker">Bracket board</span>
          <h2 id="bracket-title" className="font-scoreboard mt-2 text-xl font-black uppercase text-chalk">From twelve clubs to one</h2>
        </div>
        <Crown className="h-6 w-6 text-warning-track" />
      </div>
      <div className="overflow-x-auto p-4 scrollbar-thin sm:p-5">
        <div className={cn("grid gap-4", rounds.length === 1 ? "grid-cols-1" : "min-w-[1120px] grid-cols-4")}>
          {rounds.map((roundCode, roundIndex) => {
            const roundSeries = series.filter((item) => item.round === roundCode);
            const label = roundSeries[0]?.roundLabel ?? ({ F: "Wild Card Series", D: "Division Series", L: "League Championship", W: "World Series" } as const)[roundCode];
            return (
              <div key={roundCode} className="relative">
                {roundIndex < rounds.length - 1 && <ChevronRight className="absolute -right-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-700" />}
                <div className="mb-3 border-b border-chalk/10 pb-2">
                  <div className="font-scoreboard text-xs font-bold uppercase tracking-[0.14em] text-heritage-red">{label}</div>
                  <div className="mt-0.5 text-[10px] text-slate-600">{roundSeries.length} series</div>
                </div>
                <div className={cn("space-y-3", roundCode === "W" && rounds.length > 1 && "pt-20")}>
                  {roundSeries.length > 0 ? roundSeries.map((item, index) => (
                    <SeriesCard key={item.id} series={item} index={index} selectedGamePk={selectedGamePk} onSelectGame={onSelectGame} />
                  )) : (
                    <div className="scorecard-cut border border-dashed border-chalk/10 p-5 text-center text-xs text-slate-600">Matchup pending</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SeriesCard({ series, index, selectedGamePk, onSelectGame }: {
  series: PostseasonSeries;
  index: number;
  selectedGamePk: number | null;
  onSelectGame: (gamePk: number) => void;
}) {
  const nextGame = series.games.find((game) => game.status.abstractGameState !== "Final") ?? series.games.at(-1);
  const active = !!nextGame && nextGame.gamePk === selectedGamePk;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.2) }}
      onClick={() => nextGame && onSelectGame(nextGame.gamePk)}
      className={cn(
        "scorecard-cut w-full border bg-midnight/45 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-chalk/25",
        active ? "border-heritage-red/60 shadow-lg shadow-heritage-red/10" : "border-chalk/10"
      )}
    >
      <div className="mb-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">
        <span>{series.league}</span>
        <span>{series.isComplete ? "Final" : `Best of ${series.winsNeeded * 2 - 1}`}</span>
      </div>
      <BracketTeam team={series.teamA} wins={series.teamAWins} winsNeeded={series.winsNeeded} />
      <BracketTeam team={series.teamB} wins={series.teamBWins} winsNeeded={series.winsNeeded} />
      {series.projection && !series.isComplete && (
        <div className="mt-2 border-t border-chalk/10 pt-2 text-[10px] text-slate-500">
          <Sparkles className="mr-1 inline h-3 w-3 text-warning-track" />
          {series.projection.favoredTeamName} {Math.max(series.projection.teamAWinProbability, series.projection.teamBWinProbability)}% to advance
        </div>
      )}
    </motion.button>
  );
}

function BracketTeam({ team, wins, winsNeeded }: { team: PostseasonTeam; wins: number; winsNeeded: number }) {
  const color = getDisplayTeamColor(team.id);
  return (
    <div className="flex items-center gap-2 border-t border-chalk/5 py-2 first:border-0">
      <span className="home-plate-mark flex h-7 w-7 shrink-0 items-center justify-center pb-1 font-scoreboard text-[9px] font-black text-white" style={{ backgroundColor: color }}>
        {team.abbreviation.slice(0, 3)}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-chalk">{team.name}</span>
      <div className="flex gap-1" aria-label={`${wins} wins, ${winsNeeded} needed`}>
        {Array.from({ length: winsNeeded }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: i < wins ? color : "rgba(148,163,184,0.18)" }} />
        ))}
      </div>
      <span className="broadcast-number w-4 text-right text-lg font-black text-chalk">{wins}</span>
    </div>
  );
}

function GameCenter({
  game, series, tab, onTabChange, lineup, lineupLoading, lineupError,
  batters, selectedBatter, onSelectBatter, opposingPitcher,
}: {
  game: PostseasonGame;
  series: PostseasonSeries;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  lineup?: LineupData;
  lineupLoading: boolean;
  lineupError: boolean;
  batters: LineupPlayer[];
  selectedBatter: LineupPlayer | null;
  onSelectBatter: (id: number) => void;
  opposingPitcher: PostseasonGame["away"]["probablePitcher"];
}) {
  const live = game.status.abstractGameState === "Live";
  const final = game.status.abstractGameState === "Final";
  return (
    <section aria-labelledby="game-center-title" className="scorecard-cut overflow-hidden border border-chalk bg-card/25">
      <div className="card-broadcast relative p-5 sm:p-6">
        <BaseballFieldMark size={250} className="pointer-events-none text-warning-track/[0.045]" style={{ position: "absolute", right: 12, top: -80 }} />
        <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="editorial-kicker">Series game center</span>
            <h2 id="game-center-title" className="font-scoreboard mt-2 text-xl font-black uppercase text-chalk">
              {series.league} {series.roundLabel} · Game {game.gameNumber}
            </h2>
          </div>
          <div className={cn("scorecard-cut flex items-center gap-2 border px-3 py-1.5 font-scoreboard text-[10px] font-bold uppercase tracking-wide", live ? "border-crimson/40 bg-crimson/10 text-crimson" : "border-chalk/15 bg-midnight/40 text-slate-400")}>
            {live ? <Radio className="h-3.5 w-3.5 animate-pulse" /> : final ? <ShieldCheck className="h-3.5 w-3.5 text-mint" /> : <Clock3 className="h-3.5 w-3.5" />}
            {game.status.detailedState}
          </div>
        </div>

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <GameTeam team={game.away.team} score={game.away.score} side="Away" align="right" />
          <div className="text-center">
            <div className="font-scoreboard text-xs font-bold uppercase tracking-[0.16em] text-slate-600">at</div>
            <div className="mt-1 text-[10px] text-slate-500">{formatGameTime(game.gameDate)}</div>
          </div>
          <GameTeam team={game.home.team} score={game.home.score} side="Home" align="left" />
        </div>

        {game.prediction && (
          <div className="relative mt-5">
            <div className="mb-1.5 flex justify-between font-scoreboard text-[10px] font-bold uppercase tracking-wide">
              <span style={{ color: getDisplayTeamColor(game.away.team.id) }}>{game.away.team.abbreviation} {game.prediction.awayWinProbability}%</span>
              <span className="text-slate-500">Model · {game.prediction.confidence}</span>
              <span style={{ color: getDisplayTeamColor(game.home.team.id) }}>{game.prediction.homeWinProbability}% {game.home.team.abbreviation}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-midnight">
              <motion.div initial={{ width: 0 }} animate={{ width: `${game.prediction.awayWinProbability}%` }} style={{ backgroundColor: getDisplayTeamColor(game.away.team.id) }} />
              <motion.div initial={{ width: 0 }} animate={{ width: `${game.prediction.homeWinProbability}%` }} style={{ backgroundColor: getDisplayTeamColor(game.home.team.id) }} />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-chalk px-4 pt-3 scrollbar-thin" role="tablist" aria-label="Game center sections">
        <DetailTabButton active={tab === "preview"} onClick={() => onTabChange("preview")} icon={Activity}>Preview</DetailTabButton>
        <DetailTabButton active={tab === "lineups"} onClick={() => onTabChange("lineups")} icon={BellRing}>Lineups & changes</DetailTabButton>
        <DetailTabButton active={tab === "matchup"} onClick={() => onTabChange("matchup")} icon={Target}>Batter vs pitcher</DetailTabButton>
      </div>

      <div className="p-4 sm:p-5">
        {tab === "preview" && <PreviewPanel game={game} series={series} />}
        {tab === "lineups" && <LineupPanel game={game} lineup={lineup} loading={lineupLoading} unavailable={lineupError} />}
        {tab === "matchup" && (
          <MatchupPanel
            batters={batters}
            selectedBatter={selectedBatter}
            onSelectBatter={onSelectBatter}
            opposingPitcher={opposingPitcher}
            lineupsPending={lineupLoading || lineupError}
          />
        )}
      </div>
    </section>
  );
}

function PreviewPanel({ game, series }: { game: PostseasonGame; series: PostseasonSeries }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <PitcherCard label={`${game.away.team.abbreviation} probable`} pitcher={game.away.probablePitcher} color={getDisplayTeamColor(game.away.team.id)} />
        <PitcherCard label={`${game.home.team.abbreviation} probable`} pitcher={game.home.probablePitcher} color={getDisplayTeamColor(game.home.team.id)} />
      </div>
      {game.prediction ? (
        <div className="scorecard-cut border border-warning-track/20 bg-warning-track/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-warning-track" />
            <h3 className="font-scoreboard text-sm font-bold uppercase tracking-wide text-chalk">Why the model leans {game.prediction.favoredTeamName}</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {game.prediction.factors.map((factor) => (
              <div key={factor} className="flex items-start gap-2 text-xs leading-5 text-slate-400">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning-track" /> {factor}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="scorecard-cut border border-chalk bg-midnight/35 p-4 text-sm text-slate-400">This game is final; the bracket reflects the result.</div>
      )}
      {series.projection && (
        <div className="scorecard-cut border border-chalk bg-midnight/35 p-4">
          <div className="font-scoreboard text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Series outlook</div>
          <p className="mt-1 text-sm text-slate-300">{series.projection.summary}</p>
        </div>
      )}
    </div>
  );
}

function LineupPanel({ game, lineup, loading, unavailable }: { game: PostseasonGame; lineup?: LineupData; loading: boolean; unavailable: boolean }) {
  if (loading) return <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-56 w-full" /></div>;
  if (!lineup || unavailable) {
    return (
      <div className="scorebook-panel flex min-h-[220px] flex-col items-center justify-center p-6 text-center">
        <CalendarDays className="mb-3 h-7 w-7 text-warning-track" />
        <h3 className="font-scoreboard text-lg font-bold uppercase text-chalk">Lineups not posted yet</h3>
        <p className="mt-1 max-w-lg text-xs leading-5 text-slate-400">
          MLB usually posts official cards a few hours before first pitch. This panel refreshes automatically and will flag scratches, pitching changes, pinch hitters, and defensive substitutions.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="scorecard-cut border border-chalk bg-midnight/35 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-scoreboard flex items-center gap-2 text-sm font-bold uppercase text-chalk"><BellRing className="h-4 w-4 text-warning-track" /> Late-change tracker</h3>
          <span className="text-[10px] text-slate-600">Updated {new Date(lineup.lastUpdated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
        </div>
        {lineup.changes.length ? (
          <div className="space-y-2">
            {lineup.changes.map((change, i) => (
              <div key={`${change.type}-${change.player.id}-${i}`} className="scorecard-cut flex items-start gap-2 border border-crimson/20 bg-crimson/5 p-2.5 text-xs text-slate-300">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-crimson" /> {change.description}
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-slate-500">No scratches or substitutions reported for this game.</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <LineupCard title={game.away.team.name} players={lineup.awayLineup} color={getDisplayTeamColor(game.away.team.id)} />
        <LineupCard title={game.home.team.name} players={lineup.homeLineup} color={getDisplayTeamColor(game.home.team.id)} />
      </div>
    </div>
  );
}

function MatchupPanel({ batters, selectedBatter, onSelectBatter, opposingPitcher, lineupsPending }: {
  batters: LineupPlayer[];
  selectedBatter: LineupPlayer | null;
  onSelectBatter: (id: number) => void;
  opposingPitcher: PostseasonGame["away"]["probablePitcher"];
  lineupsPending: boolean;
}) {
  if (!selectedBatter || !opposingPitcher) {
    return (
      <div className="scorebook-panel flex min-h-[240px] flex-col items-center justify-center p-6 text-center">
        <Target className="mb-3 h-7 w-7 text-warning-track" />
        <h3 className="font-scoreboard text-lg font-bold uppercase text-chalk">Matchup board pending</h3>
        <p className="mt-1 max-w-lg text-xs leading-5 text-slate-400">
          {lineupsPending ? "Official lineups and both probable pitchers are needed before batter-vs-pitcher scouting can populate." : "Select a hitter once an opposing probable pitcher is confirmed."}
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-4">
        <div className="font-scoreboard mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Choose a hitter vs {opposingPitcher.name}</div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {batters.map((batter) => (
            <button
              key={`${batter.teamSide}-${batter.id}`}
              type="button"
              onClick={() => onSelectBatter(batter.id)}
              className={cn("scorecard-cut shrink-0 border px-3 py-2 text-left transition-colors", selectedBatter.id === batter.id ? "border-heritage-red/50 bg-heritage-red/10 text-chalk" : "border-chalk/10 bg-midnight/30 text-slate-400 hover:text-chalk")}
            >
              <span className="font-scoreboard mr-2 text-[10px] text-slate-600">{batter.orderNumber || "—"}</span>
              <span className="text-xs font-semibold">{batter.name}</span>
              <span className="ml-2 text-[9px] text-slate-600">{batter.position}</span>
            </button>
          ))}
        </div>
      </div>
      <MatchupStrikeZone
        batterId={selectedBatter.id}
        batterName={selectedBatter.name}
        pitcherId={opposingPitcher.id}
        pitcherName={opposingPitcher.name}
      />
    </div>
  );
}

function NextGames({ games, selectedGamePk, onSelectGame }: { games: PostseasonGame[]; selectedGamePk: number | null; onSelectGame: (gamePk: number) => void }) {
  return (
    <div className="scorecard-cut border border-chalk bg-card/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-cobalt" />
        <h2 className="font-scoreboard text-sm font-bold uppercase tracking-wide text-chalk">Next on the slate</h2>
      </div>
      <div className="space-y-2">
        {games.slice(0, 6).map((game) => (
          <button key={game.gamePk} type="button" onClick={() => onSelectGame(game.gamePk)} className={cn("scorecard-cut w-full border p-3 text-left transition-colors", game.gamePk === selectedGamePk ? "border-heritage-red/40 bg-heritage-red/10" : "border-chalk/10 bg-midnight/30 hover:bg-chalk/5")}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-chalk">{game.away.team.abbreviation} at {game.home.team.abbreviation}</span>
              <span className={cn("font-scoreboard text-[9px] font-bold uppercase", game.status.abstractGameState === "Live" ? "text-crimson" : "text-slate-500")}>{game.status.detailedState}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
              <span>{formatGameTime(game.gameDate)}</span>
              <span>{game.prediction ? `${game.prediction.favoredTeamName} ${Math.max(game.prediction.awayWinProbability, game.prediction.homeWinProbability)}%` : game.venue}</span>
            </div>
          </button>
        ))}
        {games.length === 0 && <p className="py-6 text-center text-xs text-slate-500">No upcoming games are scheduled.</p>}
      </div>
    </div>
  );
}

function PitcherCard({ label, pitcher, color }: { label: string; pitcher: PostseasonGame["away"]["probablePitcher"]; color: string }) {
  return (
    <div className="scorecard-cut border border-chalk bg-midnight/35 p-4" style={{ borderTopColor: color, borderTopWidth: 2 }}>
      <div className="font-scoreboard text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      {pitcher ? (
        <>
          <div className="mt-1 truncate text-sm font-bold text-chalk">{pitcher.name}</div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniMetric label="ERA" value={pitcher.era?.toFixed(2) ?? "—"} />
            <MiniMetric label="WHIP" value={pitcher.whip?.toFixed(2) ?? "—"} />
            <MiniMetric label="K/9" value={pitcher.strikeoutsPer9?.toFixed(1) ?? "—"} />
          </div>
        </>
      ) : <div className="mt-2 text-sm text-slate-500">Starter not announced</div>}
    </div>
  );
}

function LineupCard({ title, players, color }: { title: string; players: LineupPlayer[]; color: string }) {
  return (
    <div className="scorecard-cut overflow-hidden border border-chalk bg-midnight/30">
      <div className="border-b border-chalk px-3 py-2 font-scoreboard text-xs font-bold uppercase text-chalk" style={{ borderLeft: `3px solid ${color}` }}>{title}</div>
      <div className="divide-y divide-chalk/5">
        {players.filter((player) => !player.isSubstitute).slice(0, 9).map((player) => (
          <div key={player.id} className="grid grid-cols-[24px_1fr_auto] items-center gap-2 px-3 py-2 text-xs">
            <span className="broadcast-number text-slate-600">{player.orderNumber || "—"}</span>
            <span className="truncate text-slate-300">{player.name}</span>
            <span className="font-scoreboard text-[9px] text-slate-600">{player.position}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GameTeam({ team, score, side, align }: { team: PostseasonTeam; score: number | null; side: string; align: "left" | "right" }) {
  const color = getDisplayTeamColor(team.id);
  return (
    <div className={cn("flex min-w-0 items-center gap-3", align === "right" ? "flex-row-reverse text-right" : "text-left")}>
      <span className="home-plate-mark flex h-12 w-12 shrink-0 items-center justify-center pb-1 font-scoreboard text-xs font-black text-white sm:h-14 sm:w-14" style={{ backgroundColor: color }}>{team.abbreviation}</span>
      <div className="min-w-0">
        <div className="font-scoreboard text-[9px] uppercase tracking-[0.16em] text-slate-600">{side}</div>
        <div className="truncate font-scoreboard text-lg font-black uppercase text-chalk sm:text-2xl">{team.name}</div>
        <div className="text-[10px] text-slate-500">{team.wins}-{team.losses} · {team.runDifferential > 0 ? "+" : ""}{team.runDifferential} RD</div>
      </div>
      {score != null && <span className="broadcast-number text-4xl font-black text-chalk">{score}</span>}
    </div>
  );
}

function HeroStat({ value, label, compact = false }: { value: string; label: string; compact?: boolean }) {
  return (
    <div className="border-l border-chalk/15 pl-3">
      <div className={cn("broadcast-number font-black text-chalk", compact ? "max-w-[90px] text-lg leading-5" : "text-3xl")}>{value}</div>
      <div className="font-scoreboard mt-1 text-[8px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div><div className="font-scoreboard text-[8px] uppercase tracking-wide text-slate-600">{label}</div><div className="broadcast-number text-lg font-bold text-chalk">{value}</div></div>;
}

function RoundFilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn("scorecard-cut shrink-0 border px-3 py-2 font-scoreboard text-[10px] font-bold uppercase tracking-wide transition-colors", active ? "border-heritage-red/50 bg-heritage-red/15 text-chalk" : "border-chalk/10 bg-card/25 text-slate-500 hover:text-chalk")}>{children}</button>;
}

function DetailTabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: LucideIcon; children: ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cn("relative flex shrink-0 items-center gap-1.5 px-3 pb-3 font-scoreboard text-[10px] font-bold uppercase tracking-wide transition-colors", active ? "text-chalk" : "text-slate-500 hover:text-chalk")}><Icon className={cn("h-3.5 w-3.5", active && "text-heritage-red")} />{children}{active && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-heritage-red" />}</button>;
}

function formatGameTime(value: string): string {
  if (!value) return "Time TBD";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function PostseasonLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6">
      <div className="scorebook-panel p-8"><Skeleton className="mb-4 h-3 w-36" /><Skeleton className="h-12 w-2/3" /><Skeleton className="mt-4 h-4 w-1/2" /></div>
      <div className="grid grid-cols-4 gap-4 overflow-hidden">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 min-w-[260px] scorecard-cut" />)}</div>
    </div>
  );
}
