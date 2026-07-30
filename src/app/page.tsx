"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/header";
import { LiveFeedView } from "@/components/live-feed-view";
import { LiveAtBatView } from "@/components/live-at-bat-view";
import { PlayersView } from "@/components/players-view";
import { LeaderboardsView } from "@/components/leaderboards-view";
import { NewsView } from "@/components/news-view";
import { SimulatorView } from "@/components/simulator-view";
import { CompareView } from "@/components/compare-view";
import { DerbyTab } from "@/components/fastest-pitches";
import { StandingsView } from "@/components/standings-view";
import { TeamProfileView } from "@/components/team-profile-view";
import { useSavantStore } from "@/lib/store";
import { Footer } from "@/components/footer";
import { FunFactBanner } from "@/components/fun-fact-banner";
import { ScoreTicker } from "@/components/score-ticker";

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
            initial={{ opacity: 0, y: 20, scale: 0.98, rotateX: 2 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: -20, scale: 0.98, rotateX: -2 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "top center", perspective: 1000 }}
          >
            {view === "live" && <LiveFeedView />}
            {view === "live-at-bat" && <LiveAtBatView />}
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

