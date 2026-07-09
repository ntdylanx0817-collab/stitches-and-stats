"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords, Search, Loader2, Zap, Target, TrendingUp, Activity,
  ArrowRight, RefreshCw, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton, ErrorState, EmptyState } from "@/components/loading-states";
import { MatchupStrikeZone } from "@/components/matchup-strike-zone";
import { cn } from "@/lib/utils";

interface PlayerOption {
  player_id: number;
  player_name: string;
  team?: string;
  pa?: number;
  avg?: string;
  woba?: string;
  xwoba?: string;
  home_run?: number;
  k_percent?: number;
  bb_percent?: number;
  avg_hit_speed?: number;
  barrel_brea?: number;
  // pitcher fields (p_ prefix for ERA/WHIP, non-p_ for the rest)
  p_era?: number | string;
  p_whip?: number | string;
  era?: number | string;
  whip?: number | string;
}

interface SimResult {
  batterId: number;
  batterName: string;
  pitcherId: number;
  pitcherName: string;
  year: number;
  iterations: number;
  outcomes: {
    strikeout: number; walk: number; hitByPitch: number;
    single: number; double: number; triple: number;
    homeRun: number; outInPlay: number;
  };
  probabilities: {
    strikeout: number; walk: number; hitByPitch: number;
    single: number; double: number; triple: number;
    homeRun: number; outInPlay: number;
    onBase: number; sluggingEvents: number;
    expectedBA: number; expectedOBP: number; expectedSLG: number; expectedOPS: number;
  };
  batterStats: any;
  pitcherStats: any;
  matchupInsight: string;
}

export function SimulatorView() {
  const [batterSearch, setBatterSearch] = useState("");
  const [pitcherSearch, setPitcherSearch] = useState("");
  const [selectedBatter, setSelectedBatter] = useState<PlayerOption | null>(null);
  const [selectedPitcher, setSelectedPitcher] = useState<PlayerOption | null>(null);
  const [batterDropdownOpen, setBatterDropdownOpen] = useState(false);
  const [pitcherDropdownOpen, setPitcherDropdownOpen] = useState(false);

  // Fetch batter leaderboard (current season)
  const { data: batterData } = useQuery<{ rows: PlayerOption[]; year: number }>({
    queryKey: ["sim-batters"],
    queryFn: async () => {
      const res = await fetch("/api/leaderboard?type=batter&min=50");
      if (!res.ok) throw new Error("batter fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  // Fetch pitcher leaderboard (current season)
  const { data: pitcherData } = useQuery<{ rows: PlayerOption[]; year: number }>({
    queryKey: ["sim-pitchers"],
    queryFn: async () => {
      const res = await fetch("/api/leaderboard?type=pitcher&min=10");
      if (!res.ok) throw new Error("pitcher fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const batters = batterData?.rows ?? [];
  const pitchers = pitcherData?.rows ?? [];
  const season = batterData?.year ?? pitcherData?.year ?? new Date().getFullYear();

  // Filter batters by search
  const filteredBatters = useMemo(() => {
    if (!batterSearch.trim()) return batters.slice(0, 50);
    const q = batterSearch.toLowerCase();
    return batters.filter((b) => b.player_name?.toLowerCase().includes(q)).slice(0, 50);
  }, [batters, batterSearch]);

  // Filter pitchers by search
  const filteredPitchers = useMemo(() => {
    if (!pitcherSearch.trim()) return pitchers.slice(0, 50);
    const q = pitcherSearch.toLowerCase();
    return pitchers.filter((p) => p.player_name?.toLowerCase().includes(q)).slice(0, 50);
  }, [pitchers, pitcherSearch]);

  const canSimulate = selectedBatter && selectedPitcher;

  // Manual simulation state — we don't use useQuery here because refetch()
  // with enabled:false and the same query key doesn't reliably re-run.
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  const handleSimulate = async () => {
    if (!canSimulate || simLoading) return;
    setSimLoading(true);
    setSimError(null);
    try {
      const res = await fetch(
        `/api/simulate?batterId=${selectedBatter!.player_id}&pitcherId=${selectedPitcher!.player_id}&iterations=10000`
      );
      if (!res.ok) throw new Error("simulation failed");
      const data: SimResult = await res.json();
      setSimResult(data);
    } catch (err: any) {
      setSimError(err.message || "Simulation failed");
      setSimResult(null);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      {/* Header */}
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Swords className="h-5 w-5 text-crimson" />
          Matchup Simulator
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Pick a batter and a pitcher to simulate a matchup using {season} Statcast data · 10,000 Monte Carlo iterations
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Batter selector */}
        <PlayerSelector
          label="Batter"
          icon="bat"
          search={batterSearch}
          onSearchChange={(v) => { setBatterSearch(v); setBatterDropdownOpen(true); }}
          dropdownOpen={batterDropdownOpen}
          onDropdownClose={() => setBatterDropdownOpen(false)}
          filteredPlayers={filteredBatters}
          selectedPlayer={selectedBatter}
          onSelect={(p) => { setSelectedBatter(p); setBatterDropdownOpen(false); setBatterSearch(""); }}
          onClear={() => setSelectedBatter(null)}
          isLoading={!batterData}
          renderStats={(p) => (
            <>
              <span className="text-slate-500">AVG {fmtAvg(p.avg)}</span>
              <span className="text-slate-500">wOBA {fmtAvg(p.woba)}</span>
              <span className="text-crimson">HR {p.home_run ?? 0}</span>
              <span className="text-slate-500">K% {fmtPct(p.k_percent)}</span>
            </>
          )}
        />

        {/* Pitcher selector */}
        <PlayerSelector
          label="Pitcher"
          icon="pitch"
          search={pitcherSearch}
          onSearchChange={(v) => { setPitcherSearch(v); setPitcherDropdownOpen(true); }}
          dropdownOpen={pitcherDropdownOpen}
          onDropdownClose={() => setPitcherDropdownOpen(false)}
          filteredPlayers={filteredPitchers}
          selectedPlayer={selectedPitcher}
          onSelect={(p) => { setSelectedPitcher(p); setPitcherDropdownOpen(false); setPitcherSearch(""); }}
          onClear={() => setSelectedPitcher(null)}
          isLoading={!pitcherData}
          renderStats={(p) => (
            <>
              <span className="text-slate-500">ERA {fmtNum(p.p_era ?? p.era, 2)}</span>
              <span className="text-slate-500">WHIP {fmtNum(p.p_whip ?? p.whip, 2)}</span>
              <span className="text-mint">K% {fmtPct(p.k_percent)}</span>
              <span className="text-slate-500">BB% {fmtPct(p.bb_percent)}</span>
            </>
          )}
        />
      </div>

      {/* Simulate button */}
      <div className="mt-4 flex justify-center">
        <Button
          onClick={handleSimulate}
          disabled={!canSimulate || simLoading}
          className="bg-gradient-to-r from-crimson to-cobalt text-white font-bold px-8 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {simLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Simulating…</>
          ) : (
            <><Zap className="mr-2 h-4 w-4" fill="currentColor" /> Simulate Matchup</>
          )}
        </Button>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {simLoading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mt-6 glass rounded-2xl p-8">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-cobalt" />
              <p className="text-center text-sm text-slate-400">Running 10,000 simulated at-bats…</p>
            </div>
          </motion.div>
        )}

        {simError && !simLoading && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6">
            <ErrorState
              title="Simulation failed"
              description="Make sure both players have current-season Statcast data."
            />
          </motion.div>
        )}

        {simResult && !simLoading && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 space-y-4"
          >
            <SimulationResults result={simResult} onRerun={handleSimulate} />
          </motion.div>
        )}

        {!simResult && !simLoading && !simError && canSimulate && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
            <div className="glass rounded-2xl p-6 text-center text-sm text-slate-400">
              <Swords className="mx-auto mb-2 h-6 w-6 text-slate-500" />
              Ready to simulate. Click "Simulate Matchup" above.
            </div>
          </motion.div>
        )}

        {!canSimulate && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
            <EmptyState
              icon={Swords}
              title="Select a batter and a pitcher"
              description="Search for and select one batter and one pitcher above, then click Simulate Matchup to see the projected outcome."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Player Selector Component =====
function PlayerSelector({
  label, icon, search, onSearchChange, dropdownOpen, onDropdownClose,
  filteredPlayers, selectedPlayer, onSelect, onClear, isLoading, renderStats,
}: {
  label: string;
  icon: "bat" | "pitch";
  search: string;
  onSearchChange: (v: string) => void;
  dropdownOpen: boolean;
  onDropdownClose: () => void;
  filteredPlayers: PlayerOption[];
  selectedPlayer: PlayerOption | null;
  onSelect: (p: PlayerOption) => void;
  onClear: () => void;
  isLoading: boolean;
  renderStats: (p: PlayerOption) => React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-4 relative z-10">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          {icon === "bat" ? (
            <TrendingUp className="h-4 w-4 text-cobalt" />
          ) : (
            <Target className="h-4 w-4 text-mint" />
          )}
          {label}
        </h3>
        {selectedPlayer && (
          <button onClick={onClear} className="text-slate-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {selectedPlayer ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
              icon === "bat" ? "bg-gradient-to-br from-cobalt/30 to-crimson/20" : "bg-gradient-to-br from-mint/30 to-cobalt/20"
            )}>
              {selectedPlayer.player_name?.split(",").map((s) => s.trim()[0] ?? "").join("").slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">{selectedPlayer.player_name}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                {renderStats(selectedPlayer)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => onDropdownClose()}
            placeholder={`Search for a ${label.toLowerCase()}…`}
            className="h-10 rounded-lg border-white/10 bg-white/[0.03] pl-9"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
          )}
          <AnimatePresence>
            {dropdownOpen && filteredPlayers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="glass-strong absolute left-0 right-0 z-[100] mt-2 max-h-[320px] w-full overflow-y-auto rounded-xl p-1.5 scrollbar-thin"
                style={{ position: "absolute" }}
              >
                {filteredPlayers.map((p) => (
                  <button
                    key={p.player_id}
                    onClick={() => onSelect(p)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="truncate text-sm font-medium text-white">{p.player_name}</span>
                    <span className="flex shrink-0 gap-2 text-[10px] text-slate-500">
                      {icon === "bat" ? (
                        <><span>{fmtAvg(p.woba)}</span><span className="text-crimson">{p.home_run}HR</span></>
                      ) : (
                        <><span>{fmtNum(p.p_era ?? p.era, 2)} ERA</span><span className="text-mint">{fmtPct(p.k_percent)}K</span></>
                      )}
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

// ===== Simulation Results Component =====
function SimulationResults({ result, onRerun }: { result: SimResult; onRerun: () => void }) {
  const probs = result.probabilities;
  const outcomes = result.outcomes;

  // Outcome labels and colors for the chart
  const outcomeData = [
    { key: "strikeout", label: "Strikeout", count: outcomes.strikeout, prob: probs.strikeout, color: "#FF3B5C" },
    { key: "walk", label: "Walk", count: outcomes.walk, prob: probs.walk, color: "#4DA3FF" },
    { key: "hitByPitch", label: "HBP", count: outcomes.hitByPitch, prob: probs.hitByPitch, color: "#A78BFA" },
    { key: "outInPlay", label: "Out in Play", count: outcomes.outInPlay, prob: probs.outInPlay, color: "#64748B" },
    { key: "single", label: "Single", count: outcomes.single, prob: probs.single, color: "#3DDBA0" },
    { key: "double", label: "Double", count: outcomes.double, prob: probs.double, color: "#FFB547" },
    { key: "triple", label: "Triple", count: outcomes.triple, prob: probs.triple, color: "#FF8E72" },
    { key: "homeRun", label: "Home Run", count: outcomes.homeRun, prob: probs.homeRun, color: "#FF3B5C" },
  ].sort((a, b) => b.prob - a.prob);

  return (
    <div className="space-y-4">
      {/* Matchup header */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-4">
          {/* Batter */}
          <div className="flex-1 text-center">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Batter</div>
            <div className="text-lg font-bold text-white">{result.batterName}</div>
            <div className="mt-1 text-xs text-slate-400">
              {result.batterStats.kPercent.toFixed(1)}% K · {result.batterStats.bbPercent.toFixed(1)}% BB · {fmtAvg(result.batterStats.battingAvg)} AVG
            </div>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center">
            <div className="text-2xl font-black text-crimson">VS</div>
            <div className="text-[10px] text-slate-600">10K sims</div>
          </div>

          {/* Pitcher */}
          <div className="flex-1 text-center">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Pitcher</div>
            <div className="text-lg font-bold text-white">{result.pitcherName}</div>
            <div className="mt-1 text-xs text-slate-400">
              {result.pitcherStats.era.toFixed(2)} ERA · {result.pitcherStats.kPercent.toFixed(1)}% K · {fmtAvg(result.pitcherStats.avg)} opp AVG
            </div>
          </div>
        </div>

        {/* Insight */}
        <div className="mt-4 rounded-xl border border-cobalt/20 bg-cobalt/5 p-3">
          <div className="flex items-start gap-2">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-cobalt" />
            <p className="text-xs leading-relaxed text-slate-300">{result.matchupInsight}</p>
          </div>
        </div>
      </div>

      {/* Expected stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Expected AVG" value={result.probabilities.expectedBA.toFixed(3).replace(/^0/, "")} tone="default" />
        <StatBox label="Expected OBP" value={result.probabilities.expectedOBP.toFixed(3).replace(/^0/, "")} tone="cobalt" />
        <StatBox label="Expected SLG" value={result.probabilities.expectedSLG.toFixed(3).replace(/^0/, "")} tone="amber" />
        <StatBox label="Expected OPS" value={result.probabilities.expectedOPS.toFixed(3).replace(/^0/, "")} tone="crimson" />
      </div>

      {/* Outcome distribution */}
      <div className="glass rounded-2xl p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <Target className="h-4 w-4 text-crimson" />
          Outcome Distribution
          <span className="ml-auto text-[10px] font-normal text-slate-500">
            {result.iterations.toLocaleString()} simulated at-bats
          </span>
        </h3>
        <div className="space-y-2.5">
          {outcomeData.map((o) => (
            <div key={o.key} className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-xs font-medium text-slate-300">{o.label}</div>
              <div className="flex-1 h-6 overflow-hidden rounded-md bg-white/5 relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(o.prob * 100, 0.5)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-md flex items-center justify-end pr-2"
                  style={{ backgroundColor: o.color, boxShadow: `0 0 8px ${o.color}40` }}
                >
                  <span className="text-[10px] font-bold text-white">
                    {(o.prob * 100).toFixed(1)}%
                  </span>
                </motion.div>
              </div>
              <div className="w-16 shrink-0 text-right text-[10px] text-slate-500 num">
                {o.count.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Matchup Strike Zone */}
      <MatchupStrikeZone
        batterStats={{
          avgExitVelo: result.batterStats.avgExitVelo,
          barrelPercent: result.batterStats.barrelPercent,
          hardHitPercent: result.batterStats.hardHitPercent,
          battingAvg: result.batterStats.battingAvg,
          slg: result.batterStats.slg,
        }}
        pitcherStats={{
          avgExitVelo: result.pitcherStats.avgExitVelo,
          barrelPercent: result.pitcherStats.barrelPercent,
          hardHitPercent: result.pitcherStats.hardHitPercent,
          avg: result.pitcherStats.avg,
        }}
      />

      {/* Rerun button */}
      <div className="flex justify-center">
        <Button
          onClick={onRerun}
          variant="outline"
          className="border-white/10 bg-white/[0.02] hover:bg-white/5"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Rerun Simulation
        </Button>
      </div>
    </div>
  );
}

function StatBox({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "cobalt" | "crimson" | "amber" | "mint" }) {
  const toneCls = {
    default: "text-white",
    cobalt: "text-cobalt",
    crimson: "text-crimson",
    amber: "text-amber",
    mint: "text-mint",
  }[tone];
  return (
    <div className="glass rounded-xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("text-2xl font-bold num", toneCls)}>{value}</div>
    </div>
  );
}

// ===== Helpers =====
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
