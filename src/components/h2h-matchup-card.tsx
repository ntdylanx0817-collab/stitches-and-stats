"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Swords, Loader2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamGameResult {
  gamePk: number;
  date: string;
  awayTeam: string;
  homeTeam: string;
  awayScore: number | null;
  homeScore: number | null;
  winner: "away" | "home" | "tie";
  status: string;
}

interface BatterPitcherMatchup {
  batterId: number;
  batterName: string;
  pitcherId: number;
  pitcherName: string;
  plateAppearances: number;
  atBats: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  strikeouts: number;
  walks: number;
  battingAvg: number;
  onBasePct: number;
  slugging: number;
  ops: number;
  totalPitches: number;
  avgExitVelo: number;
}

interface H2HData {
  team1Id: number;
  team1Name: string;
  team1Abbr: string;
  team2Id: number;
  team2Name: string;
  team2Abbr: string;
  recentGames: TeamGameResult[];
  team1Wins: number;
  team2Wins: number;
  batterPitcherMatchups: BatterPitcherMatchup[];
  totalMatchups: number;
  insight: string;
}

interface H2HMatchupCardProps {
  team1Id: number;
  team2Id: number;
  gamePk?: number;
}

export function H2HMatchupCard({ team1Id, team2Id, gamePk }: H2HMatchupCardProps) {
  const { data, isLoading } = useQuery<H2HData>({
    queryKey: ["h2h", team1Id, team2Id, gamePk],
    queryFn: async () => {
      const params = new URLSearchParams({
        team1Id: String(team1Id),
        team2Id: String(team2Id),
      });
      if (gamePk) params.set("gamePk", String(gamePk));
      const res = await fetch(`/api/h2h?${params}`);
      if (!res.ok) throw new Error("h2h fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="card-broadcast rounded-2xl p-4">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Swords className="h-4 w-4 text-warning-track" />
          H2H Matchup Context
        </h3>
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-warning-track" />
        </div>
      </div>
    );
  }

  if (!data || (data.recentGames.length === 0 && data.batterPitcherMatchups.length === 0)) {
    return null;
  }

  const topMatchups = data.batterPitcherMatchups
    .filter(m => m.plateAppearances > 0)
    .slice(0, 6);

  return (
    <div className="card-broadcast rounded-2xl p-4">
      <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
        <Swords className="h-4 w-4 text-warning-track" />
        H2H Matchup Context
      </h3>

      {/* Team H2H Record */}
      {data.recentGames.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500 font-scoreboard">
            Last {data.recentGames.length} Meetings
          </div>
          <div className="flex items-center justify-center gap-6 py-2">
            <div className="text-center">
              <div className="font-scoreboard text-lg font-bold text-chalk">{data.team1Abbr}</div>
              <div className="font-scoreboard text-3xl font-black text-mint num">{data.team1Wins}</div>
              <div className="text-[9px] text-slate-500 uppercase">Wins</div>
            </div>
            <div className="text-slate-600 font-scoreboard text-xs">VS</div>
            <div className="text-center">
              <div className="font-scoreboard text-lg font-bold text-chalk">{data.team2Abbr}</div>
              <div className="font-scoreboard text-3xl font-black text-crimson num">{data.team2Wins}</div>
              <div className="text-[9px] text-slate-500 uppercase">Wins</div>
            </div>
          </div>

          {/* Recent game results */}
          <div className="flex justify-center gap-2 mt-2">
            {data.recentGames.map((g, i) => (
              <div key={i} className="rounded-md border border-chalk bg-midnight/40 px-2 py-1 text-center">
                <div className="text-[8px] text-slate-600 font-scoreboard">
                  {new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
                <div className="font-scoreboard text-[10px] font-bold text-chalk num">
                  {g.awayScore}-{g.homeScore}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batter vs Pitcher Matchups */}
      {topMatchups.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500 font-scoreboard">
            Batter vs Pitcher History
          </div>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-thin">
            {topMatchups.map((m, i) => {
              const isGood = m.ops >= 0.800;
              const isBad = m.ops > 0 && m.ops < 0.500;
              const tone = isGood ? "text-mint" : isBad ? "text-crimson" : "text-slate-300";
              const border = isGood ? "border-mint/20 bg-mint/5" : isBad ? "border-crimson/20 bg-crimson/5" : "border-chalk bg-midnight/40";

              return (
                <motion.div
                  key={`${m.batterId}-${m.pitcherId}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                  className={cn("rounded-lg border p-2", border)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-chalk truncate">{m.batterName}</div>
                      <div className="text-[9px] text-slate-500 truncate">vs {m.pitcherName}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-[10px] font-scoreboard num">
                      <span className="text-slate-400">{m.plateAppearances}PA</span>
                      <span className="text-slate-400">{m.hits}-{m.atBats}</span>
                      {m.homeRuns > 0 && <span className="text-crimson font-bold">{m.homeRuns}HR</span>}
                      {m.strikeouts > 0 && <span className="text-slate-500">{m.strikeouts}K</span>}
                      <span className={cn("font-bold", tone)}>{m.ops > 0 ? m.ops.toFixed(3).replace(/^0/, "") : "—"}</span>
                      <span className="text-slate-600">OPS</span>
                    </div>
                  </div>
                  {/* Mini stat bar */}
                  {m.plateAppearances > 0 && (
                    <div className="mt-1 flex h-1 overflow-hidden rounded-full bg-midnight">
                      <div className="bg-mint" style={{ width: `${(m.hits / m.plateAppearances) * 100}%` }} />
                      <div className="bg-cobalt" style={{ width: `${(m.walks / m.plateAppearances) * 100}%` }} />
                      <div className="bg-crimson" style={{ width: `${(m.strikeouts / m.plateAppearances) * 100}%` }} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Insight */}
      {data.insight && (
        <div className="mt-3 rounded-lg border border-warning-track/20 bg-warning-track/5 p-2.5">
          <div className="flex items-start gap-2">
            <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-warning-track" />
            <p className="text-[11px] leading-relaxed text-slate-300">{data.insight}</p>
          </div>
        </div>
      )}
    </div>
  );
}
