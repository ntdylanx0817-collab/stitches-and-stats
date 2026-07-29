"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { getTeamColor } from "@/lib/team-colors";
import { PlayByPlayModal } from "@/components/play-by-play-modal";
import { cn } from "@/lib/utils";
import type { GameStatus } from "@/lib/types";

interface StickyMiniScoreboardProps {
  gamePk: number;
  awayAbbr: string;
  homeAbbr: string;
  awayName: string;
  homeName: string;
  awayTeamId: number;
  homeTeamId: number;
  awayScore: number;
  homeScore: number;
  inning: number;
  inningState: string;
  isLive: boolean;
  isFinal: boolean;
  outs: number;
  balls: number;
  strikes: number;
  status?: GameStatus | null;
}

export function StickyMiniScoreboard({
  gamePk,
  awayAbbr,
  homeAbbr,
  awayName,
  homeName,
  awayTeamId,
  homeTeamId,
  awayScore,
  homeScore,
  inning,
  inningState,
  isLive,
  isFinal,
  outs,
  balls,
  strikes,
  status,
}: StickyMiniScoreboardProps) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const awayColor = getTeamColor(awayTeamId);
  const homeColor = getTeamColor(homeTeamId);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling past 400px
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-14 left-0 right-0 z-30 px-4"
          >
            <div className="mx-auto max-w-[1600px]">
              <button
                onClick={() => setExpanded(true)}
                className="glass-strong w-full rounded-xl border border-chalk shadow-lg overflow-hidden text-left transition-all hover:border-warning-track/40 hover:shadow-warning-track/10"
                style={{
                  background: `linear-gradient(90deg, ${awayColor.primary}20, ${homeColor.primary}20)`,
                }}
                title="Click for full play-by-play"
              >
                <div className="flex items-center justify-between px-4 py-2">
                  {/* Away team */}
                  <div className="flex items-center gap-2">
                    <span
                      className="font-scoreboard text-sm font-bold uppercase"
                      style={{ color: awayColor.primary === "#000000" || awayColor.primary === "#27251F" ? "#f8f9fa" : awayColor.primary }}
                    >
                      {awayAbbr}
                    </span>
                    <span className="font-scoreboard text-xl font-black text-chalk num">{awayScore}</span>
                  </div>

                  {/* Center: status + click hint */}
                  <div className="flex items-center gap-3">
                    {isLive && (
                      <>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 animate-live-dot rounded-full bg-mint" />
                          <span className="font-scoreboard text-[10px] font-bold uppercase text-mint">
                            {inningState} {inning}
                          </span>
                        </span>
                        {/* Mini count */}
                        <span className="hidden sm:inline font-scoreboard text-[10px] text-slate-500 num">
                          {balls}-{strikes} · {outs}out
                        </span>
                      </>
                    )}
                    {isFinal && (
                      <span className="font-scoreboard text-[10px] font-bold uppercase text-slate-500">FINAL</span>
                    )}
                    {!isLive && !isFinal && (
                      <span className="font-scoreboard text-[10px] font-bold uppercase text-warning-track">PREVIEW</span>
                    )}
                    <span className="hidden md:flex items-center gap-0.5 rounded-md border border-chalk bg-midnight/40 px-1.5 py-0.5">
                      <ChevronDown className="h-2.5 w-2.5 text-warning-track" />
                      <span className="font-scoreboard text-[8px] uppercase tracking-wide text-slate-400">PBP</span>
                    </span>
                  </div>

                  {/* Home team */}
                  <div className="flex items-center gap-2">
                    <span className="font-scoreboard text-xl font-black text-chalk num">{homeScore}</span>
                    <span
                      className="font-scoreboard text-sm font-bold uppercase"
                      style={{ color: homeColor.primary === "#000000" || homeColor.primary === "#27251F" ? "#f8f9fa" : homeColor.primary }}
                    >
                      {homeAbbr}
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Play-by-play modal (shared with HeroScoreboard) */}
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
