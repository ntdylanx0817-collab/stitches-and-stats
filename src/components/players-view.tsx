"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  User, Loader2, ArrowLeft, TrendingUp, Activity,
  MapPin, Weight, Ruler, Calendar, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSavantStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { GlobalPlayerSearch } from "@/components/global-player-search";
import { Skeleton, ErrorState } from "@/components/loading-states";
import { SprayChart } from "@/components/spray-chart";
import { PitchArsenal } from "@/components/pitch-arsenal";
import { BarrelStats } from "@/components/barrel-stats";
import { MatchupStrikeZone } from "@/components/matchup-strike-zone";

interface FullPlayerData {
  player: {
    id: number;
    fullName: string;
    primaryNumber?: string;
    birthDate?: string;
    currentAge?: number;
    height?: string;
    weight?: number;
    birthCity?: string;
    birthStateProvince?: string;
    birthCountry?: string;
    primaryPosition?: { code: string; name: string; abbreviation: string };
    batSide?: { code: string; description: string };
    pitchHand?: { code: string; description: string };
    currentTeam?: { id: number; name: string };
    draftYear?: number;
    mlbDebutDate?: string;
  };
  stats: any | null;
  percentiles: Array<{
    key: string; label: string; value: number | string;
    percentile: number; display?: string; higherIsBetter: boolean;
  }>;
  type: "batter" | "pitcher";
  year: number;
  sprayChart: Array<{
    x: number; y: number; launchSpeed: number | null;
    launchAngle: number | null; distance: number | null;
    event: string; isBarrel: boolean;
  }>;
  pitchMix: Array<{
    name: string; count: number; percentage: number; avgSpeed: number; avgSpin: number;
  }>;
  barrelData: {
    totalBIP: number; totalBarrels: number; barrelPercent: number;
    avgEV: number; maxEV: number; maxLaunchAngle: number;
    avgDistance: number; sweetSpotPercent: number; hardHitPercent: number;
  };
  totalPitches: number;
}

export function PlayersView() {
  const selectedPlayer = useSavantStore((s) => s.selectedPlayer);

  if (!selectedPlayer) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <div className="glass rounded-2xl p-10 text-center">
          <User className="mx-auto mb-4 h-12 w-12 text-slate-500" />
          <h2 className="font-scoreboard mb-2 text-xl font-bold text-chalk uppercase tracking-wide">Search for a player</h2>
          <p className="mb-6 text-sm text-slate-400">
            Search any active MLB player to see their complete Statcast profile — spray charts, pitch mix, percentiles, batted ball metrics, and more.
          </p>
          <div className="mx-auto max-w-md">
            <GlobalPlayerSearch />
          </div>
        </div>
      </div>
    );
  }

  return <FullPlayerProfile playerId={selectedPlayer.id} type={selectedPlayer.type} />;
}

function FullPlayerProfile({ playerId, type }: { playerId: number; type: "batter" | "pitcher" }) {
  const setSelectedPlayer = useSavantStore((s) => s.setSelectedPlayer);
  const { data, isLoading, error, refetch } = useQuery<FullPlayerData>({
    queryKey: ["player-full", playerId, type],
    queryFn: async () => {
      const res = await fetch(`/api/player-full/${playerId}?type=${type}`);
      if (!res.ok) throw new Error("player fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-80 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
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
          description="The MLB Stats API or Statcast may be temporarily unavailable."
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
  const playerHand = p.batSide?.code === "L" ? "L" : p.batSide?.code === "S" ? "S" : "R";

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
      {/* Hero header */}
      <div className="card-broadcast rounded-2xl p-5 mb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-warning-track/25 to-crimson/15 text-2xl font-bold text-chalk font-scoreboard">
              {(p.fullName?.split(" ").map((n) => n[0]).slice(0, 2).join("") ?? "—")}
              {p.primaryNumber && (
                <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-midnight text-xs font-bold text-warning-track border border-warning-track/40">
                  {p.primaryNumber}
                </span>
              )}
            </div>
            <div>
              <h1 className="font-scoreboard text-2xl font-bold text-chalk sm:text-3xl">{p.fullName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                {p.primaryPosition && (
                  <Badge variant="outline" className="border-warning-track/30 bg-warning-track/10 text-warning-track font-scoreboard">
                    {p.primaryPosition.abbreviation}
                  </Badge>
                )}
                {p.currentTeam?.name && <span>{p.currentTeam.name}</span>}
                {p.batSide && <span className="font-scoreboard">B/T: {p.batSide.code}</span>}
                {p.pitchHand && <span className="font-scoreboard">Throws: {p.pitchHand.code}</span>}
                {p.currentAge && <span>{p.currentAge}y</span>}
                {p.mlbDebutDate && (
                  <span className="text-slate-600">Debut: {new Date(p.mlbDebutDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-600 font-scoreboard">
                {p.height && <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> {p.height}</span>}
                {p.weight && <span className="flex items-center gap-1"><Weight className="h-3 w-3" /> {p.weight} lb</span>}
                {p.birthCity && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.birthCity}, {p.birthStateProvince || p.birthCountry}</span>}
                {p.draftYear && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Draft: {p.draftYear}</span>}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedPlayer(null)}
            className="border-chalk bg-midnight/40 hover:bg-white/5"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Close
          </Button>
        </div>
      </div>

      {/* Statcast data disclaimer */}
      {data.totalPitches > 0 && (
        <div className="mb-4 rounded-lg border border-warning-track/20 bg-warning-track/5 px-3 py-2 text-center text-[11px] text-slate-400">
          <span className="font-scoreboard uppercase tracking-wide text-warning-track">{data.totalPitches.toLocaleString()} pitches analyzed</span>
          {" from "}
          <span className="font-bold text-chalk">{data.year}</span>
          {" Statcast · Real pitch-by-pitch data from Baseball Savant"}
        </div>
      )}

      {/* Main grid: 2/3 + 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Percentile Rankings */}
          <div className="glass rounded-2xl p-4">
            <h2 className="font-scoreboard mb-4 flex items-center gap-2 text-base font-bold text-chalk uppercase tracking-wide">
              <Activity className="h-5 w-5 text-warning-track" />
              Statcast Percentile Rankings
            </h2>
            {data.percentiles.length === 0 ? (
              <p className="text-sm text-slate-500">No Statcast data available for this player.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.percentiles.map((m, i) => (
                  <PercentileBar key={m.key} metric={m} index={i} />
                ))}
              </div>
            )}
          </div>

          {/* Season Stats */}
          {stats && (
            <div className="glass rounded-2xl p-4">
              <h2 className="font-scoreboard mb-4 flex items-center gap-2 text-base font-bold text-chalk uppercase tracking-wide">
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
                      ["PA", fmtNum(stats.pa), "default"],
                      ["K%", fmtPct(stats.k_percent), "default"],
                      ["BB%", fmtPct(stats.bb_percent), "default"],
                      ["Barrel%", fmtPct(stats.barrel_brea), "crimson"],
                      ["HardHit%", fmtPct(stats.hard_hit_percent), "amber"],
                      ["Avg EV", fmtMph(stats.avg_hit_speed), "crimson"],
                      ["Max EV", fmtMph(stats.max_hit_speed), "crimson"],
                    ] as const).map(([label, val, tone], i) => (
                      <StatCard key={i} label={label} value={val} tone={tone as any} />
                    ))
                  : ([
                      ["ERA", fmtNum(stats.p_era, 2), "default"],
                      ["WHIP", fmtNum(stats.p_whip, 2), "default"],
                      ["K%", fmtPct(stats.k_percent), "mint"],
                      ["BB%", fmtPct(stats.bb_percent), "default"],
                      ["AVG", fmtAvg(stats.avg), "default"],
                      ["xwOBA", fmtAvg(stats.xwoba), "mint"],
                      ["xBA", fmtAvg(stats.xba), "mint"],
                      ["Whiff%", fmtPct(stats.whiff_percent), "mint"],
                      ["CSW%", fmtPct(stats.csw_percent), "mint"],
                      ["Barrel%", fmtPct(stats.barrel_brea), "mint"],
                      ["HardHit%", fmtPct(stats.hard_hit_percent), "mint"],
                      ["Avg EV", fmtMph(stats.avg_hit_speed), "mint"],
                    ] as const).map(([label, val, tone], i) => (
                      <StatCard key={i} label={label} value={val} tone={tone as any} />
                    ))
                }
              </div>
            </div>
          )}

          {/* Spray Chart + Batted Ball Metrics (batters only) */}
          {isBatter && data.sprayChart.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SprayChart data={data.sprayChart} playerHand={playerHand} />
              <BarrelStats data={data.barrelData} />
            </div>
          )}

          {/* Real Zone Data (for batters) */}
          {isBatter && (
            <MatchupStrikeZone
              batterId={p.id}
              batterName={p.fullName}
              pitcherId={0}
              pitcherName="League Average"
            />
          )}
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-4">
          {/* Pitch Arsenal / Pitches Seen */}
          {data.pitchMix.length > 0 && (
            <PitchArsenal data={data.pitchMix} isPitcher={!isBatter} />
          )}

          {/* Quick bio stats */}
          <div className="glass rounded-2xl p-4">
            <h3 className="font-scoreboard mb-3 text-sm font-bold text-chalk uppercase tracking-wide">Bio</h3>
            <div className="space-y-1.5 text-xs">
              {p.birthDate && (
                <BioRow label="Born" value={`${p.birthCity || ""}, ${p.birthStateProvince || p.birthCountry || ""}`} sub={new Date(p.birthDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} />
              )}
              {p.currentAge && <BioRow label="Age" value={`${p.currentAge} years`} />}
              {p.height && <BioRow label="Height" value={p.height} />}
              {p.weight && <BioRow label="Weight" value={`${p.weight} lb`} />}
              {p.primaryPosition && <BioRow label="Position" value={p.primaryPosition.name} />}
              {p.batSide && <BioRow label="Bats" value={p.batSide.description} />}
              {p.pitchHand && <BioRow label="Throws" value={p.pitchHand.description} />}
              {p.mlbDebutDate && <BioRow label="MLB Debut" value={new Date(p.mlbDebutDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PercentileBar({ metric, index }: {
  metric: { key: string; label: string; value: number | string; percentile: number; display?: string; higherIsBetter: boolean };
  index: number;
}) {
  const pct = metric.percentile;
  const tone =
    pct >= 90 ? "crimson" : pct >= 75 ? "amber" : pct >= 50 ? "warning-track" : pct >= 25 ? "cobalt" : "mint";
  const toneColor =
    tone === "crimson" ? "#FF3B5C" : tone === "amber" ? "#FFB547" : tone === "warning-track" ? "#e67e22" : tone === "cobalt" ? "#4DA3FF" : "#3DDBA0";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5), type: "spring", stiffness: 220, damping: 26 }}
      className="rounded-xl border border-chalk bg-midnight/40 p-3 transition-all hover:border-chalk-strong"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-scoreboard text-[9px] uppercase tracking-wide text-slate-500">{metric.label}</div>
          <div className="font-scoreboard text-lg font-bold num" style={{ color: toneColor }}>
            {metric.display ?? String(metric.value)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-scoreboard text-2xl font-black num leading-none" style={{ color: toneColor, textShadow: `0 0 12px ${toneColor}80` }}>
            {pct}
          </div>
          <div className="text-[8px] uppercase tracking-wide text-slate-600 font-scoreboard">pctile</div>
        </div>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-midnight mt-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: Math.min(index * 0.04, 0.5) + 0.1, duration: 0.7, ease: "easeOut" }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: `linear-gradient(90deg, ${toneColor}40, ${toneColor})`, boxShadow: `0 0 8px ${toneColor}80` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "cobalt" | "crimson" | "amber" | "mint" | "warning-track" }) {
  const toneCls = {
    default: "text-chalk",
    cobalt: "text-cobalt",
    crimson: "text-crimson",
    amber: "text-amber",
    mint: "text-mint",
    "warning-track": "text-warning-track",
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-chalk bg-midnight/40 p-3 text-center hover-lift"
    >
      <div className="font-scoreboard text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("font-scoreboard text-lg font-bold num", toneCls)}>{value}</div>
    </motion.div>
  );
}

function BioRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-chalk pb-1.5">
      <span className="font-scoreboard text-slate-500 uppercase tracking-wide text-[10px]">{label}</span>
      <div className="text-right">
        <span className="text-slate-300">{value}</span>
        {sub && <div className="text-[10px] text-slate-600">{sub}</div>}
      </div>
    </div>
  );
}

// Helpers
function calcOPS(slg?: string | number, obp?: string | number): string {
  if (slg == null || obp == null) return "—";
  const s = typeof slg === "number" ? slg : parseFloat(String(slg));
  const o = typeof obp === "number" ? obp : parseFloat(String(obp));
  if (isNaN(s) || isNaN(o)) return "—";
  return (s + o).toFixed(3).replace(/^0/, "");
}
function fmtAvg(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (isNaN(n)) return "—";
  return n.toFixed(3).replace(/^0/, "");
}
function fmtNum(v: unknown, decimals: number = 0): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (isNaN(n)) return "—";
  return n.toFixed(decimals);
}
function fmtPct(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
}
function fmtMph(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (isNaN(n)) return "—";
  return `${n.toFixed(1)} mph`;
}
