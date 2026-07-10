"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitCompare, Search, Loader2, X, TrendingUp, TrendingDown,
  Zap, Target, Activity, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton, EmptyState, ErrorState } from "@/components/loading-states";
import { SprayChart } from "@/components/spray-chart";
import { cn } from "@/lib/utils";

interface PlayerRow {
  player_id: number;
  player_name: string;
  pa?: number;
  home_run?: number;
  batting_avg?: string;
  slg_percent?: string;
  on_base_percent?: string;
  woba?: string;
  xwoba?: string;
  xba?: string;
  xslg?: string;
  k_percent?: number;
  bb_percent?: number;
  barrel_brea?: number;
  hard_hit_percent?: number;
  sweet_spot_percent?: number;
  avg_hit_speed?: number;
  max_hit_speed?: number;
  launch_angle_average?: number;
  whiff_percent?: number;
  oz_swing_percent?: number;
}

interface PlayerBio {
  id: number;
  fullName: string;
  primaryNumber?: string;
  currentAge?: number;
  height?: string;
  weight?: number;
  primaryPosition?: { code: string; name: string; abbreviation: string };
  batSide?: { code: string; description: string };
  pitchHand?: { code: string; description: string };
  currentTeam?: { id: number; name: string };
}

interface PlayerData {
  player: PlayerBio;
  stats: PlayerRow | null;
  percentiles: Array<{ key: string; label: string; value: number | string; percentile: number; display?: string }>;
  type: string;
  year: number;
}

export function CompareView() {
  const [player1Id, setPlayer1Id] = useState<number | null>(null);
  const [player2Id, setPlayer2Id] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      {/* Header */}
      <div className="mb-5">
        <h2 className="font-scoreboard flex items-center gap-2 text-xl font-bold text-chalk uppercase tracking-wide">
          <GitCompare className="h-5 w-5 text-warning-track" />
          Batter's Eye Comparison
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 font-scoreboard uppercase tracking-wide">
          Head-to-head stat comparison · side-by-side percentile battle
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PlayerSearchPanel
          label="Player 1"
          accent="cobalt"
          selectedId={player1Id}
          onSelect={setPlayer1Id}
          onClear={() => setPlayer1Id(null)}
        />
        <PlayerSearchPanel
          label="Player 2"
          accent="crimson"
          selectedId={player2Id}
          onSelect={setPlayer2Id}
          onClear={() => setPlayer2Id(null)}
        />
      </div>

      {player1Id && player2Id && (
        <ComparisonResults player1Id={player1Id} player2Id={player2Id} />
      )}

      {!player1Id || !player2Id ? (
        <div className="mt-4">
          <EmptyState
            icon={GitCompare}
            title="Select two players to compare"
            description="Search for and select two batters above to see a head-to-head stat comparison with percentile battle bars."
          />
        </div>
      ) : null}
    </div>
  );
}

function PlayerSearchPanel({
  label, accent, selectedId, onSelect, onClear,
}: {
  label: string;
  accent: "cobalt" | "crimson";
  selectedId: number | null;
  onSelect: (id: number) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: lbData } = useQuery<{ rows: PlayerRow[]; year: number }>({
    queryKey: ["compare-batters"],
    queryFn: async () => {
      const res = await fetch("/api/leaderboard?type=batter&min=50");
      if (!res.ok) throw new Error("batter fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const { data: playerData, isLoading } = useQuery<PlayerData>({
    queryKey: ["player-profile", selectedId, "batter"],
    queryFn: async () => {
      const res = await fetch(`/api/player/${selectedId}?type=batter`);
      if (!res.ok) throw new Error("player fetch failed");
      return res.json();
    },
    enabled: !!selectedId,
    staleTime: 5 * 60_000,
  });

  const batters = lbData?.rows ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return batters.slice(0, 30);
    const q = search.toLowerCase();
    return batters.filter((b) => b.player_name?.toLowerCase().includes(q)).slice(0, 30);
  }, [batters, search]);

  const accentColor = accent === "cobalt" ? "#4DA3FF" : "#FF3B5C";

  return (
    <div className="glass rounded-xl p-4 relative z-10">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-scoreboard flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accentColor }} />
          {label}
        </h3>
        {selectedId && (
          <button onClick={onClear} className="text-slate-500 hover:text-chalk">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {playerData?.player ? (
        <div className="rounded-lg border border-chalk bg-midnight/40 p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-xl font-bold text-chalk font-scoreboard"
              style={{ background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}15)` }}
            >
              {playerData.player.fullName?.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-scoreboard text-lg font-bold text-chalk truncate">
                {playerData.player.fullName}
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 font-scoreboard uppercase tracking-wide">
                {playerData.player.primaryPosition && (
                  <span>{playerData.player.primaryPosition.abbreviation}</span>
                )}
                {playerData.player.currentTeam?.name && (
                  <span>· {playerData.player.currentTeam.name}</span>
                )}
                {playerData.player.batSide && (
                  <span>· B/T: {playerData.player.batSide.code}</span>
                )}
                {playerData.player.currentAge && (
                  <span>· {playerData.player.currentAge}y</span>
                )}
              </div>
            </div>
          </div>
          {playerData.stats && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="AVG" value={fmtAvg(playerData.stats.batting_avg)} />
              <MiniStat label="OPS" value={fmtOps(playerData.stats)} />
              <MiniStat label="HR" value={String(playerData.stats.home_run ?? 0)} tone="warning" />
            </div>
          )}
        </div>
      ) : isLoading ? (
        <div className="rounded-lg border border-chalk bg-midnight/40 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true); }}
            onFocus={() => setDropdownOpen(true)}
            placeholder="Search batters…"
            className="h-10 rounded-lg border-chalk bg-midnight/40 pl-9 font-scoreboard"
          />
          <AnimatePresence>
            {dropdownOpen && filtered.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="glass-strong absolute left-0 right-0 z-[100] mt-2 max-h-[320px] overflow-y-auto rounded-lg p-1.5 scrollbar-thin"
              >
                {filtered.map((p) => (
                  <button
                    key={p.player_id}
                    onClick={() => { onSelect(p.player_id); setDropdownOpen(false); setSearch(""); }}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="truncate text-sm font-medium text-chalk">{p.player_name}</span>
                    <span className="flex shrink-0 gap-2 text-[10px] text-slate-500 font-scoreboard">
                      <span>{fmtAvg(p.batting_avg)} AVG</span>
                      <span className="text-warning-track">{p.home_run} HR</span>
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ComparisonResults({ player1Id, player2Id }: { player1Id: number; player2Id: number }) {
  const { data: data1, isLoading: loading1 } = useQuery<PlayerData>({
    queryKey: ["player-profile", player1Id, "batter"],
    queryFn: async () => {
      const res = await fetch(`/api/player/${player1Id}?type=batter`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const { data: data2, isLoading: loading2 } = useQuery<PlayerData>({
    queryKey: ["player-profile", player2Id, "batter"],
    queryFn: async () => {
      const res = await fetch(`/api/player/${player2Id}?type=batter`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  if (loading1 || loading2) {
    return (
      <div className="mt-4 glass rounded-xl p-6">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-warning-track" />
      </div>
    );
  }

  if (!data1?.player || !data2?.player) {
    return (
      <div className="mt-4">
        <ErrorState title="Couldn't load comparison data" />
      </div>
    );
  }

  const p1 = data1.player;
  const p2 = data2.player;
  const s1 = data1.stats;
  const s2 = data2.stats;

  if (!s1 || !s2) return null;

  const comparisonRows: Array<{ label: string; v1: any; v2: any; format: (v: any) => string; higherIsBetter: boolean }> = [
    { label: "AVG", v1: s1.batting_avg, v2: s2.batting_avg, format: fmtAvg, higherIsBetter: true },
    { label: "OBP", v1: s1.on_base_percent, v2: s2.on_base_percent, format: fmtAvg, higherIsBetter: true },
    { label: "SLG", v1: s1.slg_percent, v2: s2.slg_percent, format: fmtAvg, higherIsBetter: true },
    { label: "OPS", v1: ops(s1), v2: ops(s2), format: (v) => v.toFixed(3).replace(/^0/, ""), higherIsBetter: true },
    { label: "wOBA", v1: s1.woba, v2: s2.woba, format: fmtAvg, higherIsBetter: true },
    { label: "xwOBA", v1: s1.xwoba, v2: s2.xwoba, format: fmtAvg, higherIsBetter: true },
    { label: "xBA", v1: s1.xba, v2: s2.xba, format: fmtAvg, higherIsBetter: true },
    { label: "xSLG", v1: s1.xslg, v2: s2.xslg, format: fmtAvg, higherIsBetter: true },
    { label: "HR", v1: s1.home_run, v2: s2.home_run, format: (v) => String(v ?? 0), higherIsBetter: true },
    { label: "PA", v1: s1.pa, v2: s2.pa, format: (v) => String(v ?? 0), higherIsBetter: true },
    { label: "K%", v1: s1.k_percent, v2: s2.k_percent, format: fmtPct, higherIsBetter: false },
    { label: "BB%", v1: s1.bb_percent, v2: s2.bb_percent, format: fmtPct, higherIsBetter: true },
    { label: "Barrel%", v1: s1.barrel_brea, v2: s2.barrel_brea, format: fmtPct, higherIsBetter: true },
    { label: "HardHit%", v1: s1.hard_hit_percent, v2: s2.hard_hit_percent, format: fmtPct, higherIsBetter: true },
    { label: "Avg EV", v1: s1.avg_hit_speed, v2: s2.avg_hit_speed, format: (v) => fmtNum(v, 1), higherIsBetter: true },
    { label: "Max EV", v1: s1.max_hit_speed, v2: s2.max_hit_speed, format: (v) => fmtNum(v, 1), higherIsBetter: true },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 glass rounded-xl overflow-hidden"
    >
      {/* VS Header */}
      <div className="grid grid-cols-2 border-b border-chalk">
        <div className="border-r border-chalk p-4 text-center" style={{ background: "rgba(77, 163, 255, 0.06)" }}>
          <div className="font-scoreboard text-xs uppercase tracking-wide text-cobalt">Player 1</div>
          <div className="font-scoreboard text-xl font-bold text-chalk truncate mt-1">{p1.fullName}</div>
        </div>
        <div className="p-4 text-center" style={{ background: "rgba(255, 59, 92, 0.06)" }}>
          <div className="font-scoreboard text-xs uppercase tracking-wide text-crimson">Player 2</div>
          <div className="font-scoreboard text-xl font-bold text-chalk truncate mt-1">{p2.fullName}</div>
        </div>
      </div>

      {/* Comparison rows */}
      <div className="divide-y divide-white/5">
        {comparisonRows.map((row, idx) => {
          const v1 = row.v1;
          const v2 = row.v2;
          const n1 = typeof v1 === "number" ? v1 : parseFloat(String(v1));
          const n2 = typeof v2 === "number" ? v2 : parseFloat(String(v2));
          const valid = !isNaN(n1) && !isNaN(n2);
          const p1Wins = valid && row.higherIsBetter ? n1 > n2 : valid && n1 < n2;
          const p2Wins = valid && row.higherIsBetter ? n2 > n1 : valid && n2 < n1;

          // Win bar: shows the ratio between the two values
          const total = Math.abs(n1) + Math.abs(n2);
          const p1Pct = total > 0 && valid ? (Math.abs(n1) / total) * 100 : 50;

          return (
            <div key={row.label} className="row-mowed-grass grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5">
              {/* Player 1 value */}
              <div className="text-right">
                <span className={cn(
                  "font-scoreboard text-lg font-bold num",
                  p1Wins ? "text-mint" : "text-slate-400"
                )}>
                  {row.format(v1)}
                </span>
              </div>

              {/* Center label + battle bar */}
              <div className="flex flex-col items-center min-w-[80px]">
                <div className="font-scoreboard text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                  {row.label}
                </div>
                <div className="flex h-1.5 w-20 overflow-hidden rounded-full bg-midnight">
                  <div
                    className="h-full bg-cobalt transition-all duration-500"
                    style={{ width: `${p1Pct}%` }}
                  />
                  <div
                    className="h-full bg-crimson transition-all duration-500"
                    style={{ width: `${100 - p1Pct}%` }}
                  />
                </div>
              </div>

              {/* Player 2 value */}
              <div className="text-left">
                <span className={cn(
                  "font-scoreboard text-lg font-bold num",
                  p2Wins ? "text-mint" : "text-slate-400"
                )}>
                  {row.format(v2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Percentile battle */}
      {data1.percentiles.length > 0 && data2.percentiles.length > 0 && (
        <PercentileBattle
          name1={p1.fullName}
          name2={p2.fullName}
          percentiles1={data1.percentiles}
          percentiles2={data2.percentiles}
        />
      )}

      {/* Spray chart comparison */}
      <SprayChartComparison player1Id={player1Id} player2Id={player2Id} name1={p1.fullName} name2={p2.fullName} />
    </motion.div>
  );
}

function PercentileBattle({
  name1, name2, percentiles1, percentiles2,
}: {
  name1: string;
  name2: string;
  percentiles1: Array<{ label: string; percentile: number }>;
  percentiles2: Array<{ label: string; percentile: number }>;
}) {
  // Match percentiles by label
  const matched = useMemo(() => {
    const map2 = new Map(percentiles2.map((p) => [p.label, p]));
    return percentiles1
      .filter((p1) => map2.has(p1.label))
      .map((p1) => ({ label: p1.label, p1: p1.percentile, p2: map2.get(p1.label)!.percentile }));
  }, [percentiles1, percentiles2]);

  return (
    <div className="border-t border-chalk p-4">
      <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
        <Award className="h-4 w-4 text-warning-track" />
        Percentile Battle
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {matched.map((m) => {
          const p1Wins = m.p1 > m.p2;
          return (
            <div key={m.label} className="rounded-lg border border-chalk bg-midnight/40 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-scoreboard text-[10px] uppercase tracking-wide text-slate-500">{m.label}</span>
                <span className="font-scoreboard text-[9px] text-slate-600">PCTILE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-scoreboard text-base font-bold num flex-1 text-left",
                  p1Wins ? "text-cobalt" : "text-slate-500"
                )}>
                  {m.p1}
                </span>
                <span className="text-[9px] text-slate-600">vs</span>
                <span className={cn(
                  "font-scoreboard text-base font-bold num flex-1 text-right",
                  !p1Wins ? "text-crimson" : "text-slate-500"
                )}>
                  {m.p2}
                </span>
              </div>
              <div className="flex h-1 mt-1.5 overflow-hidden rounded-full bg-midnight">
                <div className="h-full bg-cobalt" style={{ width: `${m.p1}%` }} />
                <div className="h-full bg-crimson" style={{ width: `${m.p2}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div className="rounded-md border border-chalk bg-midnight/40 p-2 text-center">
      <div className="font-scoreboard text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn(
        "font-scoreboard text-lg font-bold num",
        tone === "warning" ? "text-warning-track" : "text-chalk"
      )}>
        {value}
      </div>
    </div>
  );
}

// Helpers
function fmtAvg(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (isNaN(n)) return "—";
  return n.toFixed(3).replace(/^0/, "");
}
function fmtPct(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
}
function fmtNum(v: unknown, decimals: number = 0): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (isNaN(n)) return "—";
  return n.toFixed(decimals);
}
function ops(s: any): number {
  const slg = parseFloat(String(s.slg_percent));
  const obp = parseFloat(String(s.on_base_percent));
  if (isNaN(slg) || isNaN(obp)) return 0;
  return slg + obp;
}
function fmtOps(s: any): string {
  const o = ops(s);
  if (o === 0) return "—";
  return o.toFixed(3).replace(/^0/, "");
}

/** Side-by-side spray chart comparison for two batters */
function SprayChartComparison({ player1Id, player2Id, name1, name2 }: {
  player1Id: number; player2Id: number; name1: string; name2: string;
}) {
  const { data: data1, isLoading: loading1 } = useQuery<{ sprayChart: any[]; player: { batSide?: { code: string } } }>({
    queryKey: ["player-full", player1Id, "batter", null],
    queryFn: async () => {
      const res = await fetch(`/api/player-full/${player1Id}?type=batter`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const { data: data2, isLoading: loading2 } = useQuery<{ sprayChart: any[]; player: { batSide?: { code: string } } }>({
    queryKey: ["player-full", player2Id, "batter", null],
    queryFn: async () => {
      const res = await fetch(`/api/player-full/${player2Id}?type=batter`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  if (loading1 || loading2) {
    return (
      <div className="border-t border-chalk p-4">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-warning-track" />
      </div>
    );
  }

  const spray1 = data1?.sprayChart ?? [];
  const spray2 = data2?.sprayChart ?? [];

  if (spray1.length === 0 && spray2.length === 0) return null;

  return (
    <div className="border-t border-chalk p-4">
      <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
        <Target className="h-4 w-4 text-warning-track" />
        Spray Chart Comparison
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="mb-1 text-center font-scoreboard text-xs uppercase tracking-wide text-cobalt truncate">{name1}</div>
          {spray1.length > 0 ? (
            <SprayChart data={spray1} playerHand={data1?.player?.batSide?.code === "L" ? "L" : "R"} />
          ) : (
            <div className="glass rounded-xl p-8 text-center text-xs text-slate-500">No spray chart data</div>
          )}
        </div>
        <div>
          <div className="mb-1 text-center font-scoreboard text-xs uppercase tracking-wide text-crimson truncate">{name2}</div>
          {spray2.length > 0 ? (
            <SprayChart data={spray2} playerHand={data2?.player?.batSide?.code === "L" ? "L" : "R"} />
          ) : (
            <div className="glass rounded-xl p-8 text-center text-xs text-slate-500">No spray chart data</div>
          )}
        </div>
      </div>
    </div>
  );
}
