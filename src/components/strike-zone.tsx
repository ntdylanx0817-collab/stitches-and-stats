"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
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
  /** Show the pitch-sequence number on every dot instead of just the latest few. */
  numberAll?: boolean;
}

// Pitch-type → color map (Baseball Savant-inspired)
/**
 * Pitch-type colours, from the Okabe-Ito qualitative palette — chosen because
 * it is designed to stay separable under dichromatic vision — with
 * lightness-shifted siblings for the rarer pitches, since lightness is the
 * channel dichromats keep.
 *
 * This replaced a palette that gave cutter and changeup the same hex, and slow
 * curve and screwball another, so two pairs were indistinguishable for
 * everyone regardless of colour vision.
 *
 * Thirteen categories still cannot all be told apart by hue under dichromacy —
 * measuring this palette leaves 14 pairs under a just-noticeable difference,
 * down from 23 — which is why the plot carries a labelled legend rather than
 * relying on colour alone.
 */
const PITCH_COLORS: Record<string, string> = {
  FF: "#D55E00", // 4-seam — vermillion
  SI: "#E69F00", // sinker — orange
  FT: "#F5B75B", // 2-seam — light orange
  FC: "#F0E442", // cutter — yellow
  CH: "#CC79A7", // changeup — reddish purple
  FS: "#9B5DE5", // splitter — violet
  SL: "#56B4E9", // slider — sky blue
  ST: "#0072B2", // sweeper — blue
  CU: "#009E73", // curveball — bluish green
  KC: "#5FE3B8", // knuckle curve — light green
  CS: "#7D6FD1", // slow curve — muted violet
  SC: "#B98CD9", // screwball — light violet
  KN: "#94A3B8", // knuckle — slate
  PO: "#94A3B8", // pitch out
  FO: "#94A3B8", // pitch out
};

function getPitchColor(pitchType?: string): string {
  if (!pitchType) return "#94A3B8";
  return PITCH_COLORS[pitchType.toUpperCase()] ?? "#94A3B8";
}

/** Short result label for the hover tooltip. Kept local (not imported from
 * pitch-log-entry) since that module imports getPitchColor from here. */
function tooltipResultLabel(p: EnrichedPitch): string {
  if (p.isInPlay) return p.playResult || "In Play";
  const callCode = typeof p.call === "string" ? p.call : undefined;
  if (callCode === "B" || p.isBall) return "Ball";
  if (callCode === "C") return "Called Strike";
  if (callCode === "S") return "Swinging Strike";
  if (callCode === "F") return "Foul";
  if (callCode === "H") return "HBP";
  return callCode || (p.isStrike ? "Strike" : "—");
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
function pitchToSVG(pX: unknown, pZ: unknown, _szTop: number = 3.5, _szBot: number = 1.5) {
  if (pX == null || pZ == null) return null;
  const x = typeof pX === "number" ? pX : Number(pX);
  const z = typeof pZ === "number" ? pZ : Number(pZ);
  if (isNaN(x) || isNaN(z)) return null;
  // Map pX (-2.5..2.5 ft) to SVG x
  const xRange = 4.0; // 4 ft wide visible area
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
  numberAll = false,
}: StrikeZoneProps) {
  // Ensure szTop/szBot are valid numbers (savant sometimes returns strings)
  const safeSzTop = typeof szTop === "number" && !isNaN(szTop) ? szTop : 3.5;
  const safeSzBot = typeof szBot === "number" && !isNaN(szBot) ? szBot : 1.5;
  const recentPitches = useMemo(() => pitches.slice(-maxPitches), [pitches, maxPitches]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Only the types actually plotted, in descending frequency, so the legend
  // stays short and describes this at-bat rather than the whole rulebook.
  const legend = useMemo(() => {
    const seen = new Map<string, { label: string; color: string; count: number }>();
    for (const p of recentPitches) {
      const code = p.pitchType?.toUpperCase();
      if (!code) continue;
      const entry = seen.get(code);
      if (entry) entry.count++;
      else seen.set(code, { label: p.pitchName ?? code, color: getPitchColor(code), count: 1 });
    }
    return [...seen.values()].sort((a, b) => b.count - a.count);
  }, [recentPitches]);

  const zone = zoneLineToSVG(safeSzTop, safeSzBot);
  const zoneW = zone.rightX - zone.leftX;
  // SVG y grows downward, so the zone's top edge has the *smaller* y. Taking
  // topY - botY here made every height negative, which silently dropped the
  // zone rectangle and the batter silhouette (a negative height is invalid)
  // and threw the horizontal grid lines above the zone instead of inside it.
  const zoneH = zone.botY - zone.topY;

  // Group pitches into the 9 standard sub-zones for cell coloring

  return (
    // The width cap lives here rather than on the <svg> for two reasons: the
    // hover tooltip below is positioned in percentages of this box, so it only
    // lines up with the dots when the box is exactly as wide as the plot; and
    // `cn` merges Tailwind classes, letting a caller widen the plot by passing
    // its own max-w (the Live At-Bat tab does).
    <div className={cn("relative mx-auto flex w-full max-w-[340px] flex-col items-center", className)}>
      <svg
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="h-auto w-full"
        role="img"
        aria-label="Strike zone pitch plot"
      >
        <defs>
          <radialGradient id="zoneGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(230, 126, 34, 0.12)" />
            <stop offset="100%" stopColor="rgba(230, 126, 34, 0)" />
          </radialGradient>
          <linearGradient id="zoneBg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(5, 10, 20, 0.6)" />
            <stop offset="100%" stopColor="rgba(10, 19, 34, 0.6)" />
          </linearGradient>
          <filter id="pitchGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Corner glow gradient for Tactical Zone Visualizer */}
          <radialGradient id="cornerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(230, 126, 34, 0.5)" />
            <stop offset="100%" stopColor="rgba(230, 126, 34, 0)" />
          </radialGradient>
        </defs>

        {/* Outer field area */}
        <rect
          x={SVG_PADDING}
          y={SVG_PADDING}
          width={SVG_SIZE - SVG_PADDING * 2}
          height={SVG_SIZE - SVG_PADDING * 2}
          fill="url(#zoneBg)"
          stroke="rgba(248, 249, 250, 0.08)"
          strokeWidth="1"
          rx="8"
        />

        {/* Batter silhouette — left/right based on batter side */}
        {batterSide === "L" && (
          <g opacity="0.25" fill="rgba(248, 249, 250, 0.4)">
            <rect x={zone.leftX - 28} y={zone.topY - 4} width="10" height={zoneH + 12} rx="3" />
            <circle cx={zone.leftX - 23} cy={zone.topY - 11} r="5" />
          </g>
        )}
        {batterSide === "R" && (
          <g opacity="0.25" fill="rgba(248, 249, 250, 0.4)">
            <rect x={zone.rightX + 18} y={zone.topY - 4} width="10" height={zoneH + 12} rx="3" />
            <circle cx={zone.rightX + 23} cy={zone.topY - 11} r="5" />
          </g>
        )}
        {!batterSide && (
          <g opacity="0.15" fill="rgba(248, 249, 250, 0.4)">
            <rect x={zone.rightX + 18} y={zone.topY - 4} width="10" height={zoneH + 12} rx="3" />
            <circle cx={zone.rightX + 23} cy={zone.topY - 11} r="5" />
          </g>
        )}

        {/* Home plate */}
        <polygon
          points={`${SVG_SIZE / 2},${SVG_SIZE - SVG_PADDING - 8} ${SVG_SIZE / 2 - 14},${SVG_SIZE - SVG_PADDING - 8} ${SVG_SIZE / 2 - 14},${SVG_SIZE - SVG_PADDING - 24} ${SVG_SIZE / 2},${SVG_SIZE - SVG_PADDING - 32} ${SVG_SIZE / 2 + 14},${SVG_SIZE - SVG_PADDING - 24} ${SVG_SIZE / 2 + 14},${SVG_SIZE - SVG_PADDING - 8}`}
          fill="rgba(248, 249, 250, 0.03)"
          stroke="rgba(248, 249, 250, 0.10)"
          strokeWidth="1"
        />

        {/* Tactical Zone Visualizer: corner glow indicators */}
        {/* Four corner pulse circles — glow when a pitch hits the corner */}
        {[
          { x: zone.leftX, y: zone.topY },
          { x: zone.rightX, y: zone.topY },
          { x: zone.leftX, y: zone.botY },
          { x: zone.rightX, y: zone.botY },
        ].map((corner, i) => {
          // Check if the latest pitch is near this corner
          const latest = recentPitches[recentPitches.length - 1];
          let isCorner = false;
          if (latest?.pX != null && latest?.pZ != null) {
            const lp = pitchToSVG(latest.pX, latest.pZ, szTop, szBot);
            if (lp) {
              const dist = Math.sqrt((lp.x - corner.x) ** 2 + (lp.y - corner.y) ** 2);
              isCorner = dist < 30;
            }
          }
          return (
            <circle
              key={`corner-${i}`}
              cx={corner.x}
              cy={corner.y}
              r={isCorner ? 16 : 6}
              fill="url(#cornerGlow)"
              className={isCorner ? "animate-corner-glow" : ""}
              opacity={isCorner ? 1 : 0.3}
            />
          );
        })}

        {/* Strike zone rectangle */}
        <rect
          x={zone.leftX}
          y={zone.topY}
          width={zoneW}
          height={zoneH}
          fill="url(#zoneGlow)"
          stroke="rgba(230, 126, 34, 0.45)"
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
            // Pointing at one pitch pushes the rest back, so a dense cluster
            // resolves into the single dot the tooltip is describing.
            const isHovered = hoveredIdx === idx;
            const isDimmed = hoveredIdx != null && !isHovered;

            return (
              <motion.g
                key={`${p.atBatIndex}-${p.pitchNumber}-${idx}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: isDimmed ? 0.3 : 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: "spring", stiffness: 360, damping: 22, delay: isLatest ? 0 : Math.min(idx * 0.01, 0.3) }}
                onClick={() => onSelectPitch?.(p)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx((cur) => (cur === idx ? null : cur))}
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
                {/* Hover halo — a soft bloom in the pitch's own colour, drawn
                    behind the dot so it reads as light rather than an outline. */}
                {isHovered && (
                  <circle cx={pos.x} cy={pos.y} r={size + 6} fill={color} opacity={0.25} />
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
                {/* Pitch number for the latest few (or all, when numberAll) */}
                {(numberAll || idx >= recentPitches.length - 5) && (
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

      {/* Legend. Thirteen pitch types cannot all be separated by hue under
          dichromatic vision, so the colour mapping is spelled out here instead
          of living only in a hover tooltip — which also saves everyone from
          pointing at each dot to learn what was thrown. */}
      {showLabels && legend.length > 0 && (
        <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px]">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1 text-slate-400">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span>{item.label}</span>
              <span className="num text-slate-600">{item.count}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Hover tooltip */}
      {hoveredIdx != null && recentPitches[hoveredIdx] && (() => {
        const p = recentPitches[hoveredIdx];
        const pos = pitchToSVG(p.pX, p.pZ, szTop, szBot);
        if (!pos) return null;
        const speed = typeof p.startSpeed === "number" ? p.startSpeed.toFixed(1) : null;
        return (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/10 bg-midnight-2/95 px-2.5 py-1.5 text-[11px] shadow-lg"
            style={{ left: `${(pos.x / SVG_SIZE) * 100}%`, top: `${(pos.y / SVG_SIZE) * 100}%`, marginTop: -10 }}
          >
            <div className="font-semibold text-chalk">
              {p.pitchName ?? p.pitchType ?? "Pitch"}
              {speed && ` · ${speed} mph`}
            </div>
            <div className="text-slate-400">{tooltipResultLabel(p)}</div>
          </div>
        );
      })()}
    </div>
  );
}

export { PITCH_COLORS, getPitchColor };
