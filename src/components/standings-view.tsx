"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Loader2, Flame, Snowflake } from "lucide-react";
import { getTeamColor } from "@/lib/team-colors";
import { useSavantStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/loading-states";

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
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-warning-track" />
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
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-scoreboard flex items-center gap-2 text-lg font-bold text-chalk uppercase tracking-wide">
          <Trophy className="h-5 w-5 text-warning-track" />
          Standings
        </h2>
        <span className="font-scoreboard text-[10px] uppercase tracking-wide text-slate-500">{data.season} Season</span>
      </div>

      {/* Tab toggle */}
      <div className="mb-4 flex rounded-lg border border-chalk bg-midnight/40 p-0.5 w-fit">
        {([
          { key: "divisions", label: "Divisions" },
          { key: "wildcard", label: "Wild Card" },
          { key: "playoff", label: "Playoff Picture" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "font-scoreboard rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
              tab === t.key ? "bg-warning-track/20 text-warning-track" : "text-slate-500 hover:text-chalk"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Divisions view */}
      {tab === "divisions" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.divisions.map((div, i) => (
            <DivisionCard key={div.division} division={div} index={i} />
          ))}
        </div>
      )}

      {/* Wild Card view */}
      {tab === "wildcard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WildCardCard title="AL Wild Card" teams={data.wildCard.AL} cutoff={3} />
          <WildCardCard title="NL Wild Card" teams={data.wildCard.NL} cutoff={3} />
        </div>
      )}

      {/* Playoff picture */}
      {tab === "playoff" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
      className="glass rounded-xl p-3"
    >
      <h3 className="font-scoreboard mb-2 text-xs font-bold text-chalk uppercase tracking-wide border-b border-chalk pb-1.5">
        {division.division}
      </h3>
      <div className="space-y-0.5">
        {division.teams.map((t, i) => (
          <TeamRow key={t.id} team={t} rank={i + 1} isDivisionLeader={i === 0} />
        ))}
      </div>
    </motion.div>
  );
}

function WildCardCard({ title, teams, cutoff }: { title: string; teams: TeamStanding[]; cutoff: number }) {
  return (
    <div className="glass rounded-xl p-3">
      <h3 className="font-scoreboard mb-2 text-sm font-bold text-chalk uppercase tracking-wide border-b border-chalk pb-1.5">
        {title}
      </h3>
      <div className="space-y-0.5">
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
    <div className="glass rounded-xl p-4">
      <h3 className="font-scoreboard mb-3 text-sm font-bold text-chalk uppercase tracking-wide border-b border-chalk pb-1.5">
        {title}
      </h3>
      <div className="space-y-3">
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
  const color = getTeamColor(team.id);
  const isStreakWin = team.streak?.startsWith("W");
  const isStreakLoss = team.streak?.startsWith("L");
  const gb = wildCardGB ?? team.gamesBack;
  const isGBZero = gb === "0.0" || gb === "-";

  return (
    <button
      onClick={() => { setSelectedTeamId(team.id); setView("team"); }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-white/10 text-left",
        isDivisionLeader && "bg-mint/5",
        isInWildCard && "bg-cobalt/5"
      )}
    >
      {/* Rank */}
      <span className={cn(
        "font-scoreboard w-4 shrink-0 text-center text-[10px] font-bold num",
        isDivisionLeader ? "text-mint" : isInWildCard ? "text-cobalt" : "text-slate-600"
      )}>
        {rank}
      </span>

      {/* Team color dot */}
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color.primary }} />

      {/* Team abbreviation */}
      <span
        className="font-scoreboard w-8 shrink-0 text-xs font-bold uppercase"
        style={{ color: color.primary === "#000000" || color.primary === "#27251F" ? "#f8f9fa" : color.primary }}
      >
        {team.abbr}
      </span>

      {/* Record */}
      <span className="font-scoreboard text-xs text-chalk num shrink-0">{team.wins}-{team.losses}</span>

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
          {isStreakWin && <Flame className="h-2.5 w-2.5" />}
          {isStreakLoss && <Snowflake className="h-2.5 w-2.5" />}
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
    </button>
  );
}
