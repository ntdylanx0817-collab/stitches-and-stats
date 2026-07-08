"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Loader2, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSavantStore } from "@/lib/store";

interface PlayerSearchResult {
  id: number;
  fullName: string;
  primaryNumber?: string;
  primaryPosition?: string;
  currentTeam?: string;
  batSide?: string;
  pitchHand?: string;
  currentAge?: number;
}

const TEAM_ABBREV_COLORS: Record<string, string> = {
  // simple accent per team for visual variety
};

export function GlobalPlayerSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const setView = useSavantStore((s) => s.setView);
  const setSelectedPlayer = useSavantStore((s) => s.setSelectedPlayer);

  const { data, isLoading } = useQuery<{ players: PlayerSearchResult[] }>({
    queryKey: ["player-search", q],
    queryFn: async () => {
      if (q.length < 2) return { players: [] };
      const res = await fetch(`/api/players?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("search failed");
      return res.json();
    },
    enabled: q.length >= 2,
    staleTime: 60_000,
  });

  const players = data?.players ?? [];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectPlayer = useCallback((p: PlayerSearchResult) => {
    const type = p.primaryPosition === "P" ? "pitcher" : "batter";
    setSelectedPlayer({ id: p.id, name: p.fullName, type });
    setView("players");
    setQ("");
    setOpen(false);
  }, [setSelectedPlayer, setView]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open || players.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, players.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = players[activeIdx];
      if (sel) selectPlayer(sel);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActiveIdx(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder="Search players…  (e.g. Ohtani, Judge, Soto)"
          className="h-10 rounded-full border-white/10 bg-white/[0.04] pl-10 pr-10 text-sm placeholder:text-slate-500 focus-visible:border-cobalt/50 focus-visible:ring-cobalt/20"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
        {!isLoading && q && (
          <button
            onClick={() => { setQ(""); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && players.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="glass-strong absolute z-50 mt-2 w-full overflow-hidden rounded-2xl p-1.5"
          >
            <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
              {players.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => selectPlayer(p)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    i === activeIdx ? "bg-cobalt/15 text-white" : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cobalt/30 to-crimson/20 text-xs font-bold text-white">
                    {p.primaryPosition ?? "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">
                      {p.fullName}
                      {p.primaryNumber && (
                        <span className="ml-1.5 text-slate-500">#{p.primaryNumber}</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      {p.currentTeam ?? "Free Agent"}
                      {p.currentAge ? ` · ${p.currentAge}yo` : ""}
                      {p.batSide ? ` · B/T: ${p.batSide}` : ""}
                      {p.pitchHand ? ` · Throws: ${p.pitchHand}` : ""}
                    </div>
                  </div>
                  {p.primaryPosition === "P" && (
                    <Badge variant="outline" className="border-mint/30 bg-mint/10 text-mint">PIT</Badge>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-1 flex items-center justify-between px-3 py-1.5 text-[10px] text-slate-500">
              <span>↑↓ to navigate · ↵ to select</span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Statcast-driven
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
