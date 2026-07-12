"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/header";
import { LiveFeedView } from "@/components/live-feed-view";
import { PlayersView } from "@/components/players-view";
import { LeaderboardsView } from "@/components/leaderboards-view";
import { NewsView } from "@/components/news-view";
import { SimulatorView } from "@/components/simulator-view";
import { CompareView } from "@/components/compare-view";
import { HomeRunDerby } from "@/components/home-run-derby";
import { useSavantStore } from "@/lib/store";
import { Footer } from "@/components/footer";

export default function Home() {
  const view = useSavantStore((s) => s.view);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
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
            {view === "derby" && (
              <div className="mx-auto max-w-[800px] px-4 py-5 sm:px-6">
                <HomeRunDerby />
              </div>
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
    </div>
  );
}
