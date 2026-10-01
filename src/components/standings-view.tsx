"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, Snowflake } from "lucide-react";

import { getDisplayTeamColor } from "@/lib/team-colors";
import { useSavantStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CardSkeleton, ErrorState } from "@/components/loading-states";
import { BaseballMark } from "@/components/ui/baseball-mark";

interface TeamStanding {
  id: number;
  abbr: string;
  name: string;
  wins: number;
  losses: number;
  pct: string;
  gamesBack: string;
  wildCardGamesBack: string;
  streak: string;
  divisionRank: string;
  leagueRank: string;
  runsScored: number;
  runsAllowed: number;
  runDifferential: number;
  division: string;
  league: string;
}

interface DivisionStanding {
  division: string;
  teams: TeamStanding[];
}

interface StandingsData {
  season: number;
  divisions: DivisionStanding[];
  wildCard: { AL: TeamStanding[]; NL: TeamStanding[] };
  allTeams: TeamStanding[];
}

function shortDivisionName(name: string): string {
  return name
    .replace("American League", "AL")
    .replace("National League", "NL");
}

export function StandingsView() {
  const [tab, setTab] = useState<"divisions" | "wildcard" | "playoff">("divisions");

  const { data, isLoading, error, refetch } = useQuery<StandingsData>({
    queryKey: ["standings"],
    queryFn: async () => {
      const res = await fetch("/api/standings");
      if (!res.ok) throw new Error("standings fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        {/* Three division cards, which is what the loaded view is. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} lines={5} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <ErrorState
          title="Couldn't load standings"
          description="The MLB Stats API may be temporarily unavailable."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6">
      <section className="scorebook-panel mb-5 px-5 py-5 sm:px-7 sm:py-6" aria-labelledby="standings-heading">
        <BaseballMark
          size={230}
          className="pointer-events-none text-heritage-red/[0.065]"
          style={{ position: "absolute", right: "-3rem", top: "-4rem" }}
        />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <span className="editorial-kicker">Pennant race</span>
            <h1 id="standings-heading" className="mt-3 font-scoreboard text-4xl font-black uppercase leading-[0.9] tracking-[-0.025em] text-chalk sm:text-5xl">
              Clubhouse <span className="text-heritage-red">Board</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-500">
              Division races, wild-card pressure, and the road to October.
            </p>
          </div>
          <div className="flex items-end gap-5 border-t border-chalk pt-3 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <div>
              <div className="broadcast-number text-4xl font-black leading-none text-chalk">{data.season}</div>
              <div className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-slate-500">Season</div>
            </div>
            <div>
              <div className="broadcast-number text-4xl font-black leading-none text-heritage-red">{data.divisions.length}</div>
              <div className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-slate-500">Divisions</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tab toggle */}
      <div role="tablist" aria-label="Standings views" className="scorecard-cut mb-5 flex w-fit max-w-full overflow-x-auto border border-chalk bg-midnight/40 p-0.5 scrollbar-thin">
        {([
          { key: "divisions", label: "Divisions" },
          { key: "wildcard", label: "Wild Card" },
          { key: "playoff", label: "Playoff Picture" },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`standings-panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={cn(
              "font-scoreboard min-h-10 shrink-0 rounded-sm px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
              tab === t.key ? "bg-heritage-red/15 text-heritage-red shadow-[inset_0_-2px_0_var(--heritage-red)]" : "text-slate-500 hover:text-chalk"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Divisions view */}
      {tab === "divisions" && (
        <div id="standings-panel-divisions" role="tabpanel" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.divisions.map((div, i) => (
            <DivisionCard key={div.division} division={div} index={i} />
          ))}
        </div>
      )}

      {/* Wild Card view */}
      {tab === "wildcard" && (
        <div id="standings-panel-wildcard" role="tabpanel" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WildCardCard title="AL Wild Card" teams={data.wildCard.AL} cutoff={3} />
          <WildCardCard title="NL Wild Card" teams={data.wildCard.NL} cutoff={3} />
        </div>
      )}

      {/* Playoff picture */}
      {tab === "playoff" && (
        <div id="standings-panel-playoff" role="tabpanel" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PlayoffCard title="American League" teams={data.allTeams.filter(t => t.league === "American League")} />
          <PlayoffCard title="National League" teams={data.allTeams.filter(t => t.league === "National League")} />
        </div>
      )}
    </div>
  );
}

function DivisionCard({ division, index }: { division: DivisionStanding; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      className="scorecard-cut overflow-hidden border border-chalk bg-card/35 shadow-[0_16px_32px_-28px_rgba(0,0,0,0.8)]"
    >
      <div className="border-b border-chalk bg-chalk/[0.025] px-4 py-3">
        <span className="font-mono text-[7px] font-bold uppercase tracking-[0.2em] text-heritage-red">Division {String(index + 1).padStart(2, "0")}</span>
        <h3 className="mt-1 font-scoreboard text-lg font-black uppercase leading-none tracking-wide text-chalk">
          {shortDivisionName(division.division)}
        </h3>
        <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] gap-3 font-mono text-[7px] font-bold uppercase tracking-[0.16em] text-slate-600">
          <span>Club</span><span>Record</span><span>GB</span><span>Form</span>
        </div>
      </div>
      <div className="px-2 py-2">
        {division.teams.map((t, i) => (
          <TeamRow key={t.id} team={t} rank={i + 1} isDivisionLeader={i === 0} />
        ))}
      </div>
    </motion.div>
  );
}

function WildCardCard({ title, teams, cutoff }: { title: string; teams: TeamStanding[]; cutoff: number }) {
  return (
    <div className="scorecard-cut overflow-hidden border border-chalk bg-card/35">
      <div className="border-b border-chalk bg-chalk/[0.025] px-4 py-3">
        <span className="editorial-kicker">October watch</span>
        <h3 className="mt-2 font-scoreboard text-xl font-black uppercase tracking-wide text-chalk">{title}</h3>
      </div>
      <div className="px-2 py-2">
        {teams.map((t, i) => (
          <TeamRow key={t.id} team={t} rank={i + 1} isInWildCard={i < cutoff} wildCardGB={t.wildCardGamesBack} />
        ))}
      </div>
    </div>
  );
}

function PlayoffCard({ title, teams }: { title: string; teams: TeamStanding[] }) {
  // 3 division leaders + 3 wild card = 6 playoff teams
  const divisionLeaders = teams.filter(t => t.divisionRank === "1");
  const nonLeaders = teams.filter(t => t.divisionRank !== "1")
    .sort((a, b) => parseFloat(a.wildCardGamesBack) - parseFloat(b.wildCardGamesBack));
  const wildCard = nonLeaders.slice(0, 3);
  const onBubble = nonLeaders.slice(3, 6);

  return (
    <div className="scorecard-cut overflow-hidden border border-chalk bg-card/35">
      <div className="border-b border-chalk bg-chalk/[0.025] px-4 py-3">
        <span className="editorial-kicker">Projected field</span>
        <h3 className="mt-2 font-scoreboard text-xl font-black uppercase tracking-wide text-chalk">{title}</h3>
      </div>
      <div className="space-y-4 px-3 py-3">
        <div>
          <div className="font-scoreboard text-[9px] uppercase tracking-wide text-mint mb-1">Division Leaders</div>
          {divisionLeaders.map((t, i) => (
            <TeamRow key={t.id} team={t} rank={i + 1} isDivisionLeader />
          ))}
        </div>
        <div>
          <div className="font-scoreboard text-[9px] uppercase tracking-wide text-cobalt mb-1">Wild Card</div>
          {wildCard.map((t, i) => (
            <TeamRow key={t.id} team={t} rank={i + 4} isInWildCard />
          ))}
        </div>
        {onBubble.length > 0 && (
          <div>
            <div className="font-scoreboard text-[9px] uppercase tracking-wide text-amber mb-1">On the Bubble</div>
            {onBubble.map((t, i) => (
              <TeamRow key={t.id} team={t} rank={i + 7} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamRow({
  team, rank, isDivisionLeader, isInWildCard, wildCardGB,
}: {
  team: TeamStanding;
  rank: number;
  isDivisionLeader?: boolean;
  isInWildCard?: boolean;
  wildCardGB?: string;
}) {
  const setSelectedTeamId = useSavantStore((s) => s.setSelectedTeamId);
  const setView = useSavantStore((s) => s.setView);
  const teamInk = getDisplayTeamColor(team.id);
  const isStreakWin = team.streak?.startsWith("W");
  const isStreakLoss = team.streak?.startsWith("L");
  const gb = wildCardGB ?? team.gamesBack;
  const isGBZero = gb === "0.0" || gb === "-";

  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(rank * 0.03, 0.3), type: "spring", stiffness: 320, damping: 28 }}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => { setSelectedTeamId(team.id); setView("team"); }}
      style={{ "--row-accent": `${teamInk}cc` } as React.CSSProperties}
      className={cn(
        "interactive-row group flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-3 hover:bg-warning-track/10 text-left cursor-pointer",
        isDivisionLeader && "bg-mint/5",
        isInWildCard && "bg-cobalt/5"
      )}
    >
      <span
        className={cn(
          "broadcast-number w-6 shrink-0 text-center text-lg font-black leading-none",
          rank === 1 ? "text-heritage-red" : isInWildCard ? "text-cobalt" : "text-slate-600"
        )}
        aria-label={`Rank ${rank}`}
      >
        {String(rank).padStart(2, "0")}
      </span>

      {/* Team color dot */}
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: teamInk }} />

      {/* Team abbreviation */}
      <span
        className="font-scoreboard w-8 shrink-0 text-xs font-bold uppercase"
        style={{ color: teamInk }}
      >
        {team.abbr}
      </span>

      {/* Record */}
      <span className="font-scoreboard shrink-0 text-xs text-chalk num">{team.wins}-{team.losses}</span>

      {/* PCT */}
      <span className="font-scoreboard text-[10px] text-slate-500 num hidden sm:inline">{team.pct}</span>

      {/* Games back */}
      <span className="font-scoreboard text-[10px] text-slate-500 num shrink-0 ml-auto">
        {isGBZero ? "-" : `${gb}`}
      </span>

      {/* Streak */}
      {team.streak && (
        <span className={cn(
          "flex items-center gap-0.5 font-scoreboard text-[9px] font-bold shrink-0",
          isStreakWin ? "text-mint" : isStreakLoss ? "text-crimson" : "text-slate-500"
        )}>
          {isStreakWin && <Flame className="icon-glow h-2.5 w-2.5 transition-transform duration-200 group-hover:scale-125" />}
          {isStreakLoss && <Snowflake className="icon-glow h-2.5 w-2.5 transition-transform duration-200 group-hover:scale-125" />}
          {team.streak}
        </span>
      )}

      {/* Run differential */}
      <span className={cn(
        "font-scoreboard text-[9px] num hidden md:inline shrink-0 w-8 text-right",
        team.runDifferential > 0 ? "text-mint" : team.runDifferential < 0 ? "text-crimson" : "text-slate-600"
      )}>
        {team.runDifferential > 0 ? "+" : ""}{team.runDifferential}
      </span>
    </motion.button>
  );
}
