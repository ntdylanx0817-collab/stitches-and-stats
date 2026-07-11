"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/loading-states";
import { cn } from "@/lib/utils";

interface WinProbPoint {
  playIndex: number;
  inning: number;
  halfInning: "top" | "bottom";
  homeScore: number;
  awayScore: number;
  homeWinProb: number;
  event: string;
  isScoringPlay: boolean;
}

interface WinProbData {
  gamePk: number;
  awayTeam: string;
  homeTeam: string;
  points: WinProbPoint[];
  currentHomeWinProb: number;
  currentAwayWinProb: number;
  maxHomeWinProb: number;
  minHomeWinProb: number;
  largestShift: { playIndex: number; shift: number; event: string };
}

const CHART_W = 800;
const CHART_H = 200;
const CHART_PAD = 40;

export function WinProbabilityChart({ gamePk }: { gamePk: number }) {
  const { data, isLoading, error } = useQuery<WinProbData>({
    queryKey: ["win-prob", gamePk],
    queryFn: async () => {
      const res = await fetch(`/api/win-probability?gamePk=${gamePk}`);
      if (!res.ok) throw new Error("win prob fetch failed");
      return res.json();
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="card-broadcast rounded-2xl p-4">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <TrendingUp className="h-4 w-4 text-warning-track" />
          Win Probability
        </h3>
        <div className="flex h-[200px] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-warning-track" />
        </div>
      </div>
    );
  }

  if (error || !data || data.points.length === 0) {
    return null;
  }

  const points = data.points;
  const totalPlays = points.length;
  if (totalPlays < 2) return null;

  // Build SVG path for the win probability line
  const chartW = Math.min(CHART_W, totalPlays * 4 + CHART_PAD * 2);
  const usableW = chartW - CHART_PAD * 2;
  const usableH = CHART_H - CHART_PAD;

  // Map play index to x, win prob (0-100) to y
  const xFor = (i: number) => CHART_PAD + (i / Math.max(totalPlays - 1, 1)) * usableW;
  const yFor = (wp: number) => CHART_PAD + (1 - wp / 100) * usableH;

  // Build the line path
  let pathD = "";
  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.homeWinProb);
    pathD += i === 0 ? `M ${x},${y}` : ` L ${x},${y}`;
  });

  // Build the area fill path (below the line, split at 50%)
  let areaD = `M ${xFor(0)},${yFor(50)}`;
  points.forEach((p, i) => {
    areaD += ` L ${xFor(i)},${yFor(p.homeWinProb)}`;
  });
  areaD += ` L ${xFor(totalPlays - 1)},${yFor(50)} Z`;

  // Inning markers (every full inning)
  const inningMarkers: Array<{ x: number; inning: number }> = [];
  let lastInning = 0;
  points.forEach((p, i) => {
    if (p.inning !== lastInning && p.halfInning === "top") {
      inningMarkers.push({ x: xFor(i), inning: p.inning });
      lastInning = p.inning;
    }
  });

  // Scoring play markers
  const scoringPlays = points.filter((p) => p.isScoringPlay);

  const currentWP = data.currentHomeWinProb;
  const homeLeading = currentWP > 50;

  return (
    <div className="card-broadcast rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-scoreboard flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <TrendingUp className="h-4 w-4 text-warning-track" />
          Win Probability
        </h3>
        <div className="flex items-center gap-3 text-[10px] font-scoreboard uppercase tracking-wide">
          <span className={cn("flex items-center gap-1", homeLeading ? "text-mint" : "text-slate-500")}>
            <span className="h-2 w-2 rounded-full bg-mint" />
            {data.homeTeam.split(" ").slice(-1)[0]} {currentWP.toFixed(0)}%
          </span>
          <span className={cn("flex items-center gap-1", !homeLeading ? "text-crimson" : "text-slate-500")}>
            <span className="h-2 w-2 rounded-full bg-crimson" />
            {data.awayTeam.split(" ").slice(-1)[0]} {(100 - currentWP).toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <svg
          viewBox={`0 0 ${chartW} ${CHART_H}`}
          className="w-full min-w-[500px] h-auto"
          style={{ minWidth: 400 }}
        >
          <defs>
            <linearGradient id="homeWPGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(61, 219, 160, 0.25)" />
              <stop offset="100%" stopColor="rgba(61, 219, 160, 0.02)" />
            </linearGradient>
            <linearGradient id="awayWPGrad" x1="0" x2="0" y1="1" y2="0">
              <stop offset="0%" stopColor="rgba(255, 59, 92, 0.25)" />
              <stop offset="100%" stopColor="rgba(255, 59, 92, 0.02)" />
            </linearGradient>
          </defs>

          {/* 50% line */}
          <line
            x1={CHART_PAD}
            y1={yFor(50)}
            x2={chartW - CHART_PAD}
            y2={yFor(50)}
            stroke="rgba(248, 249, 250, 0.08)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text x={CHART_PAD - 5} y={yFor(50) + 3} fill="rgba(248, 249, 250, 0.2)" fontSize="8" fontFamily="monospace" textAnchor="end">
            50%
          </text>

          {/* Inning markers */}
          {inningMarkers.map((m, i) => (
            <g key={`inning-${i}`}>
              <line
                x1={m.x}
                y1={CHART_PAD}
                x2={m.x}
                y2={CHART_H - CHART_PAD / 2}
                stroke="rgba(248, 249, 250, 0.04)"
                strokeWidth="1"
              />
              <text
                x={m.x}
                y={CHART_H - CHART_PAD / 2 + 12}
                fill="rgba(248, 249, 250, 0.25)"
                fontSize="8"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {m.inning}
              </text>
            </g>
          ))}

          {/* Area fill - home team (above 50% = green) */}
          <path
            d={`M ${xFor(0)},${yFor(50)} ${points.map((p, i) => `L ${xFor(i)},${yFor(Math.max(p.homeWinProb, 50))}`).join(" ")} L ${xFor(totalPlays - 1)},${yFor(50)} Z`}
            fill="url(#homeWPGrad)"
          />
          {/* Area fill - away team (below 50% = red) */}
          <path
            d={`M ${xFor(0)},${yFor(50)} ${points.map((p, i) => `L ${xFor(i)},${yFor(Math.min(p.homeWinProb, 50))}`).join(" ")} L ${xFor(totalPlays - 1)},${yFor(50)} Z`}
            fill="url(#awayWPGrad)"
          />

          {/* Win probability line */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="rgba(248, 249, 250, 0.6)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />

          {/* Scoring play markers */}
          {scoringPlays.map((p, i) => (
            <motion.circle
              key={`scoring-${i}`}
              cx={xFor(p.playIndex)}
              cy={yFor(p.homeWinProb)}
              r="3"
              fill={p.homeWinProb > 50 ? "#3DDBA0" : "#FF3B5C"}
              stroke="rgba(248, 249, 250, 0.3)"
              strokeWidth="1"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + i * 0.05 }}
            >
              <title>{`${p.awayScore}-${p.homeScore} (${p.event})`}</title>
            </motion.circle>
          ))}

          {/* Current position dot */}
          <motion.circle
            cx={xFor(totalPlays - 1)}
            cy={yFor(currentWP)}
            r="4"
            fill={homeLeading ? "#3DDBA0" : "#FF3B5C"}
            className="animate-live-dot"
          />

          {/* Labels */}
          <text x={CHART_PAD - 5} y={CHART_PAD + 5} fill="rgba(61, 219, 160, 0.4)" fontSize="8" fontFamily="monospace" textAnchor="end">
            100%
          </text>
          <text x={CHART_PAD - 5} y={CHART_H - CHART_PAD} fill="rgba(255, 59, 92, 0.4)" fontSize="8" fontFamily="monospace" textAnchor="end">
            0%
          </text>
          <text x={CHART_PAD} y={CHART_H - 4} fill="rgba(248, 249, 250, 0.15)" fontSize="7" fontFamily="monospace">
            INNING →
          </text>
        </svg>
      </div>

      {/* Stats below chart */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-chalk bg-midnight/40 p-1.5">
          <div className="font-scoreboard text-[8px] uppercase tracking-wide text-slate-500">Peak {data.homeTeam.split(" ").slice(-1)[0]}</div>
          <div className="font-scoreboard text-sm font-bold text-mint num">{data.maxHomeWinProb.toFixed(0)}%</div>
        </div>
        <div className="rounded-lg border border-chalk bg-midnight/40 p-1.5">
          <div className="font-scoreboard text-[8px] uppercase tracking-wide text-slate-500">Peak {data.awayTeam.split(" ").slice(-1)[0]}</div>
          <div className="font-scoreboard text-sm font-bold text-crimson num">{(100 - data.minHomeWinProb).toFixed(0)}%</div>
        </div>
        <div className="rounded-lg border border-chalk bg-midnight/40 p-1.5">
          <div className="font-scoreboard text-[8px] uppercase tracking-wide text-slate-500">Biggest Shift</div>
          <div className="font-scoreboard text-sm font-bold text-warning-track num">{data.largestShift.shift.toFixed(0)}%</div>
        </div>
      </div>
    </div>
  );
}
