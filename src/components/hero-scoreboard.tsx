"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAnimatedValue } from "@/components/animated-counter";
import { useScored } from "@/hooks/use-scored";
import { CountdownTimer } from "@/components/countdown-timer";
import { OnBaseTrail } from "@/components/on-base-trail";
import { PlayByPlayModal } from "@/components/play-by-play-modal";
import { getDisplayTeamColor, getTeamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";
import type { GameStatus, Linescore } from "@/lib/types";

interface HeroScoreboardProps {
  gamePk: number;
  awayTeamId: number;
  homeTeamId: number;
  awayAbbr: string;
  homeAbbr: string;
  awayName: string;
  homeName: string;
  awayScore: number;
  homeScore: number;
  status: GameStatus | null;
  linescore: Linescore | null;
  gameDate?: string;
}

interface GameOdds {
  awayWinProb: number;
  homeWinProb: number;
  projectedTotal: number;
  awayProjectedRuns: number;
  homeProjectedRuns: number;
  awayMoneyline: number;
  homeMoneyline: number;
  runLine: number;
  insight: string;
}

export function HeroScoreboard({
  gamePk, awayTeamId, homeTeamId,
  awayAbbr, homeAbbr, awayName, homeName,
  awayScore, homeScore, status, linescore, gameDate,
}: HeroScoreboardProps) {
  const [expanded, setExpanded] = useState(false);
  const state = status?.abstractGameState ?? "Preview";
  const isInning = status?.inning != null && state === "Live";


  // Fetch odds for preview games
  const { data: odds } = useQuery<GameOdds>({
    queryKey: ["odds", awayTeamId, homeTeamId],
    queryFn: async () => {
      const res = await fetch(`/api/odds?awayTeamId=${awayTeamId}&homeTeamId=${homeTeamId}&gamePk=${gamePk}`);
      if (!res.ok) throw new Error("odds failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    enabled: state === "Preview",
  });

  const awayColor = getTeamColor(awayTeamId);
  const homeColor = getTeamColor(homeTeamId);
  // Legible-on-midnight versions, for anything that has to be *seen* rather
  // than merely tint a background — team labels and the run-scored flash.
  const awayInk = getDisplayTeamColor(awayTeamId);
  const homeInk = getDisplayTeamColor(homeTeamId);
  // Whole-card wash when either side scores, so a run registers peripherally
  // even if you weren't looking straight at the number.
  const awayScored = useScored(awayScore ?? 0);
  const homeScored = useScored(homeScore ?? 0);
  const scoringInk = awayScored ? awayInk : homeScored ? homeInk : null;

  // What a screen reader is told about this game. The app's whole purpose is
  // live updates and none of them were announced — a run scoring changed the
  // page silently. Rebuilt from score and half-inning only, so the region's
  // text changes exactly when something worth hearing happens; a pitch-level
  // feed here would talk over the user every twenty seconds.
  const liveSummary = (() => {
    const away = `${awayName || awayAbbr} ${awayScore ?? 0}`;
    const home = `${homeName || homeAbbr} ${homeScore ?? 0}`;
    if (state !== "Live") return `${state}. ${away}, ${home}.`;
    const half = [status?.inningState, status?.inning].filter(Boolean).join(" ");
    return `${half ? half + ". " : ""}${away}, ${home}.`;
  })();

  const startTime = gameDate
    ? new Date(gameDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    : null;

  return (
    <>
    {/* Outside the button on purpose. Inside, its text joined the button's
        accessible name, so the control announced the score twice — once as
        its own label and again as the status. */}
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {liveSummary}
    </p>
    <motion.button
      onClick={() => setExpanded(true)}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      className="card-broadcast rounded-2xl overflow-hidden relative w-full text-left"
      style={{
        background: `linear-gradient(135deg, ${awayColor.primary}15, ${homeColor.primary}15)`,
      }}
    >
      {/* Run-scored wash, in the scoring team's colour. Sits above the card
          background but below the content, and never takes pointer events so
          it can't swallow the click that opens play-by-play. */}
      <AnimatePresence>
        {scoringInk && (
          <motion.div
            key={`${awayScore}-${homeScore}`}
            initial={{ opacity: 0.42 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="pointer-events-none"
            // Positioning is inline on purpose. `.card-broadcast > *` sets
            // `position: relative` on every direct child to lift content above
            // the card's grain and top-line pseudo-elements, and it ties on
            // specificity with Tailwind's `absolute` — so a utility class here
            // loses the coin flip and the wash lands in flow, pushing the
            // scoreboard down instead of covering it. Inline wins outright.
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              background: `radial-gradient(ellipse 90% 70% at 50% 40%, ${scoringInk}, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Team color accent strips */}
      <div className="absolute top-0 left-0 right-0 h-0.5 flex z-[2]">
        <div className="flex-1" style={{ background: awayInk, boxShadow: `0 0 10px ${awayInk}` }} />
        <div className="flex-1" style={{ background: homeInk, boxShadow: `0 0 10px ${homeInk}` }} />
      </div>

      <div className="p-4 sm:p-5">
        {/* Top bar: status + inning */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {state === "Live" && (
              <span className="flex items-center gap-1.5 rounded-md bg-mint/15 px-2 py-0.5">
                <span className="h-1.5 w-1.5 animate-live-dot rounded-full bg-mint" />
                <span className="font-scoreboard text-[10px] font-bold uppercase tracking-wide text-mint">LIVE</span>
              </span>
            )}
            {state === "Final" && (
              <span className="font-scoreboard rounded-md bg-slate-700/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">FINAL</span>
            )}
            {state === "Preview" && startTime && (
              <CountdownTimer gameDate={gameDate || new Date().toISOString()} className="rounded-md bg-warning-track/15 px-2 py-0.5" />
            )}
          </div>
          {isInning && (
            <div className="font-scoreboard text-xs font-bold uppercase tracking-wide text-chalk">
              {status.inningState} {status.inning}
            </div>
          )}
        </div>

        {/* Main scoreboard: two teams + score */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Away team */}
          <div className="flex flex-col items-center sm:flex-row sm:justify-end sm:gap-4">
            <div className="text-center sm:text-right">
              <div
                className="font-scoreboard text-2xl sm:text-3xl font-black uppercase tracking-tight"
                style={{ color: awayInk }}
              >
                {awayAbbr}
              </div>
              <div className="text-[9px] text-slate-500 truncate max-w-[120px]">{awayName}</div>
            </div>
            <motion.div
              key={awayScore}
              initial={{ scale: 0.5, opacity: 0, filter: `drop-shadow(0 0 26px ${awayInk})` }}
              animate={{ scale: 1, opacity: 1, filter: `drop-shadow(0 0 0px ${awayInk}00)` }}
              transition={{ scale: { type: "spring", stiffness: 340, damping: 25 }, opacity: { duration: 0.2 }, filter: { duration: 0.9, ease: "easeOut" } }}
              className="font-scoreboard text-6xl sm:text-7xl font-black num text-chalk leading-none mt-1 sm:mt-0 text-glow-warning-strong"
            >
              <AnimatedScoreDisplay value={awayScore ?? 0} />
            </motion.div>
          </div>

          {/* Center: VS + base runners */}
          <div className="flex flex-col items-center gap-2">
            <div className="font-scoreboard label-xs text-slate-600">VS</div>
            {state === "Live" ? (
              <OnBaseTrail
                gamePk={gamePk}
                awayTeamColor={awayInk}
                homeTeamColor={homeInk}
                isTopInning={true}
              />
            ) : odds ? (
              <div className="flex flex-col items-center gap-1 py-1">
                <div className="font-scoreboard label-xs text-slate-500">Proj Total</div>
                <div className="font-scoreboard text-lg font-bold text-warning-track num">{odds.projectedTotal.toFixed(1)}</div>
                <div className="font-scoreboard text-[8px] text-slate-600">runs</div>
              </div>
            ) : null}
          </div>

          {/* Home team */}
          <div className="flex flex-col items-center sm:flex-row sm:gap-4">
            <motion.div
              key={homeScore}
              initial={{ scale: 0.5, opacity: 0, filter: `drop-shadow(0 0 26px ${homeInk})` }}
              animate={{ scale: 1, opacity: 1, filter: `drop-shadow(0 0 0px ${homeInk}00)` }}
              transition={{ scale: { type: "spring", stiffness: 340, damping: 25 }, opacity: { duration: 0.2 }, filter: { duration: 0.9, ease: "easeOut" } }}
              className="font-scoreboard text-6xl sm:text-7xl font-black num text-chalk leading-none mb-1 sm:mb-0 text-glow-warning-strong"
            >
              <AnimatedScoreDisplay value={homeScore ?? 0} />
            </motion.div>
            <div className="text-center sm:text-left">
              <div
                className="font-scoreboard text-2xl sm:text-3xl font-black uppercase tracking-tight"
                style={{ color: homeInk }}
              >
                {homeAbbr}
              </div>
              <div className="text-[9px] text-slate-500 truncate max-w-[120px]">{homeName}</div>
            </div>
          </div>
        </div>

        {/* Odds row (preview games) */}
        {state === "Preview" && odds && (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-chalk pt-3">
            <div className="text-center">
              <div className="font-scoreboard label-xs text-slate-500">{awayAbbr} ML</div>
              <div className={cn("font-scoreboard text-sm font-bold num", odds.awayMoneyline < 0 ? "text-crimson" : "text-mint")}>
                {odds.awayMoneyline > 0 ? "+" : ""}{odds.awayMoneyline}
              </div>
            </div>
            <div className="text-center">
              <div className="font-scoreboard label-xs text-slate-500">O/U</div>
              <div className="font-scoreboard text-sm font-bold text-warning-track num">{odds.projectedTotal.toFixed(1)}</div>
            </div>
            <div className="text-center">
              <div className="font-scoreboard label-xs text-slate-500">{homeAbbr} ML</div>
              <div className={cn("font-scoreboard text-sm font-bold num", odds.homeMoneyline < 0 ? "text-crimson" : "text-mint")}>
                {odds.homeMoneyline > 0 ? "+" : ""}{odds.homeMoneyline}
              </div>
            </div>
          </div>
        )}

        {/* Inning-by-inning linescore (compact) */}
        {linescore?.innings && linescore.innings.length > 0 && (
          <div className="mt-3 overflow-x-auto scrollbar-thin">
            <div className="flex justify-center gap-px min-w-min">
              {/* Inning numbers */}
              <div className="flex flex-col items-center gap-px mr-1">
                <div className="font-scoreboard text-[8px] text-slate-600 h-4 flex items-center">{awayAbbr}</div>
                <div className="font-scoreboard text-[8px] text-slate-600 h-4 flex items-center">{homeAbbr}</div>
              </div>
              {linescore.innings.map((inn: Linescore["innings"][number]) => (
                <div key={inn.num} className="flex flex-col items-center gap-px">
                  <div className="font-scoreboard text-[8px] text-slate-600 w-5 text-center">{inn.num}</div>
                  <div className="font-scoreboard text-[10px] text-slate-300 w-5 text-center num">{inn.away?.runs ?? 0}</div>
                  <div className="font-scoreboard text-[10px] text-slate-300 w-5 text-center num">{inn.home?.runs ?? (inn.home?.runs === 0 ? 0 : "-")}</div>
                </div>
              ))}
              {/* R/H/E */}
              <div className="flex flex-col items-center gap-px ml-1 border-l border-chalk pl-1">
                <div className="font-scoreboard text-[8px] text-slate-600 w-5 text-center">R</div>
                <div className="font-scoreboard text-[10px] text-chalk w-5 text-center font-bold num">{linescore.teams?.away?.runs ?? awayScore ?? 0}</div>
                <div className="font-scoreboard text-[10px] text-chalk w-5 text-center font-bold num">{linescore.teams?.home?.runs ?? homeScore ?? 0}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Click to expand hint */}
      <div className="mt-3 flex items-center justify-center gap-1 text-[9px] text-slate-600 font-scoreboard uppercase tracking-wide">
        <ChevronDown className="h-3 w-3" />
        Click for full play-by-play
      </div>
    </motion.button>

    {/* Expanded play-by-play modal */}
    <AnimatePresence>
      {expanded && (
        <PlayByPlayModal
          gamePk={gamePk}
          awayAbbr={awayAbbr}
          homeAbbr={homeAbbr}
          awayName={awayName}
          homeName={homeName}
          awayTeamId={awayTeamId}
          homeTeamId={homeTeamId}
          awayScore={awayScore}
          homeScore={homeScore}
          status={status}
          onClose={() => setExpanded(false)}
        />
      )}
    </AnimatePresence>
    </>
  );
}

/** Score display that animates counting up */
function AnimatedScoreDisplay({ value }: { value: number }) {
  const display = useAnimatedValue(value, 0, 0.6);
  return <>{display}</>;
}

