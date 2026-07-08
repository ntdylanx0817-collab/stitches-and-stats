"use client";

import { Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/5 bg-[#0B0F19]/80 backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-3 text-xs text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-cobalt to-crimson">
              <Zap className="h-3 w-3 text-white" fill="white" />
            </div>
            <span>
              <span className="font-semibold text-slate-300">Stitches and Stats</span>
              {" — "}
              Real-time Statcast baseball analytics
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wide">
            <span>Data: MLB Stats API</span>
            <span className="text-slate-700">·</span>
            <span>Statcast: Baseball Savant</span>
            <span className="text-slate-700">·</span>
            <span>Live updates: WebSocket</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
