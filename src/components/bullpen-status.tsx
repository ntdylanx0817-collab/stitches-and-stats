"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Users } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn } from "@/lib/utils";

interface BullpenEntry {
  id: number;
  name: string;
  position: string;
  status: string;
  number: string;
}

interface BullpenStatusProps {
  teamId: number;
  teamName: string;
  className?: string;
}

export function BullpenStatus({ teamId, teamName, className }: BullpenStatusProps) {
  const { data, isLoading } = useQuery<{ roster: BullpenEntry[] }>({
    queryKey: ["bullpen", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/team/${teamId}`);
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className={className}>
        <div className="glass rounded-2xl p-4">
          <h3 className="font-scoreboard mb-2 text-sm font-bold text-chalk uppercase tracking-wide">Bullpen</h3>
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-warning-track" />
          </div>
        </div>
      </div>
    );
  }

  const pitchers = (data?.roster ?? []).filter(p => p.position === "P");
  if (pitchers.length === 0) return null;

  return (
    <div className={className}>
      <div className="glass rounded-2xl p-4">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Users className="h-4 w-4 text-mint" />
          {teamName} Bullpen
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {pitchers.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="flex items-center gap-2 rounded-lg border border-chalk bg-midnight/30 p-1.5"
            >
              <PlayerAvatar playerId={p.id} size={28} fallbackText={p.name} className="rounded-md shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium text-chalk">{p.name}</div>
                <div className="font-scoreboard text-[9px] text-slate-500">{p.position}{p.number && ` · #${p.number}`}</div>
              </div>
              <span className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                p.status === "A" ? "bg-mint" : "bg-slate-600"
              )} title={p.status === "A" ? "Active" : "Inactive"} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
