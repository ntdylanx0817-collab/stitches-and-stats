"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search,
  Filter, User, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSavantStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type SortDir = "asc" | "desc" | null;
interface ColDef {
  key: string;
  label: string;
  short?: string;
  width?: number;
  align?: "left" | "right" | "center";
  format?: (v: any) => string;
  tone?: (v: any) => string;
  group?: "standard" | "advanced";
}

const BATTER_COLS: ColDef[] = [
  { key: "rank", label: "#", width: 40, align: "center", group: "standard" },
  { key: "player_name", label: "Player", short: "Player", align: "left", width: 180, group: "standard" },
  { key: "pa", label: "PA", width: 50, group: "standard" },
  { key: "ab", label: "AB", width: 50, group: "standard" },
  { key: "hit", label: "H", width: 50, group: "standard" },
  { key: "home_run", label: "HR", width: 50, group: "standard" },
  { key: "batting_avg", label: "AVG", short: "AVG", width: 60, group: "standard", format: (v) => v ? String(v).replace(/^0/, "") : "—", tone: (v) => toneAvg(Number(v), 0.250, 0.300) },
  { key: "on_base_percent", label: "OBP", short: "OBP", width: 60, group: "standard", format: (v) => v ? String(v).replace(/^0/, "") : "—", tone: (v) => toneAvg(Number(v), 0.340, 0.380) },
  { key: "slg_percent", label: "SLG", short: "SLG", width: 60, group: "standard", format: (v) => v ? String(v).replace(/^0/, "") : "—", tone: (v) => toneAvg(Number(v), 0.420, 0.500) },
  { key: "woba", label: "wOBA", short: "wOBA", width: 65, group: "standard", format: (v) => v ? String(v).replace(/^0/, "") : "—", tone: (v) => toneAvg(Number(v), 0.320, 0.370) },
  { key: "k_percent", label: "K%", width: 60, group: "standard", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneReverse(Number(v), 25, 18) },
  { key: "bb_percent", label: "BB%", width: 60, group: "standard", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneAvg(Number(v), 8, 12) },
  // Advanced / Statcast
  { key: "xwoba", label: "xwOBA", short: "xwOBA", width: 70, group: "advanced", format: (v) => v ? String(v).replace(/^0/, "") : "—", tone: (v) => toneAvg(Number(v), 0.320, 0.370) },
  { key: "xba", label: "xBA", short: "xBA", width: 65, group: "advanced", format: (v) => v ? String(v).replace(/^0/, "") : "—", tone: (v) => toneAvg(Number(v), 0.250, 0.300) },
  { key: "xslg", label: "xSLG", short: "xSLG", width: 65, group: "advanced", format: (v) => v ? String(v).replace(/^0/, "") : "—", tone: (v) => toneAvg(Number(v), 0.420, 0.500) },
  { key: "barrel_brea", label: "Barrel%", short: "Barrel%", width: 70, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneAvg(Number(v), 7, 12) },
  { key: "hard_hit_percent", label: "HardHit%", short: "HardHit%", width: 80, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneAvg(Number(v), 38, 45) },
  { key: "sweet_spot_percent", label: "SweetSpot%", short: "SweetSpot%", width: 90, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneAvg(Number(v), 32, 38) },
  { key: "avg_hit_speed", label: "Avg EV", short: "Avg EV", width: 75, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}` : "—", tone: (v) => toneAvg(Number(v), 88, 91) },
  { key: "max_hit_speed", label: "Max EV", short: "Max EV", width: 75, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}` : "—", tone: (v) => toneAvg(Number(v), 110, 115) },
  { key: "launch_angle_average", label: "Avg LA", short: "Avg LA", width: 75, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}°` : "—" },
  { key: "whiff_percent", label: "Whiff%", short: "Whiff%", width: 75, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneReverse(Number(v), 28, 22) },
  { key: "oz_swing_percent", label: "O-Swing%", short: "O-Swing%", width: 80, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneReverse(Number(v), 32, 28) },
];

const PITCHER_COLS: ColDef[] = [
  { key: "rank", label: "#", width: 40, align: "center", group: "standard" },
  { key: "player_name", label: "Player", short: "Player", align: "left", width: 180, group: "standard" },
  { key: "p_ip", label: "IP", width: 50, group: "standard", format: (v) => v ? Number(v).toFixed(1) : "—" },
  { key: "p_pa", label: "BF", width: 50, group: "standard" },
  { key: "p_era", label: "ERA", width: 60, group: "standard", format: (v) => v ? Number(v).toFixed(2) : "—", tone: (v) => toneReverse(Number(v), 4.2, 3.5) },
  { key: "p_whip", label: "WHIP", width: 60, group: "standard", format: (v) => v ? Number(v).toFixed(2) : "—", tone: (v) => toneReverse(Number(v), 1.35, 1.15) },
  { key: "p_k", label: "K", width: 50, group: "standard" },
  { key: "p_bb", label: "BB", width: 50, group: "standard" },
  { key: "p_k_percent", label: "K%", width: 60, group: "standard", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneAvg(Number(v), 23, 28) },
  { key: "p_bb_percent", label: "BB%", width: 60, group: "standard", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneReverse(Number(v), 8, 6) },
  { key: "p_avg", label: "AVG", width: 60, group: "standard", format: (v) => v ? String(v).replace(/^0/, "") : "—", tone: (v) => toneReverse(Number(v), 0.250, 0.220) },
  { key: "p_slg", label: "SLG", width: 60, group: "standard", format: (v) => v ? String(v).replace(/^0/, "") : "—", tone: (v) => toneReverse(Number(v), 0.420, 0.350) },
  // Advanced
  { key: "p_xwoba", label: "xwOBA", short: "xwOBA", width: 70, group: "advanced", format: (v) => v ? String(v).replace(/^0/, "") : "—", tone: (v) => toneReverse(Number(v), 0.330, 0.290) },
  { key: "p_xba", label: "xBA", short: "xBA", width: 65, group: "advanced", format: (v) => v ? String(v).replace(/^0/, "") : "—", tone: (v) => toneReverse(Number(v), 0.250, 0.220) },
  { key: "p_hard_hit_percent", label: "HardHit%", short: "HardHit%", width: 80, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneReverse(Number(v), 40, 35) },
  { key: "p_barrel_brea", label: "Barrel%", short: "Barrel%", width: 70, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneReverse(Number(v), 8, 5) },
  { key: "p_avg_hit_speed", label: "Avg EV", short: "Avg EV", width: 75, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}` : "—", tone: (v) => toneReverse(Number(v), 89, 87) },
  { key: "p_whiff_percent", label: "Whiff%", short: "Whiff%", width: 75, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneAvg(Number(v), 26, 30) },
  { key: "p_csw_percent", label: "CSW%", short: "CSW%", width: 70, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneAvg(Number(v), 28, 32) },
  { key: "p_oz_swing_percent", label: "O-Swing%", short: "O-Swing%", width: 80, group: "advanced", format: (v) => v ? `${Number(v).toFixed(1)}%` : "—", tone: (v) => toneReverse(Number(v), 32, 28) },
];

function toneAvg(v: number, mid: number, high: number): string {
  if (isNaN(v)) return "text-slate-400";
  if (v >= high) return "text-mint";
  if (v >= mid) return "text-cobalt";
  if (v < mid - (high - mid)) return "text-crimson";
  return "text-slate-300";
}

function toneReverse(v: number, mid: number, low: number): string {
  if (isNaN(v)) return "text-slate-400";
  if (v <= low) return "text-mint";
  if (v <= mid) return "text-cobalt";
  return "text-crimson";
}

const TEAM_OPTIONS = [
  { value: "", label: "All Teams" },
  { value: "LAA", label: "LAA Angels" }, { value: "HOU", label: "HOU Astros" }, { value: "OAK", label: "ATH Athletics" },
  { value: "TOR", label: "TOR Blue Jays" }, { value: "ATL", label: "ATL Braves" }, { value: "MIL", label: "MIL Brewers" },
  { value: "STL", label: "STL Cardinals" }, { value: "CHC", label: "CHC Cubs" }, { value: "ARI", label: "ARI D-backs" },
  { value: "LAD", label: "LAD Dodgers" }, { value: "SF", label: "SF Giants" }, { value: "CLE", label: "CLE Guardians" },
  { value: "SEA", label: "SEA Mariners" }, { value: "MIA", label: "MIA Marlins" }, { value: "NYM", label: "NYM Mets" },
  { value: "NYY", label: "NYY Yankees" }, { value: "PHI", label: "PHI Phillies" }, { value: "PIT", label: "PIT Pirates" },
  { value: "SD", label: "SD Padres" }, { value: "TEX", label: "TEX Rangers" }, { value: "TB", label: "TB Rays" },
  { value: "BOS", label: "BOS Red Sox" }, { value: "CIN", label: "CIN Reds" }, { value: "COL", label: "COL Rockies" },
  { value: "KC", label: "KC Royals" }, { value: "DET", label: "DET Tigers" }, { value: "MIN", label: "MIN Twins" },
  { value: "CWS", label: "CWS White Sox" }, { value: "BAL", label: "BAL Orioles" }, { value: "WSH", label: "WSH Nationals" },
];

const POSITION_OPTIONS = [
  { value: "", label: "All Positions" },
  { value: "C", label: "Catcher" },
  { value: "1B", label: "First Base" },
  { value: "2B", label: "Second Base" },
  { value: "3B", label: "Third Base" },
  { value: "SS", label: "Shortstop" },
  { value: "LF", label: "Left Field" },
  { value: "CF", label: "Center Field" },
  { value: "RF", label: "Right Field" },
  { value: "DH", label: "Designated Hitter" },
  { value: "P", label: "Pitcher" },
];

const PAGE_SIZE = 50;

export function LeaderboardsView() {
  const {
    lbType, setLbType,
    lbYear, setLbYear,
    lbMin, setLbMin,
    lbTeam, setLbTeam,
    lbPosition, setLbPosition,
    lbShowAdvanced, setLbShowAdvanced,
    setSelectedPlayer, setView,
  } = useSavantStore();

  const [sortKey, setSortKey] = useState<string>(lbType === "batter" ? "woba" : "p_era");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Track filter signature to reset pagination & sort on filter change
  const filterSig = `${lbType}|${lbYear}|${lbMin}|${lbTeam}|${lbPosition}|${search}`;
  const [lastFilterSig, setLastFilterSig] = useState(filterSig);
  if (lastFilterSig !== filterSig) {
    setLastFilterSig(filterSig);
    setVisibleCount(PAGE_SIZE);
    // Reset sort to a sensible default for the new type
    if (lbType === "batter") {
      setSortKey("woba");
      setSortDir("desc");
    } else {
      setSortKey("p_era");
      setSortDir("asc");
    }
  }

  const { data, isLoading, error } = useQuery<{ rows: any[]; total: number; year: number; type: string }>({
    queryKey: ["leaderboard", lbType, lbYear, lbMin, lbTeam, lbPosition],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: lbType, year: String(lbYear), min: String(lbMin),
        team: lbTeam, position: lbPosition, gameType: "Regular",
      });
      const res = await fetch(`/api/leaderboard?${params}`);
      if (!res.ok) throw new Error("leaderboard fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const cols = lbType === "batter" ? BATTER_COLS : PITCHER_COLS;
  const visibleCols = cols.filter((c) => c.group === "standard" || lbShowAdvanced);

  const rows = useMemo(() => {
    let r = (data?.rows ?? []).slice();
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row) => String(row.player_name ?? "").toLowerCase().includes(q));
    }
    // Sort
    if (sortKey && sortDir) {
      r.sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const an = Number(av);
        const bn = Number(bv);
        if (!isNaN(an) && !isNaN(bn)) {
          return sortDir === "asc" ? an - bn : bn - an;
        }
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    } else if (lbType === "batter") {
      // default sort by woba desc
      r.sort((a, b) => (Number(b.woba) || 0) - (Number(a.woba) || 0));
    } else {
      r.sort((a, b) => (Number(a.p_era) || 99) - (Number(b.p_era) || 99));
    }
    return r;
  }, [data?.rows, search, sortKey, sortDir, lbType]);

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
    } else if (sortDir === "desc") setSortDir("asc");
    else if (sortDir === "asc") setSortDir(null);
    else setSortDir("desc");
  };

  const openPlayer = (row: any) => {
    setSelectedPlayer({
      id: Number(row.player_id),
      name: String(row.player_name ?? ""),
      type: lbType,
    });
    setView("players");
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      {/* Filters bar */}
      <div className="glass rounded-2xl p-4 mb-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Filter className="h-4 w-4 text-cobalt" /> Statcast Leaderboards
          </h2>
          <Badge variant="outline" className="border-white/10 text-[10px] text-slate-400">
            {data?.total ?? 0} players
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Type toggle */}
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-slate-500">Type</Label>
            <div className="mt-1 flex rounded-lg border border-white/5 bg-white/[0.02] p-0.5">
              <button
                onClick={() => setLbType("batter")}
                className={cn("flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  lbType === "batter" ? "bg-cobalt/20 text-cobalt" : "text-slate-400 hover:text-white")}
              >
                Batters
              </button>
              <button
                onClick={() => setLbType("pitcher")}
                className={cn("flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  lbType === "pitcher" ? "bg-mint/20 text-mint" : "text-slate-400 hover:text-white")}
              >
                Pitchers
              </button>
            </div>
          </div>

          {/* Year */}
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-slate-500">Season</Label>
            <Select value={String(lbYear)} onValueChange={(v) => setLbYear(Number(v))}>
              <SelectTrigger className="mt-1 h-9 bg-white/[0.02] border-white/5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Min PA */}
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-slate-500">
              Min {lbType === "batter" ? "PA" : "BF"}: <span className="text-cobalt num">{lbMin}</span>
            </Label>
            <Slider
              value={[lbMin]}
              onValueChange={(v) => setLbMin(v[0])}
              min={1}
              max={500}
              step={1}
              className="mt-3"
            />
          </div>

          {/* Team */}
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-slate-500">Team</Label>
            <Select value={lbTeam} onValueChange={setLbTeam}>
              <SelectTrigger className="mt-1 h-9 bg-white/[0.02] border-white/5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {TEAM_OPTIONS.map((t) => (
                  <SelectItem key={t.value || "all"} value={t.value || "all"}>
                    {t.value === "" || t.value === "all" ? "All Teams" : t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Position */}
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-slate-500">Position</Label>
            <Select value={lbPosition || "all"} onValueChange={(v) => setLbPosition(v === "all" ? "" : v)}>
              <SelectTrigger className="mt-1 h-9 bg-white/[0.02] border-white/5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITION_OPTIONS.map((p) => (
                  <SelectItem key={p.value || "all"} value={p.value || "all"}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search + Advanced toggle */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-6 flex flex-wrap items-end gap-3 mt-1">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by player name…"
                className="h-9 rounded-lg border-white/5 bg-white/[0.02] pl-9"
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5">
              <Switch checked={lbShowAdvanced} onCheckedChange={setLbShowAdvanced} />
              <Label className="text-xs font-medium text-slate-300 cursor-pointer">
                Statcast Columns
              </Label>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-cobalt" /> Loading leaderboard…
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-crimson">
            Failed to load leaderboard. Please try again.
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px] overflow-x-auto scrollbar-thin">
            <table className="w-full text-xs num">
              <thead className="sticky top-0 z-20 bg-[#0B0F19]/95 backdrop-blur">
                <tr className="border-b border-white/10">
                  {visibleCols.map((col) => {
                    const isSortable = col.key !== "rank" && col.key !== "player_name";
                    const isSorted = sortKey === col.key && sortDir;
                    return (
                      <th
                        key={col.key}
                        style={{ minWidth: col.width ?? 60, textAlign: col.align ?? "right" }}
                        className={cn(
                          "px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide",
                          isSortable ? "cursor-pointer hover:bg-white/5 select-none" : "",
                          col.key === "player_name" && "sticky left-0 z-10 bg-[#0B0F19]/95 backdrop-blur",
                          col.key === "rank" && "bg-[#0B0F19]/95 backdrop-blur"
                        )}
                        onClick={isSortable ? () => handleSort(col.key) : undefined}
                      >
                        <span className={cn("inline-flex items-center gap-1", col.align === "left" ? "" : "justify-end")}>
                          {col.short ?? col.label}
                          {isSortable && (
                            isSorted === "desc" ? <ArrowDown className="h-3 w-3 text-cobalt" />
                            : isSorted === "asc" ? <ArrowUp className="h-3 w-3 text-cobalt" />
                            : <ArrowUpDown className="h-3 w-3 text-slate-600" />
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, visibleCount).map((row, idx) => (
                  <motion.tr
                    key={`${row.player_id}-${idx}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.005, 0.3) }}
                    className="border-b border-white/5 hover:bg-cobalt/[0.04] cursor-pointer transition-colors group"
                    onClick={() => openPlayer(row)}
                  >
                    {visibleCols.map((col) => {
                      let val: any;
                      if (col.key === "rank") val = idx + 1;
                      else val = row[col.key];
                      const display = col.format ? col.format(val) : (val ?? "—");
                      const tone = col.tone ? col.tone(val) : "text-slate-200";
                      return (
                        <td
                          key={col.key}
                          style={{ textAlign: col.align ?? "right" }}
                          className={cn(
                            "px-2.5 py-2 whitespace-nowrap",
                            col.key === "player_name" && "sticky left-0 z-10 bg-[#0B0F19]/95 backdrop-blur group-hover:bg-[#0E1421]/95",
                            col.key === "rank" && "bg-[#0B0F19]/95 backdrop-blur group-hover:bg-[#0E1421]/95",
                            col.key === "player_name" ? "text-white font-medium" : tone
                          )}
                        >
                          {col.key === "rank" && (
                            <span className="text-slate-500 font-mono">{idx + 1}</span>
                          )}
                          {col.key === "player_name" && (
                            <div className="flex items-center gap-2 min-w-[160px]">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cobalt/30 to-crimson/20 text-[10px] font-bold text-white">
                                {String(row.player_name ?? "?").split(",").map((s: string) => s.trim()[0] ?? "").join("").slice(0, 2)}
                              </div>
                              <span className="truncate">{row.player_name ?? "—"}</span>
                            </div>
                          )}
                          {col.key !== "rank" && col.key !== "player_name" && display}
                        </td>
                      );
                    })}
                  </motion.tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={visibleCols.length} className="py-10 text-center text-slate-400">
                      No players match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* Lazy-load more */}
            {visibleCount < rows.length && (
              <div className="sticky bottom-0 left-0 right-0 flex justify-center bg-gradient-to-t from-[#0B0F19] to-transparent p-3">
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="border-cobalt/30 bg-cobalt/10 text-cobalt hover:bg-cobalt/20"
                >
                  Load {Math.min(PAGE_SIZE, rows.length - visibleCount)} more
                  <ArrowUpDown className="ml-2 h-3 w-3 rotate-180" />
                </Button>
              </div>
            )}
          </ScrollArea>
        )}
      </div>

      <div className="mt-3 text-center text-[10px] text-slate-600">
        Click any row to view the player's full Statcast percentile profile · Source: Baseball Savant / MLB Stats API
      </div>
    </div>
  );
}
