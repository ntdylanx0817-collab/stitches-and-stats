"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { Zap } from "lucide-react";

interface PitchMixData {
  name: string;
  count: number;
  percentage: number;
  avgSpeed: number;
  avgSpin: number;
}

interface PitchArsenalProps {
  data: PitchMixData[];
  isPitcher: boolean;
  className?: string;
}

const PITCH_COLORS: Record<string, string> = {
  "4-Seam Fastball": "#FF6B6B",
  "Sinker": "#FF8E72",
  "Cutter": "#FFB547",
  "Slider": "#4DA3FF",
  "Sweeper": "#5DADEC",
  "Curveball": "#3DDBA0",
  "Knuckle Curve": "#7BE3B4",
  "Slow Curve": "#A78BFA",
  "Changeup": "#FFB547",
  "Split-Finger": "#C68BFF",
  "Splitter": "#C68BFF",
  "Slurve": "#5DADEC",
  "Forkball": "#94A3B8",
  "Knuckleball": "#94A3B8",
  "Two-Seam Fastball": "#FF8E72",
};

function getPitchColor(name: string): string {
  return PITCH_COLORS[name] || "#94A3B8";
}

export function PitchArsenal({ data, isPitcher, className }: PitchArsenalProps) {
  const topPitches = useMemo(() => {
    return data.filter((p) => p.count >= 5).slice(0, 8);
  }, [data]);

  const totalPitches = data.reduce((sum, p) => sum + p.count, 0);

  // Precompute arc data for the donut chart
  const arcs = useMemo(() => {
    return topPitches.reduce<{ cumulative: number; result: any[] }>(
      (acc, pitch, i) => {
        const startAngle = acc.cumulative;
        const sweepAngle = (pitch.percentage / 100) * 360;
        const endAngle = startAngle + sweepAngle;
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        const x1 = 100 + 70 * Math.cos(startRad);
        const y1 = 100 + 70 * Math.sin(startRad);
        const x2 = 100 + 70 * Math.cos(endRad);
        const y2 = 100 + 70 * Math.sin(endRad);
        const largeArc = sweepAngle > 180 ? 1 : 0;
        const color = getPitchColor(pitch.name);
        acc.result.push({
          key: pitch.name,
          d: `M ${x1},${y1} A 70 70 0 ${largeArc} 1 ${x2},${y2}`,
          color,
          index: i,
        });
        return { cumulative: endAngle, result: acc.result };
      },
      { cumulative: -90, result: [] }
    ).result;
  }, [topPitches]);

  if (topPitches.length === 0) {
    return (
      <div className={className}>
        <div className="glass rounded-2xl p-4">
          <h3 className="font-scoreboard mb-2 text-sm font-bold text-chalk uppercase tracking-wide">
            {isPitcher ? "Pitch Arsenal" : "Pitches Seen"}
          </h3>
          <p className="text-xs text-slate-500">No pitch data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="glass rounded-2xl p-4">
        <h3 className="font-scoreboard mb-1 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Zap className="h-4 w-4 text-warning-track" />
          {isPitcher ? "Pitch Arsenal" : "Pitches Seen"}
        </h3>
        <p className="mb-3 text-[11px] text-slate-500">
          {totalPitches.toLocaleString()} total pitches · {topPitches.length} pitch types
        </p>

        {/* Donut chart */}
        <div className="mb-4 flex justify-center">
          <svg viewBox="0 0 200 200" className="w-40 h-40">
            <defs>
              <filter id="pitchGlow">
                <feGaussianBlur stdDeviation="2" />
              </filter>
            </defs>
            {/* Background circle */}
            <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(248, 249, 250, 0.03)" strokeWidth="20" />

            {/* Draw arcs for each pitch type */}
            {arcs.map((arc) => (
              <motion.path
                key={arc.key}
                d={arc.d}
                fill="none"
                stroke={arc.color}
                strokeWidth="20"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: arc.index * 0.1, duration: 0.5 }}
                style={{ filter: `drop-shadow(0 0 4px ${arc.color}40)` }}
              />
            ))}

            {/* Center text */}
            <text x="100" y="95" textAnchor="middle" fill="rgba(248, 249, 250, 0.9)" fontSize="14" fontWeight="bold" fontFamily="monospace">
              {topPitches.length}
            </text>
            <text x="100" y="110" textAnchor="middle" fill="rgba(248, 249, 250, 0.4)" fontSize="8" fontFamily="monospace">
              TYPES
            </text>
          </svg>
        </div>

        {/* Pitch breakdown bars */}
        <div className="space-y-2.5">
          {topPitches.map((pitch, i) => {
            const color = getPitchColor(pitch.name);
            return (
              <div key={pitch.name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    {pitch.name}
                  </span>
                  <span className="font-scoreboard text-slate-400 num">
                    {pitch.percentage.toFixed(0)}% · {pitch.avgSpeed > 0 ? `${pitch.avgSpeed.toFixed(0)}mph` : "—"}
                    {pitch.avgSpin > 0 ? ` · ${pitch.avgSpin.toFixed(0)}rpm` : ""}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-midnight">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pitch.percentage}%` }}
                    transition={{ delay: i * 0.05 + 0.3, duration: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

