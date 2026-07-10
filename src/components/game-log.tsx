"use client";

import { motion } from "framer-motion";
import { Calendar } from "lucide-react";

interface GameLogEntry {
  date: string;
  opponent: string;
  isHome: boolean;
  stat: {
    ab?: number; h?: number; hr?: number; rbi?: number; r?: number;
    bb?: number; so?: number; sb?: number; avg?: string;
    obp?: string; slg?: string; ops?: string;
    ip?: string; er?: number; k?: number; bb_allowed?: number;
    np?: number; era?: string; whip?: string;
  };
}

interface GameLogProps {
  data: GameLogEntry[];
  isBatter: boolean;
  className?: string;
}

export function GameLog({ data, isBatter, className }: GameLogProps) {
  if (!data || data.length === 0) {
    return (
      <div className={className}>
        <div className="glass rounded-2xl p-4">
          <h3 className="font-scoreboard mb-2 text-sm font-bold text-chalk uppercase tracking-wide">Recent Games</h3>
          <p className="text-xs text-slate-500">No game log available</p>
        </div>
      </div>
    );
  }

  const recent = data.slice(0, 15);

  return (
    <div className={className}>
      <div className="glass rounded-2xl p-4">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Calendar className="h-4 w-4 text-warning-track" />
          Recent Games
        </h3>

        {/* Mobile: card list / Desktop: table */}
        <div className="hidden sm:block">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-xs num">
              <thead>
                <tr className="text-[9px] uppercase text-slate-500 font-scoreboard border-b border-chalk">
                  <th className="text-left py-1.5 pr-2">Date</th>
                  <th className="text-left py-1.5 pr-2">Opp</th>
                  {isBatter ? (
                    <>
                      <th className="text-center py-1.5 px-1">AB</th>
                      <th className="text-center py-1.5 px-1">H</th>
                      <th className="text-center py-1.5 px-1">HR</th>
                      <th className="text-center py-1.5 px-1">RBI</th>
                      <th className="text-center py-1.5 px-1">BB</th>
                      <th className="text-center py-1.5 px-1">SO</th>
                      <th className="text-center py-1.5 px-1">AVG</th>
                      <th className="text-center py-1.5 px-1">OPS</th>
                    </>
                  ) : (
                    <>
                      <th className="text-center py-1.5 px-1">IP</th>
                      <th className="text-center py-1.5 px-1">ER</th>
                      <th className="text-center py-1.5 px-1">K</th>
                      <th className="text-center py-1.5 px-1">BB</th>
                      <th className="text-center py-1.5 px-1">NP</th>
                      <th className="text-center py-1.5 px-1">ERA</th>
                      <th className="text-center py-1.5 px-1">WHIP</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {recent.map((g, i) => (
                  <motion.tr
                    key={`${g.date}-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="row-mowed-grass border-b border-chalk/50"
                  >
                    <td className="py-1.5 pr-2 text-slate-400 text-[10px]">
                      {new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-300 text-[10px]">
                      {g.isHome ? "vs " : "@ "}{g.opponent.split(" ").slice(-1)[0]}
                    </td>
                    {isBatter ? (
                      <>
                        <td className="text-center py-1.5 px-1 text-slate-400">{g.stat.ab ?? 0}</td>
                        <td className="text-center py-1.5 px-1 text-slate-300 font-bold">{g.stat.h ?? 0}</td>
                        <td className={`text-center py-1.5 px-1 font-bold ${(g.stat.hr ?? 0) > 0 ? "text-crimson" : "text-slate-500"}`}>{g.stat.hr ?? 0}</td>
                        <td className="text-center py-1.5 px-1 text-slate-400">{g.stat.rbi ?? 0}</td>
                        <td className="text-center py-1.5 px-1 text-slate-400">{g.stat.bb ?? 0}</td>
                        <td className="text-center py-1.5 px-1 text-slate-500">{g.stat.so ?? 0}</td>
                        <td className="text-center py-1.5 px-1 text-slate-300">{g.stat.avg ?? "—"}</td>
                        <td className={`text-center py-1.5 px-1 font-bold ${(g.stat.ops ? parseFloat(g.stat.ops) : 0) >= 0.900 ? "text-mint" : (g.stat.ops ? parseFloat(g.stat.ops) : 0) >= 0.700 ? "text-cobalt" : "text-slate-500"}`}>{g.stat.ops ?? "—"}</td>
                      </>
                    ) : (
                      <>
                        <td className="text-center py-1.5 px-1 text-slate-400">{g.stat.ip ?? "—"}</td>
                        <td className={`text-center py-1.5 px-1 font-bold ${(g.stat.er ?? 0) === 0 ? "text-mint" : (g.stat.er ?? 0) <= 2 ? "text-cobalt" : "text-crimson"}`}>{g.stat.er ?? 0}</td>
                        <td className="text-center py-1.5 px-1 text-mint font-bold">{g.stat.k ?? 0}</td>
                        <td className="text-center py-1.5 px-1 text-slate-400">{g.stat.bb_allowed ?? 0}</td>
                        <td className="text-center py-1.5 px-1 text-slate-500">{g.stat.np ?? 0}</td>
                        <td className="text-center py-1.5 px-1 text-slate-300">{g.stat.era ?? "—"}</td>
                        <td className="text-center py-1.5 px-1 text-slate-300">{g.stat.whip ?? "—"}</td>
                      </>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile: card list */}
        <div className="sm:hidden space-y-1.5 max-h-[400px] overflow-y-auto scrollbar-thin">
          {recent.map((g, i) => (
            <motion.div
              key={`${g.date}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="rounded-lg border border-chalk bg-midnight/40 p-2"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-scoreboard text-[10px] text-slate-400 uppercase tracking-wide">
                  {new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span className="text-[10px] text-slate-500">
                  {g.isHome ? "vs " : "@ "}{g.opponent.split(" ").slice(-1)[0]}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {isBatter ? (
                  <>
                    <span className="text-slate-300 font-bold">{g.stat.h ?? 0}-{g.stat.ab ?? 0}</span>
                    {(g.stat.hr ?? 0) > 0 && <span className="text-crimson font-bold font-scoreboard">{g.stat.hr}HR</span>}
                    <span className="text-slate-400">{g.stat.rbi ?? 0} RBI</span>
                    <span className="text-slate-500">{g.stat.so ?? 0}K</span>
                    <span className="text-slate-400 ml-auto">{g.stat.ops ?? "—"} OPS</span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-300 font-bold">{g.stat.ip ?? "—"} IP</span>
                    <span className={`font-bold ${(g.stat.er ?? 0) === 0 ? "text-mint" : "text-slate-400"}`}>{g.stat.er ?? 0} ER</span>
                    <span className="text-mint font-bold font-scoreboard">{g.stat.k ?? 0}K</span>
                    <span className="text-slate-500 ml-auto">{g.stat.era ?? "—"} ERA</span>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
