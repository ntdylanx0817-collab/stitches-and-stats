"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface SprayChartProps {
  data: Array<{
    x: number;
    y: number;
    launchSpeed: number | null;
    launchAngle: number | null;
    distance: number | null;
    event: string;
    isBarrel: boolean;
  }>;
  playerHand: "L" | "R" | "S";
  className?: string;
}

const FIELD_W = 400;
const FIELD_H = 400;
// Baseball Savant hc_x and hc_y are in a coordinate system where:
// home plate is at ~(125, 200)
// The field extends from x=0 (left field line) to x=250 (right field line)
// y=0 is deep in the outfield, y=200+ is near home plate

function savantToSVG(x: number, y: number) {
  // Translate so home plate is at bottom center
  const tx = x - 125; // center horizontally (125 is home plate x)
  const ty = 200 - y; // flip Y so home plate is at bottom
  // Scale to fit our SVG
  const scale = 1.5;
  const svgX = FIELD_W / 2 + tx * scale;
  const svgY = FIELD_H - 80 - ty * scale;
  return { x: svgX, y: svgY };
}

function getEventColor(event: string): string {
  switch (event) {
    case "home_run": return "#FF3B5C";
    case "triple": return "#A78BFA";
    case "double": return "#4DA3FF";
    case "single": return "#3DDBA0";
    case "field_out":
    case "grounded_into_double_play":
    case "force_out":
    case "fielders_choice":
    case "fielders_choice_out":
      return "#64748B";
    case "sac_fly":
      return "#FFB547";
    case "field_error":
      return "#FF8E72";
    default:
      return "#94A3B8";
  }
}

function getEventLabel(event: string): string {
  switch (event) {
    case "home_run": return "HR";
    case "triple": return "3B";
    case "double": return "2B";
    case "single": return "1B";
    case "field_out": return "OUT";
    case "grounded_into_double_play": return "GDP";
    case "force_out": return "FO";
    case "fielders_choice": return "FC";
    case "sac_fly": return "SF";
    case "field_error": return "E";
    default: return event.slice(0, 3).toUpperCase();
  }
}

export function SprayChart({ data, playerHand, className }: SprayChartProps) {
  const filtered = useMemo(() => {
    return data.filter((d) => d.x > 0 && d.y > 0 && d.x < 250 && d.y < 250);
  }, [data]);

  // Count events
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of filtered) {
      counts[d.event] = (counts[d.event] || 0) + 1;
    }
    return counts;
  }, [filtered]);

  const totalHits = (stats.single || 0) + (stats.double || 0) + (stats.triple || 0) + (stats.home_run || 0);
  const totalOuts = (stats.field_out || 0) + (stats.grounded_into_double_play || 0) + (stats.force_out || 0) + (stats.fielders_choice || 0) + (stats.fielders_choice_out || 0);
  const totalHR = stats.home_run || 0;
  const barrels = filtered.filter((d) => d.isBarrel).length;

  return (
    <div className={className}>
      <div className="glass rounded-2xl p-4">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Target className="h-4 w-4 text-warning-track" />
          Spray Chart
        </h3>
        <p className="mb-3 text-[11px] text-slate-500">
          {filtered.length} balls in play · {totalHits} hits · {totalHR} HR · {barrels} barrels
        </p>

        <div className="flex justify-center">
          <svg viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} className="w-full max-w-[360px] h-auto">
            <defs>
              <radialGradient id="fieldGrad" cx="50%" cy="80%" r="70%">
                <stop offset="0%" stopColor="rgba(61, 219, 160, 0.08)" />
                <stop offset="100%" stopColor="rgba(5, 10, 20, 0)" />
              </radialGradient>
              <filter id="hitGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Field outline - outfield arc */}
            <path
              d={`M ${FIELD_W / 2 - 100},${FIELD_H - 40} A 180 180 0 0 1 ${FIELD_W / 2 + 100},${FIELD_H - 40} L ${FIELD_W / 2 + 60},${FIELD_H - 40} L ${FIELD_W / 2},${FIELD_H - 10} L ${FIELD_W / 2 - 60},${FIELD_H - 40} Z`}
              fill="url(#fieldGrad)"
              stroke="rgba(61, 219, 160, 0.15)"
              strokeWidth="1"
            />

            {/* Foul lines */}
            <line
              x1={FIELD_W / 2 - 100}
              y1={FIELD_H - 40}
              x2={FIELD_W / 2 - 180}
              y2={60}
              stroke="rgba(248, 249, 250, 0.06)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <line
              x1={FIELD_W / 2 + 100}
              y1={FIELD_H - 40}
              x2={FIELD_W / 2 + 180}
              y2={60}
              stroke="rgba(248, 249, 250, 0.06)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* Infield */}
            <path
              d={`M ${FIELD_W / 2 - 60},${FIELD_H - 50} L ${FIELD_W / 2 - 30},${FIELD_H - 130} L ${FIELD_W / 2 + 30},${FIELD_H - 130} L ${FIELD_W / 2 + 60},${FIELD_H - 50} Z`}
              fill="rgba(248, 249, 250, 0.015)"
              stroke="rgba(248, 249, 250, 0.05)"
              strokeWidth="1"
            />

            {/* Home plate */}
            <polygon
              points={`${FIELD_W / 2},${FIELD_H - 15} ${FIELD_W / 2 - 8},${FIELD_H - 15} ${FIELD_W / 2 - 8},${FIELD_H - 25} ${FIELD_W / 2},${FIELD_H - 30} ${FIELD_W / 2 + 8},${FIELD_H - 25} ${FIELD_W / 2 + 8},${FIELD_H - 15}`}
              fill="rgba(248, 249, 250, 0.05)"
              stroke="rgba(248, 249, 250, 0.10)"
              strokeWidth="1"
            />

            {/* Hit location dots */}
            {filtered.map((d, i) => {
              const pos = savantToSVG(d.x, d.y);
              const color = getEventColor(d.event);
              const size = d.isBarrel ? 6 : d.event === "home_run" ? 7 : 4;
              return (
                <motion.circle
                  key={i}
                  cx={pos.x}
                  cy={pos.y}
                  r={size}
                  fill={color}
                  opacity={d.isBarrel ? 1 : 0.7}
                  filter={d.isBarrel || d.event === "home_run" ? "url(#hitGlow)" : undefined}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: d.isBarrel ? 1 : 0.7 }}
                  transition={{ delay: Math.min(i * 0.005, 0.5), type: "spring", stiffness: 300 }}
                  style={{ cursor: "pointer" }}
                >
                  <title>{`${getEventLabel(d.event)}: ${d.launchSpeed?.toFixed(1) || "—"} mph, ${d.launchAngle?.toFixed(0) || "—"}°, ${d.distance?.toFixed(0) || "—"} ft`}</title>
                </motion.circle>
              );
            })}

            {/* Labels */}
            <text x={20} y={20} fill="rgba(248, 249, 250, 0.3)" fontSize="9" fontFamily="monospace">
              {playerHand === "L" ? "RF ←" : "← LF"}
            </text>
            <text x={FIELD_W - 60} y={20} fill="rgba(248, 249, 250, 0.3)" fontSize="9" fontFamily="monospace">
              {playerHand === "L" ? "→ LF" : "RF →"}
            </text>
            <text x={FIELD_W / 2 - 15} y={FIELD_H - 5} fill="rgba(248, 249, 250, 0.3)" fontSize="8" fontFamily="monospace">
              HOME
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-[10px]">
          {[
            { label: "HR", color: "#FF3B5C" },
            { label: "3B", color: "#A78BFA" },
            { label: "2B", color: "#4DA3FF" },
            { label: "1B", color: "#3DDBA0" },
            { label: "OUT", color: "#64748B" },
            { label: "SF", color: "#FFB547" },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-500">{item.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

import { Target } from "lucide-react";
