"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Skull, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnrichedPitch } from "@/lib/types";

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
}

interface WPAEntry {
  batterName: string;
  wpa: number;
  keyPlay: string;
  playIndex: number;
}

interface WPAData {
  heroes: WPAEntry[];
  goats: WPAEntry[];
}

export function WPALeaderboard({ gamePk }: { gamePk: number }) {
  const { data: wpData, isLoading } = useQuery<WinProbData>({
    queryKey: ["win-prob", gamePk],
    queryFn: async () => {
      const res = await fetch(`/api/win-probability?gamePk=${gamePk}`);
      if (!res.ok) throw new Error("wp fetch failed");
      return res.json();
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const { data: gameData } = useQuery<{ pitches: EnrichedPitch[] }>({
    queryKey: ["game-wpa", gamePk],
    queryFn: async () => {
      const res = await fetch(`/api/game/${gamePk}`);
      if (!res.ok) throw new Error("game fetch failed");
      return res.json();
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const wpaData = computeWPA(wpData, gameData?.pitches ?? []);

  if (isLoading || !wpData || wpData.points.length < 2) {
    return null;
  }

  if (wpaData.heroes.length === 0 && wpaData.goats.length === 0) {
    return null;
  }

  return (
    <div className="glass rounded-2xl p-4">
      <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
        <Trophy className="h-4 w-4 text-warning-track" />
        WPA Leaderboard
      </h3>
      <p className="mb-3 text-[10px] text-slate-500">Win Probability Added — who impacted the game most</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Heroes */}
        <div>
          <div className="mb-1.5 font-scoreboard text-[9px] uppercase tracking-wide text-mint flex items-center gap-1">
            <Trophy className="h-3 w-3" /> Heroes
          </div>
          <div className="space-y-1">
            {wpaData.heroes.map((entry, i) => (
              <WPARow key={`hero-${i}`} entry={entry} isHero={true} rank={i + 1} />
            ))}
          </div>
        </div>

        {/* Goats */}
        <div>
          <div className="mb-1.5 font-scoreboard text-[9px] uppercase tracking-wide text-crimson flex items-center gap-1">
            <Skull className="h-3 w-3" /> Goats
          </div>
          <div className="space-y-1">
            {wpaData.goats.map((entry, i) => (
              <WPARow key={`goat-${i}`} entry={entry} isHero={false} rank={i + 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WPARow({ entry, isHero, rank }: { entry: WPAEntry; isHero: boolean; rank: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: isHero ? -8 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.05 }}
      className={cn(
        "flex items-center gap-2 rounded-lg border p-1.5",
        isHero ? "border-mint/15 bg-mint/5" : "border-crimson/15 bg-crimson/5"
      )}
    >
      <span className={cn(
        "font-scoreboard w-4 text-center text-[10px] font-bold num shrink-0",
        isHero ? "text-mint" : "text-crimson"
      )}>
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-chalk">{entry.batterName}</div>
        <div className="truncate text-[9px] text-slate-500">{entry.keyPlay}</div>
      </div>
      <span className={cn(
        "font-scoreboard text-sm font-bold num shrink-0",
        isHero ? "text-mint" : "text-crimson"
      )}>
        {isHero ? "+" : ""}{entry.wpa.toFixed(1)}%
      </span>
    </motion.div>
  );
}

function computeWPA(wpData: WinProbData | undefined, pitches: EnrichedPitch[]): WPAData {
  if (!wpData || !wpData.points || wpData.points.length < 2) {
    return { heroes: [], goats: [] };
  }

  // Build a map of atBatIndex → batter name from pitches
  const batterMap = new Map<number, string>();
  const playEvents = new Map<number, string>();
  for (const p of pitches) {
    const idx = p.atBatIndex;
    if (!batterMap.has(idx) && p.batterName) {
      batterMap.set(idx, p.batterName);
    }
    if (!playEvents.has(idx) && p.playResult) {
      playEvents.set(idx, p.playResult);
    }
  }

  // Calculate WPA per play
  const wpaByBatter = new Map<string, { wpa: number; maxPlay: { wpa: number; event: string; playIndex: number } }>();

  for (let i = 1; i < wpData.points.length; i++) {
    const prev = wpData.points[i - 1];
    const curr = wpData.points[i];

    // WPA = change in home win probability
    // Positive = good for home team, negative = good for away team
    const homeWPA = curr.homeWinProb - prev.homeWinProb;
    const awayWPA = -homeWPA;

    // Determine which team is batting
    const isHomeBatting = curr.halfInning === "bottom";
    const batterWPA = isHomeBatting ? homeWPA : awayWPA;

    // Get batter name
    const batterName = batterMap.get(curr.playIndex) ?? batterMap.get(prev.playIndex) ?? "Unknown";
    const event = playEvents.get(curr.playIndex) ?? curr.event ?? "";

    // Skip trivial plays (very small WPA changes)
    if (Math.abs(batterWPA) < 0.5) continue;

    if (!wpaByBatter.has(batterName)) {
      wpaByBatter.set(batterName, { wpa: 0, maxPlay: { wpa: 0, event: "", playIndex: 0 } });
    }
    const entry = wpaByBatter.get(batterName)!;
    entry.wpa += batterWPA;
    if (Math.abs(batterWPA) > Math.abs(entry.maxPlay.wpa)) {
      entry.maxPlay = { wpa: batterWPA, event, playIndex: curr.playIndex };
    }
  }

  // Sort into heroes (positive WPA) and goats (negative WPA)
  const all = Array.from(wpaByBatter.entries())
    .map(([name, data]) => ({
      batterName: name,
      wpa: data.wpa,
      keyPlay: formatKeyPlay(data.maxPlay.event, data.maxPlay.wpa),
      playIndex: data.maxPlay.playIndex,
    }))
    .sort((a, b) => Math.abs(b.wpa) - Math.abs(a.wpa));

  const heroes = all.filter(e => e.wpa > 0).slice(0, 4);
  const goats = all.filter(e => e.wpa < 0).sort((a, b) => a.wpa - b.wpa).slice(0, 4);

  return { heroes, goats };
}

function formatKeyPlay(event: string, wpa: number): string {
  const ev = event.replace(/_/g, " ");
  const sign = wpa > 0 ? "+" : "";
  return `${ev} (${sign}${wpa.toFixed(1)}% WPA)`;
}
