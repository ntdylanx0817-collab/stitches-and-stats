"use client";

import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/header";
import { LiveFeedView } from "@/components/live-feed-view";
import { useSavantStore } from "@/lib/store";
import { Footer } from "@/components/footer";
import { FunFactBanner } from "@/components/fun-fact-banner";
import { ScoreTicker } from "@/components/score-ticker";
import { BaseballMark } from "@/components/ui/baseball-mark";

// The app is a single client-side shell with eleven substantial views. Static
// imports made a visitor download every chart, table, simulator, and news
// parser before seeing the default live screen. Keep the primary view eager;
// fetch each secondary feature only when it is first opened.
const LiveAtBatView = dynamic(
  () => import("@/components/live-at-bat-view").then((module) => module.LiveAtBatView),
  { loading: ViewLoading }
);
const RecapView = dynamic(
  () => import("@/components/recap-view").then((module) => module.RecapView),
  { loading: ViewLoading }
);
const PlayersView = dynamic(
  () => import("@/components/players-view").then((module) => module.PlayersView),
  { loading: ViewLoading }
);
const LeaderboardsView = dynamic(
  () => import("@/components/leaderboards-view").then((module) => module.LeaderboardsView),
  { loading: ViewLoading }
);
const NewsView = dynamic(
  () => import("@/components/news-view").then((module) => module.NewsView),
  { loading: ViewLoading }
);
const SimulatorView = dynamic(
  () => import("@/components/simulator-view").then((module) => module.SimulatorView),
  { loading: ViewLoading }
);
const CompareView = dynamic(
  () => import("@/components/compare-view").then((module) => module.CompareView),
  { loading: ViewLoading }
);
const DerbyTab = dynamic(
  () => import("@/components/fastest-pitches").then((module) => module.DerbyTab),
  { loading: ViewLoading }
);
const StandingsView = dynamic(
  () => import("@/components/standings-view").then((module) => module.StandingsView),
  { loading: ViewLoading }
);
const TeamProfileView = dynamic(
  () => import("@/components/team-profile-view").then((module) => module.TeamProfileView),
  { loading: ViewLoading }
);

function ViewLoading() {
  return (
    <div className="mx-auto flex min-h-[45vh] max-w-[1600px] items-center justify-center px-4 py-12" role="status">
      <div className="glass flex flex-col items-center gap-3 rounded-2xl px-8 py-7 text-center">
        <BaseballMark size={38} className="animate-baseball-load text-warning-track/70" />
        <span className="font-scoreboard text-xs uppercase tracking-widest text-slate-400">
          Loading the next view
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const view = useSavantStore((s) => s.view);
  const selectedTeamId = useSavantStore((s) => s.selectedTeamId);
  const setView = useSavantStore((s) => s.setView);

  // The live-tracking tabs are watched hands-off for real-time updates, so the
  // trivia banner's ~90px is pure cost there — it pushes the pitch/at-bat
  // content users opened the tab for below the fold on a typical viewport.
  const showFunFact = view !== "live" && view !== "live-at-bat";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {showFunFact && <FunFactBanner />}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {view === "live" && <LiveFeedView />}
            {view === "live-at-bat" && <LiveAtBatView />}
            {view === "recap" && <RecapView />}
            {view === "derby" && <DerbyTab />}
            {view === "standings" && <StandingsView />}
            {view === "team" && selectedTeamId && (
              <TeamProfileView teamId={selectedTeamId} onClose={() => setView("standings")} />
            )}
            {view === "players" && <PlayersView />}
            {view === "leaderboard" && <LeaderboardsView />}
            {view === "compare" && <CompareView />}
            {view === "simulator" && <SimulatorView />}
            {view === "news" && <NewsView />}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <ScoreTicker />
    </div>
  );
}
