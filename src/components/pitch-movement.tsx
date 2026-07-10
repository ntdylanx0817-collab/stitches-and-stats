"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { Wind } from "lucide-react";

interface PitchMixEntry {
  name: string;
  count: number;
  percentage: number;
  avgSpeed: number;
  avgSpin: number;
  avgPfxX: number;
  avgPfxZ: number;
  avgReleaseX: number;
  avgReleaseZ: number;
}

interface PitchMovementProps {
  data: PitchMixEntry[];
  pitchHand?: string;
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
  "Two-Seam Fastball": "#FF8E72",
};

function getPitchColor(name: string): string {
  return PITCH_COLORS[name] || "#94A3B8";
}

export function PitchMovement({ data, pitchHand = "R", className }: PitchMovementProps) {
  const topPitches = useMemo(() => data.filter((p) => p.count >= 10).slice(0, 6), [data]);

  if (topPitches.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="glass rounded-2xl p-4">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Wind className="h-4 w-4 text-warning-track" />
          Pitch Movement
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Movement chart */}
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500 font-scoreboard">Horizontal × Vertical Break</div>
            <svg viewBox="0 0 240 240" className="w-full max-w-[220px] mx-auto">
              {/* Axes */}
              <line x1="120" y1="10" x2="120" y2="230" stroke="rgba(248,249,250,0.08)" strokeWidth="1" />
              <line x1="10" y1="120" x2="230" y2="120" stroke="rgba(248,249,250,0.08)" strokeWidth="1" />

              {/* Axis labels */}
              <text x="125" y="18" fill="rgba(248,249,250,0.3)" fontSize="8" fontFamily="monospace">↑ VB (in)</text>
              <text x="180" y="135" fill="rgba(248,249,250,0.3)" fontSize="8" fontFamily="monospace">HB →</text>
              <text x="125" y="225" fill="rgba(248,249,250,0.2)" fontSize="7" fontFamily="monospace">↓</text>
              <text x="15" y="135" fill="rgba(248,249,250,0.2)" fontSize="7" fontFamily="monospace">←</text>

              {/* Center dot */}
              <circle cx="120" cy="120" r="2" fill="rgba(248,249,250,0.2)" />

              {/* Plot each pitch */}
              {topPitches.map((pitch, i) => {
                // pfx_x and pfx_z are in feet; convert to inches (×12) and scale to SVG
                // Positive pfx_x = arm-side (glove-side for LHP), positive pfx_z = up (rise/less drop)
                const scale = 8; // pixels per inch
                const hb = pitch.avgPfxX * 12; // inches
                const vb = pitch.avgPfxZ * 12; // inches
                // For RHP, mirror HB so arm-side is left
                const adjustedHb = pitchHand === "L" ? -hb : hb;
                const cx = 120 + adjustedHb * scale;
                const cy = 120 - vb * scale; // invert Y
                const color = getPitchColor(pitch.name);

                return (
                  <motion.g
                    key={pitch.name}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={8 + pitch.percentage / 10}
                      fill={color}
                      opacity={0.6}
                      stroke={color}
                      strokeWidth="1.5"
                    />
                    <text
                      x={cx}
                      y={cy + 3}
                      fill="white"
                      fontSize="7"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {pitch.name.split(" ").map((w) => w[0]).join("").slice(0, 3)}
                    </text>
                  </motion.g>
                );
              })}
            </svg>
          </div>

          {/* Movement table */}
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500 font-scoreboard">Break Details</div>
            <div className="space-y-1.5">
              {topPitches.map((pitch, i) => {
                const color = getPitchColor(pitch.name);
                return (
                  <motion.div
                    key={pitch.name}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-2 rounded-lg border border-chalk bg-midnight/40 p-1.5"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="flex-1 truncate text-[11px] text-slate-300">{pitch.name}</span>
                    <span className="font-scoreboard text-[10px] text-slate-500 num">
                      {pitch.avgSpeed > 0 ? `${pitch.avgSpeed.toFixed(0)}` : "—"}mph
                    </span>
                    <span className="font-scoreboard text-[10px] text-cobalt num">
                      {pitch.avgPfxX !== 0 ? `${(pitch.avgPfxX * 12).toFixed(1)}` : "—"}"| 
                    </span>
                    <span className="font-scoreboard text-[10px] text-mint num">
                      {pitch.avgPfxZ !== 0 ? `${(pitch.avgPfxZ * 12).toFixed(1)}` : "—"}"↑
                    </span>
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-2 text-[9px] text-slate-600">
              HB = horizontal break | VB = vertical break (induced)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
