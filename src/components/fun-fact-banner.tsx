"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const ROTATE_INTERVAL_MS = 15_000;

interface FunFact {
  text: string;
  playerName?: string;
  playerId?: number;
  category: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  power: "text-crimson",
  barrel: "text-amber",
  contact: "text-mint",
  pitching: "text-cobalt",
  discipline: "text-warning-track",
  speed: "text-violet",
  fun: "text-slate-400",
};

export function FunFactBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [paused, setPaused] = useState(false);
  const { data, isLoading, refetch } = useQuery<{ fact: FunFact | null }>({
    queryKey: ["fun-fact"],
    queryFn: async () => {
      const res = await fetch("/api/fun-fact");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  // Auto-rotate through facts; paused while the user is hovering so a fact
  // doesn't change out from under them mid-read.
  useEffect(() => {
    if (paused || dismissed) return;
    const id = setInterval(() => refetch(), ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, dismissed, refetch]);

  if (dismissed || isLoading || !data?.fact) return null;

  const fact = data.fact;
  const colorClass = CATEGORY_COLORS[fact.category] ?? "text-slate-400";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -20, height: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden"
      >
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-2">
          <div
            className="glass-strong rounded-xl border border-warning-track/15 p-3 flex items-center gap-3"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={fact.text}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="flex flex-1 items-center gap-3 min-w-0"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-track/15">
                  <Sparkles className={cn("h-4 w-4", colorClass)} />
                </div>
                <p className="flex-1 text-[12px] leading-snug text-slate-300">
                  <span className={cn("font-scoreboard font-bold uppercase tracking-wide mr-1", colorClass)}>Did You Know?</span>
                  {fact.text}
                </p>
              </motion.div>
            </AnimatePresence>
            <button
              onClick={() => refetch()}
              className="shrink-0 rounded-md p-1.5 text-slate-500 hover:text-warning-track transition-colors"
              title="New fact"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="shrink-0 rounded-md p-1.5 text-slate-500 hover:text-chalk transition-colors"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
