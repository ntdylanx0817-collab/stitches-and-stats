"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { Target } from "lucide-react";

interface MatchupStrikeZoneProps {
  batterStats: {
    avgExitVelo: number;
    barrelPercent: number;
    hardHitPercent: number;
    battingAvg: number;
    slg: number;
  };
  pitcherStats: {
    avgExitVelo: number;
    barrelPercent: number;
    hardHitPercent: number;
    avg: number;
  };
  batterSide?: string;
  className?: string;
}

const SVG_SIZE = 340;
const SVG_PADDING = 40;
const ZONE_LEFT = -8.5 / 12;
const ZONE_RIGHT = 8.5 / 12;
const SZ_TOP_DEFAULT = 3.5;
const SZ_BOT_DEFAULT = 1.6;

/** Map a pitch coordinate (pX, pZ in feet) to SVG coordinates. */
function pitchToSVG(pX: number, pZ: number, szTop: number = SZ_TOP_DEFAULT, szBot: number = SZ_BOT_DEFAULT) {
  const xRange = 4.0;
  const x = SVG_PADDING + ((pX + xRange / 2) / xRange) * (SVG_SIZE - SVG_PADDING * 2);
  const zMax = 5.0;
  const y = SVG_SIZE - SVG_PADDING - pZ * ((SVG_SIZE - SVG_PADDING * 2) / zMax);
  return { x, y };
}

function zoneLineToSVG(szTop: number, szBot: number) {
  return {
    topY: pitchToSVG(0, szTop, szTop, szBot).y,
    botY: pitchToSVG(0, szBot, szTop, szBot).y,
    leftX: pitchToSVG(ZONE_LEFT, 0).x,
    rightX: pitchToSVG(ZONE_RIGHT, 0).x,
  };
}

/**
 * Generate a heatmap of pitcher location tendency.
 * Pitchers generally target the edges of the zone and avoid the middle.
 * We model this as a probability distribution centered on the corners
 * with lower density in the heart of the plate.
 */
function generatePitcherHeatmap(szTop: number, szBot: number) {
  const points: Array<{ x: number; y: number; intensity: number; label: string }> = [];
  const zone = zoneLineToSVG(szTop, szBot);
  const zoneW = zone.rightX - zone.leftX;
  const zoneH = zone.topY - zone.botY;
  const cx = (zone.leftX + zone.rightX) / 2;
  const cy = (zone.topY + zone.botY) / 2;

  // Pitcher target zones: 4 corners + 2 edges (up/down)
  // Intensity decreases with distance from corners
  const targets = [
    { fx: 0.15, fy: 0.15, intensity: 0.85, label: "Up & In" },
    { fx: 0.85, fy: 0.15, intensity: 0.80, label: "Up & Away" },
    { fx: 0.15, fy: 0.85, intensity: 0.90, label: "Down & In" },
    { fx: 0.85, fy: 0.85, intensity: 0.88, label: "Down & Away" },
    { fx: 0.50, fy: 0.90, intensity: 0.65, label: "Low Middle" },
    { fx: 0.50, fy: 0.10, intensity: 0.55, label: "Up Middle" },
  ];

  for (const t of targets) {
    const px = zone.leftX + t.fx * zoneW;
    const py = zone.topY + t.fy * zoneH;
    points.push({ x: px, y: py, intensity: t.intensity, label: t.label });
  }
  return points;
}

/**
 * Generate a batter sweet-spot heatmap.
 * Power hitters tend to do damage on pitches in the heart of the zone
 * and slightly down-and-in (where they can extend their arms).
 * We model this using the batter's barrel% and exit velocity.
 */
function generateBatterSweetSpots(
  szTop: number,
  szBot: number,
  barrelPercent: number,
  avgExitVelo: number
) {
  const points: Array<{ x: number; y: number; intensity: number; label: string }> = [];
  const zone = zoneLineToSVG(szTop, szBot);
  const zoneW = zone.rightX - zone.leftX;
  const zoneH = zone.topY - zone.botY;

  // Base intensity from barrel% (higher barrel% = more dangerous sweet spots)
  const barrelBoost = Math.min(1.0, barrelPercent / 15);
  const veloBoost = Math.min(1.0, (avgExitVelo - 85) / 12);

  // Batter sweet spots: heart of zone, down-and-in, middle-middle
  const spots = [
    { fx: 0.50, fy: 0.50, intensity: 0.70 + barrelBoost * 0.25, label: "Heart" },
    { fx: 0.30, fy: 0.65, intensity: 0.60 + barrelBoost * 0.30, label: "Down & In" },
    { fx: 0.70, fy: 0.40, intensity: 0.50 + barrelBoost * 0.20, label: "Mid Away" },
    { fx: 0.45, fy: 0.35, intensity: 0.55 + veloBoost * 0.20, label: "Up & In" },
  ];

  for (const s of spots) {
    const px = zone.leftX + s.fx * zoneW;
    const py = zone.topY + s.fy * zoneH;
    points.push({ x: px, y: py, intensity: Math.min(1.0, s.intensity), label: s.label });
  }
  return points;
}

export function MatchupStrikeZone({
  batterStats,
  pitcherStats,
  batterSide = "R",
  className,
}: MatchupStrikeZoneProps) {
  const szTop = SZ_TOP_DEFAULT;
  const szBot = SZ_BOT_DEFAULT;

  const pitcherHeat = useMemo(() => generatePitcherHeatmap(szTop, szBot), [szTop, szBot]);
  const batterSweet = useMemo(
    () => generateBatterSweetSpots(szTop, szBot, batterStats.barrelPercent, batterStats.avgExitVelo),
    [szTop, szBot, batterStats.barrelPercent, batterStats.avgExitVelo]
  );

  const zone = zoneLineToSVG(szTop, szBot);
  const zoneW = zone.rightX - zone.leftX;
  const zoneH = zone.topY - zone.botY;

  return (
    <div className={className}>
      <div className="glass rounded-2xl p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Target className="h-4 w-4 text-cobalt" />
          Matchup Strike Zone
        </h3>
        <p className="mb-3 text-[11px] text-slate-500">
          Pitcher location tendency (blue) vs batter sweet spots (red) — where damage happens
        </p>

        <div className="flex justify-center">
          <svg
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="w-full max-w-[360px] h-auto"
            role="img"
            aria-label="Matchup strike zone heatmap"
          >
            <defs>
              <radialGradient id="pitcherHeat" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(77,163,255,0.6)" />
                <stop offset="60%" stopColor="rgba(77,163,255,0.2)" />
                <stop offset="100%" stopColor="rgba(77,163,255,0)" />
              </radialGradient>
              <radialGradient id="batterHeat" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,59,92,0.65)" />
                <stop offset="60%" stopColor="rgba(255,59,92,0.22)" />
                <stop offset="100%" stopColor="rgba(255,59,92,0)" />
              </radialGradient>
              <filter id="heatBlur">
                <feGaussianBlur stdDeviation="14" />
              </filter>
            </defs>

            {/* Background */}
            <rect
              x={SVG_PADDING}
              y={SVG_PADDING}
              width={SVG_SIZE - SVG_PADDING * 2}
              height={SVG_SIZE - SVG_PADDING * 2}
              fill="rgba(11,15,25,0.5)"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
              rx="8"
            />

            {/* Home plate */}
            <polygon
              points={`${SVG_SIZE / 2},${SVG_SIZE - SVG_PADDING - 8} ${SVG_SIZE / 2 - 14},${SVG_SIZE - SVG_PADDING - 8} ${SVG_SIZE / 2 - 14},${SVG_SIZE - SVG_PADDING - 24} ${SVG_SIZE / 2},${SVG_SIZE - SVG_PADDING - 32} ${SVG_SIZE / 2 + 14},${SVG_SIZE - SVG_PADDING - 24} ${SVG_SIZE / 2 + 14},${SVG_SIZE - SVG_PADDING - 8}`}
              fill="rgba(255,255,255,0.04)"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
            />

            {/* Batter silhouette */}
            {batterSide === "L" && (
              <g opacity="0.25" fill="rgba(255,255,255,0.4)">
                <rect x={zone.leftX - 28} y={zone.botY - 4} width="10" height={zoneH + 12} rx="3" />
                <circle cx={zone.leftX - 23} cy={zone.botY - 8} r="5" />
              </g>
            )}
            {(batterSide === "R" || !batterSide) && (
              <g opacity="0.25" fill="rgba(255,255,255,0.4)">
                <rect x={zone.rightX + 18} y={zone.botY - 4} width="10" height={zoneH + 12} rx="3" />
                <circle cx={zone.rightX + 23} cy={zone.botY - 8} r="5" />
              </g>
            )}

            {/* Strike zone rectangle */}
            <rect
              x={zone.leftX}
              y={zone.topY}
              width={zoneW}
              height={zoneH}
              fill="rgba(255,255,255,0.02)"
              stroke="rgba(77,163,255,0.4)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              rx="2"
            />

            {/* 3x3 sub-zone grid */}
            {[1, 2].map((i) => (
              <line
                key={`v${i}`}
                x1={zone.leftX + (zoneW / 3) * i}
                y1={zone.topY}
                x2={zone.leftX + (zoneW / 3) * i}
                y2={zone.botY}
                stroke="rgba(77,163,255,0.10)"
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
                stroke="rgba(77,163,255,0.10)"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
            ))}

            {/* Pitcher heatmap (blue, blurred) */}
            <g filter="url(#heatBlur)">
              {pitcherHeat.map((p, i) => (
                <circle
                  key={`pitch-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={28 + p.intensity * 14}
                  fill="url(#pitcherHeat)"
                  opacity={p.intensity}
                />
              ))}
            </g>

            {/* Batter sweet spots (red, blurred) */}
            <g filter="url(#heatBlur)">
              {batterSweet.map((p, i) => (
                <circle
                  key={`batter-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={24 + p.intensity * 16}
                  fill="url(#batterHeat)"
                  opacity={p.intensity}
                />
              ))}
            </g>

            {/* Pitcher target markers (blue dots with ring) */}
            {pitcherHeat.map((p, i) => (
              <g key={`pmark-${i}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={5}
                  fill="rgba(77,163,255,0.9)"
                  stroke="rgba(77,163,255,0.3)"
                  strokeWidth="2"
                />
                <text
                  x={p.x}
                  y={p.y - 10}
                  fill="rgba(77,163,255,0.8)"
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {p.label}
                </text>
              </g>
            ))}

            {/* Batter sweet spot markers (red dots) */}
            {batterSweet.map((p, i) => (
              <g key={`bmark-${i}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={5}
                  fill="rgba(255,59,92,0.9)"
                  stroke="rgba(255,59,92,0.3)"
                  strokeWidth="2"
                />
                {p.intensity > 0.7 && (
                  <text
                    x={p.x}
                    y={p.y - 10}
                    fill="rgba(255,59,92,0.9)"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    HOT
                  </text>
                )}
              </g>
            ))}

            {/* Labels */}
            <text x={SVG_PADDING} y={SVG_PADDING - 10} fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">
              MATCHUP ZONE
            </text>
            <text x={SVG_SIZE - SVG_PADDING} y={SVG_PADDING - 10} fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace" textAnchor="end">
              {batterSide === "L" ? "LHB" : "RHB"}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-3 flex justify-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cobalt" />
            <span className="text-slate-400">Pitcher targets</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-crimson" />
            <span className="text-slate-400">Batter sweet spots</span>
          </span>
        </div>

        {/* Matchup analysis */}
        <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Zone Overlap Analysis</div>
          <p className="text-[11px] leading-relaxed text-slate-300">
            {analyzeZoneOverlap(pitcherHeat, batterSweet)}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Generate a text analysis of how the pitcher's targets overlap with the batter's sweet spots. */
function analyzeZoneOverlap(
  pitcherHeat: Array<{ x: number; y: number; intensity: number; label: string }>,
  batterSweet: Array<{ x: number; y: number; intensity: number; label: string }>
): string {
  // Find the batter's hottest spot (highest intensity)
  const hottestBatter = batterSweet.reduce((a, b) => a.intensity > b.intensity ? a : b);
  // Find the pitcher's most-targeted spot
  const topPitcher = pitcherHeat.reduce((a, b) => a.intensity > b.intensity ? a : b);

  // Calculate distance between them
  const dx = hottestBatter.x - topPitcher.x;
  const dy = hottestBatter.y - topPitcher.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 50) {
    return `⚠️ Danger zone: The pitcher's favorite location (${topPitcher.label}) overlaps with the batter's hottest sweet spot (${hottestBatter.label}). Expect hard contact if the pitcher misses his spot.`;
  } else if (dist < 100) {
    return `The pitcher targets ${topPitcher.label} while the batter does damage on ${hottestBatter.label}. There's some overlap — the batter can still do damage on mistakes.`;
  } else {
    return `✅ Smart targeting: The pitcher avoids the batter's sweet spot (${hottestBatter.label}) by living on the ${topPitcher.label}. Good game plan to suppress damage.`;
  }
}
