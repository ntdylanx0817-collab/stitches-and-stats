"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  Activity, BarChart3, User, Newspaper, Swords, GitCompare, Flame, Trophy, Sun, Moon, Target,
  Sunrise, ChevronDown, Crown,
  type LucideIcon,
} from "lucide-react";
import { GlobalPlayerSearch } from "@/components/global-player-search";
import { useSavantStore, type ViewKey } from "@/lib/store";
import { useSocket } from "@/components/socket-provider";
import { cn } from "@/lib/utils";
import { BaseballMark } from "@/components/ui/baseball-mark";

/** Never fires; `mounted` only needs to differ between server and client. */
const noopSubscribe = () => () => {};

type NavItem = { key: ViewKey; label: string; icon: LucideIcon };

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { key: "live", label: "Live", icon: Activity },
  { key: "live-at-bat", label: "At-Bat", icon: Target },
  { key: "recap", label: "Recap", icon: Sunrise },
  { key: "postseason", label: "Postseason", icon: Crown },
  { key: "standings", label: "Standings", icon: Trophy },
  { key: "players", label: "Players", icon: User },
];

const MORE_NAV_ITEMS: NavItem[] = [
  { key: "derby", label: "Derby", icon: Flame },
  { key: "leaderboard", label: "Stats", icon: BarChart3 },
  { key: "compare", label: "Compare", icon: GitCompare },
  { key: "simulator", label: "Simulator", icon: Swords },
  { key: "news", label: "News", icon: Newspaper },
];

export function Header() {
  const view = useSavantStore((s) => s.view);
  const setView = useSavantStore((s) => s.setView);
  const { connected } = useSocket();
  const { theme, setTheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreActive = MORE_NAV_ITEMS.some((item) => item.key === view);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!moreMenuRef.current?.contains(event.target as Node)) setMoreOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function selectView(nextView: ViewKey) {
    setView(nextView);
    setMoreOpen(false);
  }

  // next-themes can only learn the theme from localStorage after mount, so
  // `theme` is undefined on the server and on the first client render. Reading
  // it directly made the toggle render Moon server-side and Sun once hydrated,
  // and React threw out the whole tree over the mismatch.
  //
  // Holding the rendered state at the provider's defaultTheme until mounted
  // makes both of those first passes agree. Anyone who has actually chosen
  // light gets a one-frame icon swap after mount, which is a repaint rather
  // than a hydration error.
  //
  // useSyncExternalStore rather than setState-in-an-effect: React is told
  // outright that the server snapshot is false and the client snapshot true,
  // so it renders the pre-hydration pass correctly instead of being corrected
  // by an effect afterwards.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isDark = mounted ? theme === "dark" : true;

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="card-broadcast !overflow-visible border-b border-chalk">
        <div className="mx-auto flex max-w-[1600px] items-center gap-1.5 px-3 py-2 sm:gap-4 sm:px-6">
          {/* Logo */}
          <button
            onClick={() => selectView("live")}
            className="group flex shrink-0 items-center gap-2.5 text-left"
            aria-label="Stitches and Stats home"
          >
            <div className="scorecard-cut relative flex h-10 w-10 items-center justify-center border border-heritage-red/60 bg-scorebook text-heritage-red shadow-[3px_3px_0_rgba(213,74,67,0.22)] transition-transform group-hover:-rotate-3 group-active:scale-95">
              <BaseballMark size={27} />
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="font-scoreboard text-[19px] font-black leading-[0.9] tracking-[0.035em] text-chalk uppercase">
                Stitches <span className="text-heritage-red">& Stats</span>
              </span>
              <span className="mt-1 font-mono text-[7px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                The baseball data desk
              </span>
            </div>
          </button>

          {/* Nav tabs. min-w-0 lets this shrink below its content width inside
              the flex row so it scrolls internally on very narrow viewports
              (below ~320px) instead of pushing the theme toggle or connection
              badge off-screen with no way to reach them. */}
          <nav className="scorecard-cut flex min-w-0 items-center gap-0.5 overflow-x-auto border border-subtle bg-midnight/75 p-0.5 scrollbar-thin">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => selectView(item.key)}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-9 shrink-0 items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs transition-colors font-scoreboard uppercase tracking-wide sm:px-3",
                    active ? "font-bold text-chalk" : "font-medium text-slate-400 hover:text-slate-200"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-sm bg-heritage-red/12 ring-1 ring-heritage-red/35"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon
                    className={cn(
                      "relative h-3.5 w-3.5 transition-[filter] duration-200",
                      // Warm halo rather than .icon-glow: the active label is
                      // chalk, so currentColor would give a white glow that
                      // vanishes against the pill. Orange reads as lit.
                      active && "text-heritage-red drop-shadow-[0_0_7px_rgba(213,74,67,0.8)]"
                    )}
                  />
                  <span className="relative hidden md:inline">{item.label}</span>
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute bottom-0.5 left-2 right-2 h-0.5 bg-heritage-red shadow-[0_0_8px_rgba(213,74,67,0.75)]"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                </button>
              );
            })}

            <div ref={moreMenuRef} className="relative shrink-0">
              <button
                ref={moreButtonRef}
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                aria-controls="more-navigation-menu"
                className={cn(
                  "relative flex min-h-9 items-center gap-1 rounded-sm px-2 py-1.5 text-xs font-scoreboard font-medium uppercase tracking-wide transition-colors sm:px-3",
                  moreActive || moreOpen ? "text-chalk" : "text-slate-400 hover:text-slate-200"
                )}
              >
                {moreActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-sm bg-heritage-red/12 ring-1 ring-heritage-red/35"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {!moreActive && moreOpen && (
                  <span className="absolute inset-0 rounded-sm bg-heritage-red/12 ring-1 ring-heritage-red/35" />
                )}
                <span className="relative hidden md:inline">More</span>
                <ChevronDown
                  className={cn(
                    "relative h-3.5 w-3.5 transition-transform duration-200",
                    moreOpen && "rotate-180"
                  )}
                />
                {moreActive && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute bottom-0.5 left-2 right-2 h-0.5 bg-heritage-red shadow-[0_0_8px_rgba(213,74,67,0.75)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </button>

              <AnimatePresence>
                {moreOpen && (
                  <motion.div
                    id="more-navigation-menu"
                    role="menu"
                    aria-label="More sections"
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="glass-strong absolute right-0 top-[calc(100%+0.6rem)] z-50 grid w-48 gap-1 rounded-xl p-1.5 shadow-2xl"
                  >
                    {MORE_NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const active = view === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="menuitem"
                          onClick={() => selectView(item.key)}
                          className={cn(
                            "interactive-row flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-scoreboard uppercase tracking-wide transition-colors",
                            active
                              ? "bg-heritage-red/15 font-bold text-chalk"
                              : "text-slate-300 hover:bg-chalk/5 hover:text-chalk"
                          )}
                        >
                          <Icon className={cn("h-4 w-4", active && "text-heritage-red")} />
                          {item.label}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

          {/* Search */}
          <div className="ml-auto flex-1 max-w-md hidden lg:block">
            <GlobalPlayerSearch />
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="scorecard-cut flex shrink-0 items-center justify-center border border-chalk bg-midnight/60 p-1.5 text-slate-400 transition-colors hover:border-heritage-red/50 hover:text-heritage-red"
            title={isDark ? "Stadium Day Mode" : "Night Game Mode"}
            aria-label={isDark ? "Switch to Stadium Day Mode" : "Switch to Night Game Mode"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Live status indicator — hidden below lg, where the header's nav
              icons alone already fill the available width. Per-view badges
              (e.g. the pitch feed's Live/Polling badge) cover this on mobile
              and tablet. */}
          <div
            className="hidden shrink-0 items-center gap-2 rounded-md border border-chalk bg-midnight/60 px-2.5 py-1.5 lg:flex"
            title={connected ? "Connected — receiving live updates" : "Reconnecting to the live update server…"}
          >
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
              {connected ? "Live" : "Reconnecting"}
            </span>
          </div>
        </div>

        {/* Mobile search */}
        <div className="border-t border-chalk px-4 py-2 lg:hidden">
          <GlobalPlayerSearch />
        </div>
      </div>
    </header>
  );
}
