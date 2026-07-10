"use client";

import { motion } from "framer-motion";
import { Zap, TrendingUp, Target } from "lucide-react";

interface BarrelData {
  totalBIP: number;
  totalBarrels: number;
  barrelPercent: number;
  avgEV: number;
  maxEV: number;
  maxLaunchAngle: number;
  avgDistance: number;
  sweetSpotPercent: number;
  hardHitPercent: number;
}

interface BarrelStatsProps {
  data: BarrelData;
  className?: string;
}

export function BarrelStats({ data, className }: BarrelStatsProps) {
  const stats = [
    { label: "Avg EV", value: data.avgEV.toFixed(1), unit: "mph", icon: Zap, color: "text-warning-track", tone: data.avgEV >= 90 ? "good" : "default" },
    { label: "Max EV", value: data.maxEV.toFixed(1), unit: "mph", icon: TrendingUp, color: "text-crimson", tone: data.maxEV >= 110 ? "good" : "default" },
    { label: "Barrel%", value: data.barrelPercent.toFixed(1), unit: "%", icon: Target, color: "text-mint", tone: data.barrelPercent >= 10 ? "good" : "default" },
    { label: "Hard Hit%", value: data.hardHitPercent.toFixed(1), unit: "%", icon: Zap, color: "text-amber", tone: data.hardHitPercent >= 40 ? "good" : "default" },
    { label: "Sweet Spot%", value: data.sweetSpotPercent.toFixed(1), unit: "%", icon: Target, color: "text-cobalt", tone: "default" },
    { label: "Avg Dist", value: data.avgDistance.toFixed(0), unit: "ft", icon: TrendingUp, color: "text-violet", tone: "default" },
  ];

  return (
    <div className={className}>
      <div className="glass rounded-2xl p-4">
        <h3 className="font-scoreboard mb-3 flex items-center gap-2 text-sm font-bold text-chalk uppercase tracking-wide">
          <Zap className="h-4 w-4 text-warning-track" />
          Batted Ball Metrics
        </h3>
        <p className="mb-3 text-[11px] text-slate-500">
          {data.totalBIP} balls in play · {data.totalBarrels} barrels
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-lg border border-chalk bg-midnight/40 p-2.5 text-center"
              >
                <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wide text-slate-500 font-scoreboard mb-1">
                  <Icon className="h-3 w-3" />
                  {stat.label}
                </div>
                <div className={`font-scoreboard text-xl font-bold num ${stat.color}`}>
                  {stat.value}
                  <span className="ml-0.5 text-[9px] font-normal text-slate-600">{stat.unit}</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* EV distribution bar */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500 font-scoreboard">
            <span>Exit Velocity Distribution</span>
            <span>{data.totalBIP} BIP</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-midnight">
            {/* Hard hit (95+) */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${data.hardHitPercent}%` }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="h-full bg-crimson"
              title={`Hard Hit (95+ mph): ${data.hardHitPercent.toFixed(1)}%`}
            />
            {/* Sweet spot */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${data.sweetSpotPercent}%` }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="h-full bg-amber"
              title={`Sweet Spot: ${data.sweetSpotPercent.toFixed(1)}%`}
            />
            {/* Barrels */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${data.barrelPercent}%` }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="h-full bg-mint"
              title={`Barrels: ${data.barrelPercent.toFixed(1)}%`}
            />
            {/* Other */}
            <div className="h-full flex-1 bg-midnight-2" />
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-slate-600">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-mint" /> Barrel</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber" /> Sweet Spot</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-crimson" /> Hard Hit</span>
          </div>
        </div>
      </div>
    </div>
  );
}
