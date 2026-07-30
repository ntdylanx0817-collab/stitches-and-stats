"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, ChevronRight } from "lucide-react";
import { useSavantStore } from "@/lib/store";
import { getDisplayTeamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";

interface TickerGame {
  gamePk: number;
  gameDay: "yesterday" | "today" | "tomorrow" | "upcoming";
  abstractState: string;
  detailedState: string;
  statusCode: string;
  gameDate: string;
  gameType?: string;
  seriesDescription?: string;
  venue?: string;
  inning?: number;
  inningState?: string;
  isTopInning?: boolean;
  away: {
    id: number;
    abbr: string;
    name: string;
    score: number | null;
    record?: string;
    isWinner?: boolean;
  };
  home: {
    id: number;
    abbr: string;
    name: string;
    score: number | null;
    record?: string;
    isWinner?: boolean;
  };
}

interface TickerResponse {
  totalGames: number;
  hasLive: boolean;
  games: TickerGame[];
  error?: string;
}

/** Format ISO date to short local time, e.g. "7:05p" */
function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    let h = d.getHours();
    const m = d.getMinutes();
    const isPm = h >= 12;
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    const mStr = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
    return `${h}${mStr}${isPm ? "p" : "a"}`;
  } catch {
    return "";
  }
}

/** Inning state label, e.g. "BOT 5", "MID 7", "END 9" */
function inningLabel(g: TickerGame): string {
  if (!g.inning) return "";
  const num = g.inning;
  const ord =
    num === 1 ? "1st" : num === 2 ? "2nd" : num === 3 ? "3rd" : `${num}th`;
  if (g.inningState === "Top") return `▲ ${ord}`;
  if (g.inningState === "Bottom") return `▼ ${ord}`;
  if (g.inningState === "Middle") return `END ${ord}`;
  if (g.inningState === "End") return `END ${ord}`;
  return `${ord}`;
}

function TeamScoreCell({
  team,
  isLive,
  isWinner,
  homeAway,
}: {
  team: TickerGame["away"];
  isLive: boolean;
  isWinner?: boolean;
  homeAway: "away" | "home";
}) {
  const teamInk = getDisplayTeamColor(team.id);
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-1 rounded-full"
        style={{ background: teamInk }}
        aria-hidden
      />
      <span
        className="font-scoreboard text-[11px] font-bold uppercase tracking-wide text-chalk"
        style={{ minWidth: 22 }}
      >
        {team.abbr}
      </span>
      <span
        className={cn(
          "font-scoreboard text-[13px] font-bold tabular-nums",
          isWinner || (isLive && team.score !== null && team.score > 0)
            ? "text-chalk"
            : "text-slate-400"
        )}
      >
        {team.score ?? (isLive ? "0" : "")}
      </span>
      {/* Hidden on mobile to save space */}
      {team.record && (
        <span className="hidden xl:inline text-[9px] text-slate-500 tabular-nums">
          ({team.record})
        </span>
      )}
      {/* suppress unused warning for homeAway variable */}
      <span className="sr-only">{homeAway}</span>
    </div>
  );
}

function TickerGameCard({
  g,
  onClick,
}: {
  g: TickerGame;
  onClick: () => void;
}) {
  const isLive = g.abstractState === "Live";
  const isFinal = g.abstractState === "Final";
  const isPreview = g.abstractState === "Preview";

  const statusBadge = isLive ? (
    <span className="flex items-center gap-1 rounded-sm bg-crimson/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-crimson font-scoreboard">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-crimson" />
      </span>
      {inningLabel(g)}
    </span>
  ) : isFinal ? (
    <span className="rounded-sm bg-slate-700/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-300 font-scoreboard">
      Final
    </span>
  ) : isPreview ? (
    <span className="rounded-sm bg-warning-track/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning-track font-scoreboard">
      {fmtTime(g.gameDate)}
    </span>
  ) : null;

  return (
    <button
      onClick={onClick}
      className="group flex shrink-0 items-center gap-2.5 rounded-md border border-chalk bg-midnight-2/80 px-3 py-1.5 transition-all hover:border-warning-track/40 hover:bg-midnight-3/90 hover-lift"
      title={`${g.away.name} @ ${g.home.name} — ${
        isLive
          ? `${g.inningState ?? ""} ${g.inning ?? ""}`
          : isFinal
            ? "Final"
            : fmtTime(g.gameDate)
      }`}
    >
      {/* Status badge first */}
      {statusBadge}

      {/* Away + Home stacked, compact */}
      <div className="flex flex-col gap-0.5">
        <TeamScoreCell team={g.away} isLive={isLive} isWinner={g.away.isWinner} homeAway="away" />
        <TeamScoreCell team={g.home} isLive={isLive} isWinner={g.home.isWinner} homeAway="home" />
      </div>

      {/* Hover chevron */}
      <ChevronRight className="h-3 w-3 text-slate-600 transition-colors group-hover:text-warning-track" />
    </button>
  );
}

export function ScoreTicker() {
  const setSelectedGame = useSavantStore((s) => s.setSelectedGame);
  const setView = useSavantStore((s) => s.setView);

  const { data, isLoading, error } = useQuery<TickerResponse>({
    queryKey: ["score-ticker"],
    queryFn: async () => {
      const res = await fetch("/api/score-ticker");
      if (!res.ok) throw new Error("ticker fetch failed");
      return res.json();
    },
    refetchInterval: (q) => {
      // 15s when live games exist, otherwise 60s
      return q.state.data?.hasLive ? 15_000 : 60_000;
    },
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  const games = useMemo(() => data?.games ?? [], [data?.games]);

  // Duplicate games for seamless infinite scroll
  // (the CSS animation translates by -50% so the second copy lines up)
  const doubledGames = useMemo(() => [...games, ...games], [games]);

  const handleGameClick = (gamePk: number) => {
    setSelectedGame(gamePk);
    setView("live");
    // Scroll to top so the user lands on the live view
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (isLoading || games.length === 0) {
    // Render a slim bar with "Loading scores...", "Scores unavailable", or "No games today"
    return (
      <div className="border-t border-chalk bg-midnight/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-1.5 sm:px-6">
          <TickerLabel live={false} />
          <p className="text-[11px] font-scoreboard uppercase tracking-wide text-slate-500">
            {isLoading ? "Loading scores…" : error ? "Scores unavailable — retrying…" : "No MLB games scheduled today"}
          </p>
        </div>
      </div>
    );
  }

  const hasLive = data?.hasLive ?? false;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="sticky bottom-0 z-30 border-t border-chalk bg-midnight/95 backdrop-blur-md"
      >
        {/* Top accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-warning-track/40 to-transparent" />

        <div className="flex items-stretch">
          {/* Fixed left label — "LIVE MLB" or "MLB SCORES" */}
          <div className="relative z-10 flex shrink-0 items-center gap-2 border-r border-chalk bg-gradient-to-r from-midnight-2 to-midnight px-3 py-2 sm:px-4">
            <TickerLabel live={hasLive} />
          </div>

          {/* Scrolling ticker area */}
          <div
            className="ticker-scroll relative flex-1 overflow-hidden"
            onMouseEnter={(e) => {
              e.currentTarget.style.animationPlayState = "paused";
              const inner = e.currentTarget.querySelector<HTMLElement>(".ticker-inner");
              if (inner) inner.style.animationPlayState = "paused";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.animationPlayState = "running";
              const inner = e.currentTarget.querySelector<HTMLElement>(".ticker-inner");
              if (inner) inner.style.animationPlayState = "running";
            }}
          >
            <div className="ticker-inner flex items-center gap-2 py-2 pl-2 pr-8">
              {doubledGames.map((g, idx) => (
                <TickerGameCard
                  key={`${g.gamePk}-${idx}`}
                  g={g}
                  onClick={() => handleGameClick(g.gamePk)}
                />
              ))}
              {/* Trailing spacer so the loop seam isn't visible */}
              <div className="shrink-0" style={{ width: 32 }} />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function TickerLabel({ live }: { live: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-warning-track to-crimson">
        <Radio className={cn("h-3.5 w-3.5 text-chalk", live && "animate-pulse")} fill="currentColor" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-scoreboard text-[11px] font-bold uppercase tracking-wider text-chalk">
          {live ? "Live MLB" : "MLB Scores"}
        </span>
        <span className="hidden sm:inline text-[8px] font-scoreboard uppercase tracking-[0.2em] text-slate-500">
          Cross-Game Ticker
        </span>
      </div>
    </div>
  );
}
