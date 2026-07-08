"use client";

import { motion } from "framer-motion";
import { Activity, BarChart3, User, Zap, Newspaper } from "lucide-react";
import { GlobalPlayerSearch } from "@/components/global-player-search";
import { useSavantStore, type ViewKey } from "@/lib/store";
import { useSocket } from "@/components/socket-provider";
import { cn } from "@/lib/utils";

const NAV_ITEMS: Array<{ key: ViewKey; label: string; icon: any }> = [
  { key: "live", label: "Live Feed", icon: Activity },
  { key: "players", label: "Players", icon: User },
  { key: "leaderboard", label: "Leaderboards", icon: BarChart3 },
  { key: "news", label: "News", icon: Newspaper },
];

export function Header() {
  const view = useSavantStore((s) => s.view);
  const setView = useSavantStore((s) => s.setView);
  const { connected } = useSocket();

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="glass-strong border-b border-white/5">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
          {/* Logo */}
          <button
            onClick={() => setView("live")}
            className="group flex shrink-0 items-center gap-2.5"
            aria-label="Stitches and Stats home"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cobalt to-crimson shadow-lg shadow-cobalt/30 transition-transform group-hover:scale-105">
              <Zap className="h-5 w-5 text-white" fill="white" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-live-dot rounded-full bg-mint ring-2 ring-[#0B0F19]" />
            </div>
            <div className="hidden flex-col leading-none sm:flex">
              <span className="text-base font-bold tracking-tight text-white">
                Stitches <span className="text-cobalt">& Stats</span>
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Statcast Analytics
              </span>
            </div>
          </button>

          {/* Nav tabs */}
          <nav className="flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.02] p-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={cn(
                    "relative flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors sm:px-4",
                    active ? "text-white" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-cobalt/25 to-cobalt/10 ring-1 ring-cobalt/40"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Search */}
          <div className="ml-auto flex-1 max-w-md hidden md:block">
            <GlobalPlayerSearch />
          </div>

          {/* Live status indicator */}
          <div className="flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.02] px-3 py-1.5">
            <span className={cn(
              "relative flex h-2 w-2",
              connected && "animate-live-dot"
            )}>
              <span className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                connected ? "bg-mint animate-ping" : "bg-amber"
              )} />
              <span className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                connected ? "bg-mint" : "bg-amber"
              )} />
            </span>
            <span className="hidden text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:inline">
              {connected ? "Live WS" : "Live REST"}
            </span>
          </div>
        </div>

        {/* Mobile search */}
        <div className="border-t border-white/5 px-4 py-2 md:hidden">
          <GlobalPlayerSearch />
        </div>
      </div>
    </header>
  );
}
