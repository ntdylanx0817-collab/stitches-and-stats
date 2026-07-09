"use client";

import { motion } from "framer-motion";
import { Activity, BarChart3, User, Zap, Newspaper, Swords, GitCompare } from "lucide-react";
import { GlobalPlayerSearch } from "@/components/global-player-search";
import { useSavantStore, type ViewKey } from "@/lib/store";
import { useSocket } from "@/components/socket-provider";
import { cn } from "@/lib/utils";

const NAV_ITEMS: Array<{ key: ViewKey; label: string; icon: any }> = [
  { key: "live", label: "Live Feed", icon: Activity },
  { key: "players", label: "Players", icon: User },
  { key: "leaderboard", label: "Leaderboards", icon: BarChart3 },
  { key: "compare", label: "Compare", icon: GitCompare },
  { key: "simulator", label: "Simulator", icon: Swords },
  { key: "news", label: "News", icon: Newspaper },
];

export function Header() {
  const view = useSavantStore((s) => s.view);
  const setView = useSavantStore((s) => s.setView);
  const { connected } = useSocket();

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="glass-strong border-b border-chalk">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
          {/* Logo */}
          <button
            onClick={() => setView("live")}
            className="group flex shrink-0 items-center gap-2.5"
            aria-label="Stitches and Stats home"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-warning-track to-crimson shadow-lg shadow-warning-track/30 transition-transform group-hover:scale-105">
              <Zap className="h-5 w-5 text-chalk" fill="currentColor" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-live-dot rounded-full bg-mint ring-2 ring-midnight" />
            </div>
            <div className="hidden flex-col leading-none sm:flex">
              <span className="font-scoreboard text-base font-bold tracking-wide text-chalk uppercase">
                Stitches <span className="text-warning-track">& Stats</span>
              </span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-scoreboard">
                Pro Broadcast Analytics
              </span>
            </div>
          </button>

          {/* Nav tabs */}
          <nav className="flex items-center gap-0.5 rounded-lg border border-chalk bg-midnight/60 p-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors font-scoreboard uppercase tracking-wide sm:px-3.5",
                    active ? "text-chalk" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-md bg-gradient-to-r from-warning-track/25 to-warning-track/10 ring-1 ring-warning-track/40"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon className="relative h-3.5 w-3.5" />
                  <span className="relative hidden lg:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Search */}
          <div className="ml-auto flex-1 max-w-md hidden md:block">
            <GlobalPlayerSearch />
          </div>

          {/* Live status indicator */}
          <div className="flex items-center gap-2 rounded-md border border-chalk bg-midnight/60 px-2.5 py-1.5">
            <span className={cn(
              "relative flex h-2 w-2",
              connected && "animate-live-dot"
            )}>
              <span className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                connected ? "bg-mint animate-ping" : "bg-warning-track"
              )} />
              <span className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                connected ? "bg-mint" : "bg-warning-track"
              )} />
            </span>
            <span className="hidden text-[10px] font-bold uppercase tracking-wide text-slate-400 font-scoreboard sm:inline">
              {connected ? "Live WS" : "Live REST"}
            </span>
          </div>
        </div>

        {/* Mobile search */}
        <div className="border-t border-chalk px-4 py-2 md:hidden">
          <GlobalPlayerSearch />
        </div>
      </div>
    </header>
  );
}
