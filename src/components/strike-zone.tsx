"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import type { EnrichedPitch } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StrikeZoneProps {
  pitches: EnrichedPitch[];
  szTop?: number;
  szBot?: number;
  batterSide?: string; // L, R, S
  selectedPitchId?: string | null;
  onSelectPitch?: (pitch: EnrichedPitch) => void;
  className?: string;
  showLabels?: boolean;
  maxPitches?: number;
}

// Pitch-type → color map (Baseball Savant-inspired)
const PITCH_COLORS: Record<string, string> = {
  FF: "#FF6B6B", // 4-seam
  FT: "#FF8E72", // 2-seam
  FC: "#FFB547", // cutter
  SI: "#FF7A45", // sinker
  FS: "#C68BFF", // splitter
  SL: "#4DA3FF", // slider
  ST: "#5DADEC", // sweeper
  CU: "#3DDBA0", // curveball
  KC: "#7BE3B4", // knuckle curve
  CS: "#A78BFA", // slow curve
  SC: "#A78BFA", // screwball
  CH: "#FFB547", // changeup
  KN: "#94A3B8", // knuckle
  PO: "#94A3B8", // pitch out
  FO: "#94A3B8", // pitch out
};

function getPitchColor(pitchType?: string): string {
  if (!pitchType) return "#94A3B8";
  return PITCH_COLORS[pitchType.toUpperCase()] ?? "#94A3B8";
}

// Strike zone dimensions in SVG coordinates
const ZONE_LEFT = -8.5 / 12; // -0.708 ft (half of 17 inches)
const ZONE_RIGHT = 8.5 / 12;
const SVG_SIZE = 320;
const SVG_PADDING = 36;

/**
 * Convert pitch coordinates (in feet, pX, pZ) to SVG coordinates.
 * pX: -8.5/12 (left edge) to +8.5/12 (right edge)
 * pZ: 0 (ground) to ~4 ft (top of strike zone for tall batter)
 * We'll fit a 4ft tall × 4ft wide area centered on the zone.
 * Guards against non-number inputs (strings, objects, NaN) to prevent SVG crashes.
 */
function pitchToSVG(pX: unknown, pZ: unknown, szTop: number = 3.5, szBot: number = 1.5) {
  if (pX == null || pZ == null) return null;
  const x = typeof pX === "number" ? pX : Number(pX);
  const z = typeof pZ === "number" ? pZ : Number(pZ);
  if (isNaN(x) || isNaN(z)) return null;
  // Map pX (-2.5..2.5 ft) to SVG x
  const xRange = 4.0; // 4 ft wide visible area
  const xScale = (SVG_SIZE - SVG_PADDING * 2) / xRange;
  const svgX = SVG_PADDING + ((x + xRange / 2) / xRange) * (SVG_SIZE - SVG_PADDING * 2);

  // Map pZ (0..5 ft) to SVG y (inverted)
  const zMax = 5.0;
  const zScale = (SVG_SIZE - SVG_PADDING * 2) / zMax;
  const svgY = SVG_SIZE - SVG_PADDING - z * zScale;
  return { x: svgX, y: svgY };
}

function zoneLineToSVG(szTop: number, szBot: number) {
  return {
    topY: pitchToSVG(0, szTop, szTop, szBot)?.y ?? 0,
    botY: pitchToSVG(0, szBot, szTop, szBot)?.y ?? 0,
    leftX: pitchToSVG(ZONE_LEFT, 0)?.x ?? 0,
    rightX: pitchToSVG(ZONE_RIGHT, 0)?.x ?? 0,
  };
}

export function StrikeZone({
  pitches,
  szTop = 3.5,
  szBot = 1.5,
  batterSide,
  selectedPitchId,
  onSelectPitch,
  className,
  showLabels = true,
  maxPitches = 50,
}: StrikeZoneProps) {
  // Ensure szTop/szBot are valid numbers (savant sometimes returns strings)
  const safeSzTop = typeof szTop === "number" && !isNaN(szTop) ? szTop : 3.5;
  const safeSzBot = typeof szBot === "number" && !isNaN(szBot) ? szBot : 1.5;
  const recentPitches = useMemo(() => pitches.slice(-maxPitches), [pitches, maxPitches]);

  const zone = zoneLineToSVG(safeSzTop, safeSzBot);
  const zoneW = zone.rightX - zone.leftX;
  const zoneH = zone.topY - zone.botY;

  // Group pitches into the 9 standard sub-zones for cell coloring
  const zone3x3 = useMemo(() => {
    const cells: Array<{ zone: number; pitches: EnrichedPitch[] }> = [];
    const colW = zoneW / 3;
    const rowH = zoneH / 3;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const zoneNum = row * 3 + col + 1;
        const x0 = zone.leftX + col * colW;
        const y0 = zone.topY + row * rowH; // top of cell
        const y1 = y0 + rowH;
        const x1 = x0 + colW;
        const cellPitches = recentPitches.filter((p) => {
          if (p.pX == null || p.pZ == null) return false;
          const sp = pitchToSVG(p.pX, p.pZ, szTop, szBot);
          if (!sp) return false;
          return sp.x >= x0 && sp.x < x1 && sp.y >= y0 && sp.y < y1;
        });
        cells.push({ zone: zoneNum, pitches: cellPitches });
      }
    }
    return cells;
  }, [recentPitches, zoneW, zoneH, zone.leftX, zone.topY, szTop, szBot]);

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <svg
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="w-full max-w-[340px] h-auto"
        role="img"
        aria-label="Strike zone pitch plot"
      >
        <defs>
          <radialGradient id="zoneGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(77,163,255,0.18)" />
            <stop offset="100%" stopColor="rgba(77,163,255,0)" />
          </radialGradient>
          <linearGradient id="zoneBg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(11,15,25,0.5)" />
            <stop offset="100%" stopColor="rgba(22,27,38,0.5)" />
          </linearGradient>
          <filter id="pitchGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer field area */}
        <rect
          x={SVG_PADDING}
          y={SVG_PADDING}
          width={SVG_SIZE - SVG_PADDING * 2}
          height={SVG_SIZE - SVG_PADDING * 2}
          fill="url(#zoneBg)"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
          rx="8"
        />

        {/* Batter silhouette — left/right based on batter side */}
        {batterSide === "L" && (
          <g opacity="0.25" fill="rgba(255,255,255,0.4)">
            <rect x={zone.leftX - 28} y={zone.botY - 4} width="10" height={zoneH + 12} rx="3" />
            <circle cx={zone.leftX - 23} cy={zone.botY - 8} r="5" />
          </g>
        )}
        {batterSide === "R" && (
          <g opacity="0.25" fill="rgba(255,255,255,0.4)">
            <rect x={zone.rightX + 18} y={zone.botY - 4} width="10" height={zoneH + 12} rx="3" />
            <circle cx={zone.rightX + 23} cy={zone.botY - 8} r="5" />
          </g>
        )}
        {!batterSide && (
          <g opacity="0.15" fill="rgba(255,255,255,0.4)">
            <rect x={zone.rightX + 18} y={zone.botY - 4} width="10" height={zoneH + 12} rx="3" />
            <circle cx={zone.rightX + 23} cy={zone.botY - 8} r="5" />
          </g>
        )}

        {/* Home plate */}
        <polygon
          points={`${SVG_SIZE / 2},${SVG_SIZE - SVG_PADDING - 8} ${SVG_SIZE / 2 - 14},${SVG_SIZE - SVG_PADDING - 8} ${SVG_SIZE / 2 - 14},${SVG_SIZE - SVG_PADDING - 24} ${SVG_SIZE / 2},${SVG_SIZE - SVG_PADDING - 32} ${SVG_SIZE / 2 + 14},${SVG_SIZE - SVG_PADDING - 24} ${SVG_SIZE / 2 + 14},${SVG_SIZE - SVG_PADDING - 8}`}
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />

        {/* Strike zone rectangle */}
        <rect
          x={zone.leftX}
          y={zone.topY}
          width={zoneW}
          height={zoneH}
          fill="url(#zoneGlow)"
          stroke="rgba(77,163,255,0.5)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          rx="2"
        />

        {/* 3x3 sub-zone grid lines */}
        {[1, 2].map((i) => (
          <line
            key={`v${i}`}
            x1={zone.leftX + (zoneW / 3) * i}
            y1={zone.topY}
            x2={zone.leftX + (zoneW / 3) * i}
            y2={zone.botY}
            stroke="rgba(77,163,255,0.15)"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
        ))}
        {[1, 2].map((i) => (
          <line
            key={`h${i}`}
            x1={zone.leftX}
            y1={zone.topY + (zoneH / 3) * i}
            x2={zone.rightX}
            y2={zone.topY + (zoneH / 3) * i}
            stroke="rgba(77,163,255,0.15)"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
        ))}

        {/* Pitch dots */}
        <AnimatePresence>
          {recentPitches.map((p, idx) => {
            const pos = pitchToSVG(p.pX, p.pZ, szTop, szBot);
            if (!pos) return null;
            const color = getPitchColor(p.pitchType);
            const isWhiff = p.description?.toLowerCase().includes("swinging") || p.call === "S";
            const isBall = p.isBall || p.call === "B";
            const isCalledStrike = p.call === "C";
            const isSelected = selectedPitchId === `${p.atBatIndex}-${p.pitchNumber}`;
            const isLatest = idx === recentPitches.length - 1;
            const size = isLatest ? 9 : 7;

            return (
              <motion.g
                key={`${p.atBatIndex}-${p.pitchNumber}-${idx}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: "spring", stiffness: 360, damping: 22, delay: isLatest ? 0 : Math.min(idx * 0.01, 0.3) }}
                onClick={() => onSelectPitch?.(p)}
                style={{ cursor: "pointer" }}
              >
                {/* Glow ring on latest */}
                {isLatest && (
                  <motion.circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size + 6}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    initial={{ opacity: 0.6, scale: 0.5 }}
                    animate={{ opacity: 0, scale: 1.6 }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size + 4}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    opacity="0.9"
                  />
                )}
                {/* Main dot */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={size}
                  fill={color}
                  filter={isLatest || isSelected ? "url(#pitchGlow)" : undefined}
                  opacity={isLatest ? 1 : Math.max(0.35, 0.5 + idx / recentPitches.length * 0.5)}
                  stroke={isBall ? color : "rgba(255,255,255,0.5)"}
                  strokeWidth={isBall ? 0 : 1.5}
                  strokeDasharray={isWhiff ? "2 2" : undefined}
                />
                {/* Whiff X */}
                {isWhiff && (
                  <g stroke="#FFFFFF" strokeWidth="1.5" opacity="0.9">
                    <line x1={pos.x - 3} y1={pos.y - 3} x2={pos.x + 3} y2={pos.y + 3} />
                    <line x1={pos.x - 3} y1={pos.y + 3} x2={pos.x + 3} y2={pos.y - 3} />
                  </g>
                )}
                {/* Called strike outline */}
                {isCalledStrike && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size - 2}
                    fill="none"
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth="1.5"
                  />
                )}
                {/* Pitch number for the latest few */}
                {idx >= recentPitches.length - 5 && (
                  <text
                    x={pos.x + size + 2}
                    y={pos.y - size - 2}
                    fill="rgba(255,255,255,0.7)"
                    fontSize="9"
                    fontFamily="var(--font-geist-mono)"
                  >
                    {p.pitchNumber}
                  </text>
                )}
              </motion.g>
            );
          })}
        </AnimatePresence>

        {/* Labels */}
        {showLabels && (
          <>
            <text x={SVG_PADDING} y={SVG_PADDING - 8} fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="var(--font-geist-mono)">
              PLATE VIEW
            </text>
            <text x={SVG_SIZE - SVG_PADDING} y={SVG_PADDING - 8} fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="var(--font-geist-mono)" textAnchor="end">
              {batterSide === "L" ? "LHB" : batterSide === "R" ? "RHB" : "Batter"}
            </text>
            <text x={zone.leftX - 4} y={zone.topY - 4} fill="rgba(77,163,255,0.7)" fontSize="9" fontFamily="monospace" textAnchor="start">
              {safeSzTop.toFixed(2)}ft
            </text>
            <text x={zone.leftX - 4} y={zone.botY + 11} fill="rgba(77,163,255,0.7)" fontSize="9" fontFamily="monospace" textAnchor="start">
              {safeSzBot.toFixed(2)}ft
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

export { PITCH_COLORS, getPitchColor };
