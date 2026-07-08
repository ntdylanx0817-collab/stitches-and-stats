"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/header";
import { LiveFeedView } from "@/components/live-feed-view";
import { PlayersView } from "@/components/players-view";
import { LeaderboardsView } from "@/components/leaderboards-view";
import { useSavantStore } from "@/lib/store";
import { Footer } from "@/components/footer";

export default function Home() {
  const view = useSavantStore((s) => s.view);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {view === "live" && <LiveFeedView />}
            {view === "players" && <PlayersView />}
            {view === "leaderboard" && <LeaderboardsView />}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
