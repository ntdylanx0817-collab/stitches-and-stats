"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { Loader2, Target } from "lucide-react";

interface ZoneData {
  zone: number;
  count: number;
  hits: number;
  avgExitVelo: number;
  battingAvg: number;
  slg: number;
  isHot: boolean;
  isCold: boolean;
}

interface PlayerZoneData {
  playerId: number;
  playerName: string;
  type: "batter" | "pitcher";
  season: number;
  totalPitches: number;
  zones: ZoneData[];
}

interface MatchupStrikeZoneProps {
  batterId: number;
  batterName: string;
  pitcherId: number;
  pitcherName: string;
  className?: string;
}

const SVG_SIZE = 360;
const SVG_PADDING = 36;
const ZONE_LEFT = -8.5 / 12;
const ZONE_RIGHT = 8.5 / 12;
const SZ_TOP_DEFAULT = 3.5;
const SZ_BOT_DEFAULT = 1.6;

/**
 * Convert zone number (1-14) to SVG coordinates.
 * Zones 1-9 are the 3x3 strike zone grid (1=top-left, 9=bottom-right).
 * Zones 11-14 are outside (11=above, 12=below, 13=left, 14=right).
 */
function zoneToSVG(zone: number, szTop: number, szBot: number) {
  const zoneLines = zoneLineToSVG(szTop, szBot);
  const zoneW = zoneLines.rightX - zoneLines.leftX;
  const zoneH = zoneLines.topY - zoneLines.botY;
  const colW = zoneW / 3;
  const rowH = zoneH / 3;

  // Zones 1-3: top row, 4-6: middle, 7-9: bottom
  if (zone >= 1 && zone <= 9) {
    const row = Math.floor((zone - 1) / 3); // 0=top, 1=mid, 2=bottom
    const col = (zone - 1) % 3; // 0=left, 1=mid, 2=right
    const x = zoneLines.leftX + col * colW + colW / 2;
    const y = zoneLines.topY + row * rowH + rowH / 2;
    return { x, y };
  }
  // Zone 11: above, 12: below, 13: left, 14: right
  if (zone === 11) return { x: (zoneLines.leftX + zoneLines.rightX) / 2, y: zoneLines.topY - rowH * 0.5 };
  if (zone === 12) return { x: (zoneLines.leftX + zoneLines.rightX) / 2, y: zoneLines.botY + rowH * 0.5 };
  if (zone === 13) return { x: zoneLines.leftX - colW * 0.5, y: (zoneLines.topY + zoneLines.botY) / 2 };
  if (zone === 14) return { x: zoneLines.rightX + colW * 0.5, y: (zoneLines.topY + zoneLines.botY) / 2 };
  return null;
}

function zoneLineToSVG(szTop: number, szBot: number) {
  const xRange = 4.0;
  const leftX = SVG_PADDING + ((ZONE_LEFT + xRange / 2) / xRange) * (SVG_SIZE - SVG_PADDING * 2);
  const rightX = SVG_PADDING + ((ZONE_RIGHT + xRange / 2) / xRange) * (SVG_SIZE - SVG_PADDING * 2);
  const zMax = 5.0;
  const topY = SVG_SIZE - SVG_PADDING - szTop * ((SVG_SIZE - SVG_PADDING * 2) / zMax);
  const botY = SVG_SIZE - SVG_PADDING - szBot * ((SVG_SIZE - SVG_PADDING * 2) / zMax);
  return { topY, botY, leftX, rightX };
}

export function MatchupStrikeZone({
  batterId, batterName, pitcherId, pitcherName, className,
}: MatchupStrikeZoneProps) {
  // Fetch REAL batter zone data from Baseball Savant statcast_search
  const { data: batterZones, isLoading: batterLoading } = useQuery<PlayerZoneData>({
    queryKey: ["player-zones", batterId, "batter"],
    queryFn: async () => {
      const res = await fetch(`/api/player-zones?playerId=${batterId}&type=batter`);
      if (!res.ok) throw new Error("batter zones fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // Fetch REAL pitcher zone data
  const { data: pitcherZones, isLoading: pitcherLoading } = useQuery<PlayerZoneData>({
    queryKey: ["player-zones", pitcherId, "pitcher"],
    queryFn: async () => {
      const res = await fetch(`/api/player-zones?playerId=${pitcherId}&type=pitcher`);
      if (!res.ok) throw new Error("pitcher zones fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const isLoading = batterLoading || pitcherLoading;
  const szTop = SZ_TOP_DEFAULT;
  const szBot = SZ_BOT_DEFAULT;
  const zoneLines = zoneLineToSVG(szTop, szBot);
  const zoneW = zoneLines.rightX - zoneLines.leftX;
  const zoneH = zoneLines.topY - zoneLines.botY;

  // Find the batter's hottest zone
  const hottestBatterZone = useMemo(() => {
    if (!batterZones) return null;
    const inZone = batterZones.zones.filter(z => z.zone >= 1 && z.zone <= 9 && z.count > 5);
    if (inZone.length === 0) return null;
    return inZone.reduce((a, b) => (a.battingAvg * a.avgExitVelo > b.battingAvg * b.avgExitVelo ? a : b));
  }, [batterZones]);

  // Find the pitcher's most-targeted zone
  const topPitcherZone = useMemo(() => {
    if (!pitcherZones) return null;
    const all = pitcherZones.zones.filter(z => z.count > 0);
    if (all.length === 0) return null;
    return all.reduce((a, b) => (a.count > b.count ? a : b));
  }, [pitcherZones]);

  return (
    <div className={className}>
      <div className="glass rounded-2xl p-4">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Target className="h-4 w-4 text-warning-track" />
          Real Matchup Zone Data
        </h3>
        <p className="mb-3 text-[11px] text-slate-500">
          {batterZones && pitcherZones
            ? `${batterZones.totalPitches.toLocaleString()} batter pitches · ${pitcherZones.totalPitches.toLocaleString()} pitcher pitches from ${batterZones.season} Statcast`
            : "Fetching real pitch-by-pitch zone data from Baseball Savant…"
          }
        </p>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-warning-track" />
              <p className="text-xs text-slate-500">Loading {batterLoading ? "batter" : "pitcher"} zone data…</p>
              <p className="text-[10px] text-slate-600 mt-1">Fetching 25,000+ pitches from Statcast</p>
            </div>
          </div>
        ) : batterZones && pitcherZones ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Batter Hot/Cold Zones */}
            <div>
              <div className="mb-2 text-center">
                <div className="font-scoreboard text-xs uppercase tracking-wide text-cobalt">Batter Hot Zones</div>
                <div className="text-xs text-slate-400 truncate">{batterName}</div>
              </div>
              <ZoneHeatmap
                zones={batterZones.zones}
                szTop={szTop}
                szBot={szBot}
                mode="batter"
                highlightZone={hottestBatterZone?.zone}
              />
            </div>

            {/* Pitcher Location Tendency */}
            <div>
              <div className="mb-2 text-center">
                <div className="font-scoreboard text-xs uppercase tracking-wide text-mint">Pitcher Locations</div>
                <div className="text-xs text-slate-400 truncate">{pitcherName}</div>
              </div>
              <ZoneHeatmap
                zones={pitcherZones.zones}
                szTop={szTop}
                szBot={szBot}
                mode="pitcher"
                highlightZone={topPitcherZone?.zone}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-slate-500">
            Zone data not available for this matchup.
          </div>
        )}

        {/* Overlap analysis */}
        {batterZones && pitcherZones && hottestBatterZone && topPitcherZone && (
          <div className="mt-4 rounded-lg border border-chalk bg-midnight/40 p-3">
            <div className="font-scoreboard text-[10px] uppercase tracking-wide text-slate-500 mb-1">Zone Overlap Analysis</div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {analyzeOverlap(hottestBatterZone, topPitcherZone, batterName, pitcherName)}
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="mt-3 flex justify-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-crimson" />
            <span className="text-slate-400">Hot Zone</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cobalt" />
            <span className="text-slate-400">Cold Zone</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-warning-track" />
            <span className="text-slate-400">Primary Target</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Zone heatmap SVG showing real zone-level data */
function ZoneHeatmap({
  zones, szTop, szBot, mode, highlightZone,
}: {
  zones: ZoneData[];
  szTop: number;
  szBot: number;
  mode: "batter" | "pitcher";
  highlightZone?: number;
}) {
  const zoneLines = zoneLineToSVG(szTop, szBot);
  const zoneW = zoneLines.rightX - zoneLines.leftX;
  const zoneH = zoneLines.topY - zoneLines.botY;
  const colW = zoneW / 3;
  const rowH = zoneH / 3;

  // Find max count for normalization
  const maxCount = Math.max(...zones.map(z => z.count), 1);

  return (
    <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} className="w-full max-w-[280px] h-auto mx-auto">
      <defs>
        <linearGradient id={`hot-${mode}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(255, 59, 92, 0.6)" />
          <stop offset="100%" stopColor="rgba(255, 59, 92, 0.2)" />
        </linearGradient>
        <linearGradient id={`cold-${mode}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(77, 163, 255, 0.5)" />
          <stop offset="100%" stopColor="rgba(77, 163, 255, 0.15)" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect
        x={SVG_PADDING}
        y={SVG_PADDING}
        width={SVG_SIZE - SVG_PADDING * 2}
        height={SVG_SIZE - SVG_PADDING * 2}
        fill="rgba(5, 10, 20, 0.5)"
        stroke="rgba(248, 249, 250, 0.08)"
        strokeWidth="1"
        rx="6"
      />

      {/* Home plate */}
      <polygon
        points={`${SVG_SIZE / 2},${SVG_SIZE - SVG_PADDING - 4} ${SVG_SIZE / 2 - 12},${SVG_SIZE - SVG_PADDING - 4} ${SVG_SIZE / 2 - 12},${SVG_SIZE - SVG_PADDING - 16} ${SVG_SIZE / 2},${SVG_SIZE - SVG_PADDING - 22} ${SVG_SIZE / 2 + 12},${SVG_SIZE - SVG_PADDING - 16} ${SVG_SIZE / 2 + 12},${SVG_SIZE - SVG_PADDING - 4}`}
        fill="rgba(248, 249, 250, 0.03)"
        stroke="rgba(248, 249, 250, 0.08)"
        strokeWidth="1"
      />

      {/* Strike zone outline */}
      <rect
        x={zoneLines.leftX}
        y={zoneLines.topY}
        width={zoneW}
        height={zoneH}
        fill="none"
        stroke="rgba(230, 126, 34, 0.35)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        rx="2"
      />

      {/* 3x3 grid lines */}
      {[1, 2].map((i) => (
        <line
          key={`v${i}`}
          x1={zoneLines.leftX + colW * i}
          y1={zoneLines.topY}
          x2={zoneLines.leftX + colW * i}
          y2={zoneLines.botY}
          stroke="rgba(248, 249, 250, 0.06)"
          strokeWidth="1"
        />
      ))}
      {[1, 2].map((i) => (
        <line
          key={`h${i}`}
          x1={zoneLines.leftX}
          y1={zoneLines.topY + rowH * i}
          x2={zoneLines.rightX}
          y2={zoneLines.topY + rowH * i}
          stroke="rgba(248, 249, 250, 0.06)"
          strokeWidth="1"
        />
      ))}

      {/* Zone cells with real data */}
      {zones.map((zd) => {
        const pos = zoneToSVG(zd.zone, szTop, szBot);
        if (!pos) return null;

        // For batter: hot=red, cold=blue, based on BA and EV
        // For pitcher: show pitch frequency as opacity, highlight primary target
        let fill = "transparent";
        let stroke = "transparent";
        let label = "";

        if (mode === "batter") {
          if (zd.isHot) {
            fill = "rgba(255, 59, 92, 0.35)";
            stroke = "rgba(255, 59, 92, 0.8)";
            label = "HOT";
          } else if (zd.isCold) {
            fill = "rgba(77, 163, 255, 0.25)";
            stroke = "rgba(77, 163, 255, 0.6)";
            label = "COLD";
          } else if (zd.count > 5) {
            const intensity = zd.battingAvg;
            fill = `rgba(248, 249, 250, ${intensity * 0.08})`;
          }
        } else {
          // Pitcher mode: show pitch frequency
          const freq = zd.count / maxCount;
          if (highlightZone === zd.zone) {
            fill = "rgba(230, 126, 34, 0.35)";
            stroke = "rgba(230, 126, 34, 0.8)";
            label = "TARGET";
          } else if (freq > 0.1) {
            fill = `rgba(61, 219, 160, ${freq * 0.25})`;
          }
        }

        // Cell dimensions (for zones 1-9)
        if (zd.zone >= 1 && zd.zone <= 9) {
          const row = Math.floor((zd.zone - 1) / 3);
          const col = (zd.zone - 1) % 3;
          const cellX = zoneLines.leftX + col * colW;
          const cellY = zoneLines.topY + row * rowH;
          return (
            <g key={`zone-${zd.zone}`}>
              <rect
                x={cellX + 2}
                y={cellY + 2}
                width={colW - 4}
                height={rowH - 4}
                fill={fill}
                stroke={stroke}
                strokeWidth="1.5"
                rx="3"
                className={highlightZone === zd.zone ? "animate-corner-glow" : ""}
              />
              {label && (
                <text
                  x={cellX + colW / 2}
                  y={cellY + rowH / 2 + 3}
                  fill={label === "HOT" ? "rgba(255, 59, 92, 0.9)" : label === "COLD" ? "rgba(77, 163, 255, 0.8)" : "rgba(230, 126, 34, 0.9)"}
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {label}
                </text>
              )}
              {/* Show BA for batter mode, count for pitcher mode */}
              {zd.count > 5 && !label && mode === "batter" && (
                <text
                  x={cellX + colW / 2}
                  y={cellY + rowH / 2 + 3}
                  fill="rgba(248, 249, 250, 0.4)"
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {zd.battingAvg > 0 ? `. ${Math.round(zd.battingAvg * 1000)}` : ""}
                </text>
              )}
            </g>
          );
        }

        // Outside zones (11-14) - show as small circles
        if (zd.count > 0) {
          const freq = zd.count / maxCount;
          return (
            <circle
              key={`zone-${zd.zone}`}
              cx={pos.x}
              cy={pos.y}
              r={6 + freq * 8}
              fill={mode === "pitcher" ? `rgba(61, 219, 160, ${freq * 0.3})` : "rgba(248, 249, 250, 0.05)"}
              stroke="rgba(248, 249, 250, 0.1)"
              strokeWidth="1"
            />
          );
        }
        return null;
      })}

      {/* Labels */}
      <text x={SVG_PADDING} y={SVG_PADDING - 10} fill="rgba(248, 249, 250, 0.4)" fontSize="9" fontFamily="monospace">
        {mode === "batter" ? "BATTER ZONES" : "PITCHER ZONES"}
      </text>
    </svg>
  );
}

function analyzeOverlap(
  hotZone: ZoneData,
  targetZone: ZoneData,
  batterName: string,
  pitcherName: string
): string {
  // Check if the pitcher's primary target overlaps with the batter's hot zone
  if (hotZone.zone === targetZone.zone) {
    return `⚠️ Danger! ${pitcherName}'s primary target (zone ${targetZone.zone}) is ${batterName}'s hottest zone. ${batterName} hits .${Math.round(hotZone.battingAvg * 1000)} there with ${hotZone.avgExitVelo.toFixed(0)} mph avg exit velocity. Expect damage if the pitcher misses his spot.`;
  }

  // Check proximity (adjacent zones)
  const hotRow = Math.floor((hotZone.zone - 1) / 3);
  const hotCol = (hotZone.zone - 1) % 3;
  const targetRow = Math.floor((targetZone.zone - 1) / 3);
  const targetCol = (targetZone.zone - 1) % 3;
  const dist = Math.abs(hotRow - targetRow) + Math.abs(hotCol - targetCol);

  if (dist <= 1) {
    return `⚠️ Close call: ${pitcherName} targets zone ${targetZone.zone}, which is adjacent to ${batterName}'s hot zone (${hotZone.zone}). The batter does .${Math.round(hotZone.battingAvg * 1000)} damage in his hot zone — one missed location could mean trouble.`;
  } else {
    return `✅ Smart game plan: ${pitcherName} primarily targets zone ${targetZone.zone}, avoiding ${batterName}'s hottest zone (${hotZone.zone}) where he hits .${Math.round(hotZone.battingAvg * 1000)} with ${hotZone.avgExitVelo.toFixed(0)} mph EV. Good pitch sequencing.`;
  }
}
