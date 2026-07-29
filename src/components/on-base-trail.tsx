"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { GameStatus, Linescore } from "@/lib/types";

interface OnBaseTrailProps {
  gamePk: number;
  awayTeamColor: string;
  homeTeamColor: string;
  isTopInning: boolean;
}

export function OnBaseTrail({ gamePk, awayTeamColor, homeTeamColor, isTopInning }: OnBaseTrailProps) {
  const { data } = useQuery<{
    linescore: Linescore | null;
    status: GameStatus | null;
  }>({
    queryKey: ["base-runners", gamePk],
    queryFn: async () => {
      const res = await fetch(`/api/game/${gamePk}`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    refetchInterval: 5_000,
    staleTime: 3_000,
  });

  const linescore = data?.linescore;
  const status = data?.status;
  const outs = linescore?.outs ?? 0;
  const balls = linescore?.balls ?? 0;
  const strikes = linescore?.strikes ?? 0;
  const inning = linescore?.currentInning ?? 0;
  const inningState = linescore?.inningState ?? "";

  // Base runner info from the offense field
  const offense = linescore?.offense ?? {};
  const onFirst = !!linescore?.defense?.first?.id;
  const onSecond = !!linescore?.defense?.second?.id;
  const onThird = !!linescore?.defense?.third?.id;

  // The batting team's color
  const battingColor = isTopInning ? awayTeamColor : homeTeamColor;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Base runner diamond */}
      <svg viewBox="0 0 80 70" className="w-16 h-14">
        {/* Diamond outline */}
        <polygon
          points="40,5 75,35 40,65 5,35"
          fill="rgba(248, 249, 250, 0.02)"
          stroke="rgba(248, 249, 250, 0.08)"
          strokeWidth="1"
        />

        {/* 2nd base (top) */}
        <BaseDiamond x={40} y={5} active={onSecond} color={battingColor} label="2B" />

        {/* 3rd base (left) */}
        <BaseDiamond x={5} y={35} active={onThird} color={battingColor} label="3B" />

        {/* 1st base (right) */}
        <BaseDiamond x={75} y={35} active={onFirst} color={battingColor} label="1B" />

        {/* Home plate (bottom) */}
        <polygon
          points="34,59 46,59 46,63 40,67 34,63"
          fill="rgba(248, 249, 250, 0.06)"
          stroke="rgba(248, 249, 250, 0.10)"
          strokeWidth="0.5"
        />

        {/* Direction indicator */}
        <text
          x={40}
          y={40}
          fill={isTopInning ? awayTeamColor : homeTeamColor}
          fontSize="10"
          fontFamily="monospace"
          textAnchor="middle"
          opacity="0.4"
        >
          {isTopInning ? "▲" : "▼"}
        </text>
      </svg>

      {/* Outs display */}
      <div className="flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              i < outs ? "bg-crimson" : "bg-slate-700"
            )}
          />
        ))}
        <span className="font-scoreboard ml-0.5 text-[8px] uppercase text-slate-600">{outs} OUT</span>
      </div>

      {/* Count */}
      <div className="font-scoreboard flex items-center gap-1 text-[10px]">
        <span className={cn("font-bold num", balls >= 1 ? "text-cobalt" : "text-slate-700")}>{balls}</span>
        <span className="text-slate-600">-</span>
        <span className={cn("font-bold num", strikes >= 1 ? "text-crimson" : "text-slate-700")}>{strikes}</span>
      </div>
    </div>
  );
}

function BaseDiamond({ x, y, active, color, label }: { x: number; y: number; active: boolean; color: string; label: string }) {
  return (
    <g>
      {/* Base square */}
      <rect
        x={x - 5}
        y={y - 5}
        width={10}
        height={10}
        fill={active ? color : "rgba(248, 249, 250, 0.04)"}
        stroke={active ? color : "rgba(248, 249, 250, 0.08)"}
        strokeWidth="1"
        transform={`rotate(45 ${x} ${y})`}
        opacity={active ? 0.9 : 0.5}
      />
      {active && (
        <motion.circle
          cx={x}
          cy={y}
          r={3}
          fill={color}
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </g>
  );
}
