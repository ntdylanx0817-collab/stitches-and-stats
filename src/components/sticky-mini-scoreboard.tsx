"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTeamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";

interface StickyMiniScoreboardProps {
  awayAbbr: string;
  homeAbbr: string;
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
}

export function StickyMiniScoreboard({
  awayAbbr, homeAbbr, awayTeamId, homeTeamId,
  awayScore, homeScore, inning, inningState, isLive, isFinal,
  outs, balls, strikes,
}: StickyMiniScoreboardProps) {
  const [visible, setVisible] = useState(false);
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
            <div
              className="glass-strong rounded-xl border border-chalk shadow-lg overflow-hidden"
              style={{
                background: `linear-gradient(90deg, ${awayColor.primary}20, ${homeColor.primary}20)`,
              }}
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

                {/* Center: status */}
                <div className="flex items-center gap-3">
                  {isLive && (
                    <>
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-live-dot rounded-full bg-mint" />
                        <span className="font-scoreboard text-[10px] font-bold uppercase text-mint">{inningState} {inning}</span>
                      </span>
                      {/* Mini count */}
                      <span className="font-scoreboard text-[10px] text-slate-500 num">
                        {balls}-{strikes} · {outs}out
                      </span>
                    </>
                  )}
                  {isFinal && (
                    <span className="font-scoreboard text-[10px] font-bold uppercase text-slate-500">FINAL</span>
                  )}
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
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
