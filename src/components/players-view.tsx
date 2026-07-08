"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  User, Loader2, ArrowLeft, TrendingUp, Activity,
  MapPin, Weight, Ruler,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSavantStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { GlobalPlayerSearch } from "@/components/global-player-search";
import { Skeleton, ErrorState, EmptyState } from "@/components/loading-states";

interface PlayerStats {
  player: {
    id: number;
    fullName: string;
    primaryNumber?: string;
    currentAge?: number;
    height?: string;
    weight?: number;
    birthCity?: string;
    birthCountry?: string;
    primaryPosition?: { code: string; name: string; abbreviation: string };
    batSide?: { code: string; description: string };
    pitchHand?: { code: string; description: string };
    currentTeam?: { id: number; name: string };
  };
  stats: any | null;
  percentiles: Array<{
    key: string;
    label: string;
    value: number | string;
    percentile: number;
    display?: string;
    higherIsBetter: boolean;
  }>;
  type: "batter" | "pitcher";
  year: number;
}

export function PlayersView() {
  const selectedPlayer = useSavantStore((s) => s.selectedPlayer);
  const setView = useSavantStore((s) => s.setView);

  if (!selectedPlayer) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <div className="glass rounded-2xl p-10 text-center">
          <User className="mx-auto mb-4 h-12 w-12 text-slate-500" />
          <h2 className="mb-2 text-xl font-bold text-white">Search for a player</h2>
          <p className="mb-6 text-sm text-slate-400">
            Use the search bar above to find any active MLB player and view their Statcast percentile rankings.
          </p>
          <div className="mx-auto max-w-md">
            <GlobalPlayerSearch />
          </div>
        </div>
      </div>
    );
  }

  return <PlayerProfile playerId={selectedPlayer.id} type={selectedPlayer.type} />;
}

function PlayerProfile({ playerId, type }: { playerId: number; type: "batter" | "pitcher" }) {
  const setSelectedPlayer = useSavantStore((s) => s.setSelectedPlayer);
  const { data, isLoading, error, refetch } = useQuery<PlayerStats>({
    queryKey: ["player-profile", playerId, type],
    queryFn: async () => {
      const res = await fetch(`/api/player/${playerId}?type=${type}`);
      if (!res.ok) throw new Error("player fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {/* Hero skeleton */}
        <div className="glass rounded-2xl p-5 mb-4">
          <div className="flex items-start gap-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        </div>
        {/* Percentile skeleton */}
        <div className="glass rounded-2xl p-5 mb-4">
          <Skeleton className="mb-4 h-5 w-56" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                <div className="mb-2 flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-8" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="glass rounded-2xl p-5">
          <Skeleton className="mb-4 h-5 w-40" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
                <Skeleton className="mx-auto mb-1 h-2 w-10" />
                <Skeleton className="mx-auto h-5 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data || !data.player) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <ErrorState
          title="Couldn't load player profile"
          description="The MLB Stats API or Statcast leaderboard may be temporarily unavailable."
          onRetry={() => refetch()}
        />
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" onClick={() => setSelectedPlayer(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to search
          </Button>
        </div>
      </div>
    );
  }

  const p = data.player;
  const stats = data.stats;
  const isBatter = type === "batter";

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      {/* Hero header */}
      <div className="glass rounded-2xl p-5 mb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cobalt/30 to-crimson/20 text-3xl font-black text-white">
              {(p.fullName?.split(" ").map((n) => n[0]).slice(0, 2).join("") ?? "—")}
              {p.primaryNumber && (
                <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#0B0F19] text-xs font-bold text-cobalt border border-cobalt/40">
                  {p.primaryNumber}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">{p.fullName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                {p.primaryPosition && (
                  <Badge variant="outline" className="border-cobalt/30 bg-cobalt/10 text-cobalt">
                    {p.primaryPosition.abbreviation}
                  </Badge>
                )}
                {p.currentTeam?.name && <span>{p.currentTeam.name}</span>}
                {p.batSide && <span>B/T: {p.batSide.code}</span>}
                {p.pitchHand && <span>Throws: {p.pitchHand.code}</span>}
                {p.currentAge && <span>{p.currentAge}y</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                {p.height && <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> {p.height}</span>}
                {p.weight && <span className="flex items-center gap-1"><Weight className="h-3 w-3" /> {p.weight} lb</span>}
                {p.birthCity && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.birthCity}, {p.birthCountry}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedPlayer(null)}
              className="border-white/10 bg-white/[0.02] hover:bg-white/5"
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Close
            </Button>
          </div>
        </div>
      </div>

      {/* Statcast Percentile Rankings */}
      <div className="glass rounded-2xl p-5 mb-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-white">
            <Activity className="h-5 w-5 text-cobalt" />
            Statcast Percentile Rankings
          </h2>
          <div className="text-xs text-slate-400">
            {data.year} · {isBatter ? "Batter" : "Pitcher"} · vs Qualified MLB
          </div>
        </div>

        {data.percentiles.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-sm text-slate-400">
            No Statcast data available for this player in {data.year}.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.percentiles.map((m, i) => (
              <PercentileBar key={m.key} metric={m} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Standard season stats */}
      {stats && (
        <div className="glass rounded-2xl p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
            <TrendingUp className="h-5 w-5 text-mint" />
            {data.year} Season Stats
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {isBatter
              ? ([
                  ["AVG", fmtAvg(stats.batting_avg), "default"],
                  ["OBP", fmtAvg(stats.on_base_percent), "default"],
                  ["SLG", fmtAvg(stats.slg_percent), "default"],
                  ["OPS", calcOPS(stats.slg_percent, stats.on_base_percent), "default"],
                  ["wOBA", fmtAvg(stats.woba), "cobalt"],
                  ["xwOBA", fmtAvg(stats.xwoba), "mint"],
                  ["xBA", fmtAvg(stats.xba), "mint"],
                  ["xSLG", fmtAvg(stats.xslg), "mint"],
                  ["HR", fmtNum(stats.home_run), "crimson"],
                  ["RBI", "—", "default"],
                  ["SB", "—", "default"],
                  ["PA", fmtNum(stats.pa), "default"],
                  ["K%", fmtPct(stats.k_percent), "default"],
                  ["BB%", fmtPct(stats.bb_percent), "default"],
                  ["Barrel%", fmtPct(stats.barrel_brea), "crimson"],
                  ["Hard Hit%", fmtPct(stats.hard_hit_percent), "amber"],
                  ["Avg EV", fmtMph(stats.avg_hit_speed), "crimson"],
                  ["Max EV", fmtMph(stats.max_hit_speed), "crimson"],
                ] as const).map(([label, val, tone], i) => (
                  <StatCard key={i} label={label} value={val} tone={tone as any} />
                ))
              : ([
                  ["ERA", fmtNum(stats.p_era, 2), "default"],
                  ["WHIP", fmtNum(stats.p_whip, 2), "default"],
                  ["IP", "—", "default"],
                  ["K", fmtNum(stats.p_k), "default"],
                  ["BB", fmtNum(stats.p_bb), "default"],
                  ["K%", fmtPct(stats.p_k_percent), "mint"],
                  ["BB%", fmtPct(stats.p_bb_percent), "default"],
                  ["K/9", "—", "default"],
                  ["AVG", fmtAvg(stats.p_avg), "default"],
                  ["xwOBA", fmtAvg(stats.p_xwoba), "mint"],
                  ["xBA", fmtAvg(stats.p_xba), "mint"],
                  ["Whiff%", fmtPct(stats.p_whiff_percent), "mint"],
                  ["CSW%", fmtPct(stats.p_csw_percent), "mint"],
                  ["Barrel%", fmtPct(stats.p_barrel_brea), "mint"],
                  ["Hard Hit%", fmtPct(stats.p_hard_hit_percent), "mint"],
                ] as const).map(([label, val, tone], i) => (
                  <StatCard key={i} label={label} value={val} tone={tone as any} />
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

function calcOPS(slg?: string | number, obp?: string | number): string {
  if (slg == null || obp == null) return "—";
  const s = typeof slg === "number" ? slg : parseFloat(slg);
  const o = typeof obp === "number" ? obp : parseFloat(obp);
  if (isNaN(s) || isNaN(o)) return "—";
  return (s + o).toFixed(3).replace(/^0/, "");
}

/** Format a batting average / rate stat like .314 (strips leading 0) */
function fmtAvg(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (isNaN(n)) return "—";
  return n.toFixed(3).replace(/^0/, "");
}

/** Format a plain number with optional decimals */
function fmtNum(v: unknown, decimals: number = 0): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (isNaN(n)) return "—";
  return n.toFixed(decimals);
}

/** Format a percentage value like 23.6% */
function fmtPct(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
}

/** Format a speed value like 99.5 mph */
function fmtMph(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (isNaN(n)) return "—";
  return `${n.toFixed(1)} mph`;
}

function PercentileBar({
  metric,
  index,
}: {
  metric: { key: string; label: string; value: number | string; percentile: number; display?: string; higherIsBetter: boolean };
  index: number;
}) {
  const pct = metric.percentile;
  // Color: high pct = crimson glow, low pct = deep blue, mid = white
  const tone =
    pct >= 90 ? "crimson" :
    pct >= 75 ? "amber" :
    pct >= 50 ? "cobalt" :
    pct >= 25 ? "violet" :
    "deep";

  const toneColor =
    tone === "crimson" ? "#FF3B5C" :
    tone === "amber" ? "#FFB547" :
    tone === "cobalt" ? "#4DA3FF" :
    tone === "violet" ? "#A78BFA" :
    "#3DDBA0";

  const toneGlow =
    tone === "crimson" ? "box-glow-crimson" :
    tone === "cobalt" ? "box-glow-cobalt" :
    tone === "amber" ? "" :
    "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5), type: "spring", stiffness: 220, damping: 26 }}
      className={cn(
        "rounded-xl border border-white/5 bg-white/[0.02] p-3.5 transition-all hover:border-white/10",
        toneGlow
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">{metric.label}</div>
          <div className="text-lg font-bold num" style={{ color: toneColor }}>
            {metric.display ?? String(metric.value)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black num leading-none" style={{ color: toneColor, textShadow: `0 0 12px ${toneColor}80` }}>
            {pct}
          </div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500">pctile</div>
        </div>
      </div>

      {/* Horizontal sliding bar */}
      <div className="relative h-2 overflow-hidden rounded-full bg-white/5 mt-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: Math.min(index * 0.04, 0.5) + 0.1, duration: 0.7, ease: "easeOut" }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${toneColor}40, ${toneColor})`,
            boxShadow: `0 0 8px ${toneColor}80`,
          }}
        />
        {/* 50% marker */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-slate-600 font-mono">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "cobalt" | "crimson" | "amber" | "mint" }) {
  const toneCls = {
    default: "text-white",
    cobalt: "text-cobalt",
    crimson: "text-crimson",
    amber: "text-amber",
    mint: "text-mint",
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center"
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("text-lg font-bold num", toneCls)}>{value}</div>
    </motion.div>
  );
}
