"use client";

import { PlayerAvatar } from "@/components/player-avatar";
import { cn } from "@/lib/utils";

interface PlayerCardProps {
  playerId?: number;
  name: string;
  role: "batter" | "pitcher";
  /** Batting side (batter) or throwing hand (pitcher): "L" | "R" | "S" */
  handedness?: string;
  accentColor?: string;
  className?: string;
}

/** Circular player card for an at-bat matchup: headshot + name + hand/role. */
export function PlayerCard({ playerId, name, role, handedness, accentColor, className }: PlayerCardProps) {
  const handLabel = handedness
    ? role === "batter"
      ? `${handedness}HB`
      : `${handedness}HP`
    : null;

  return (
    <div className={cn("flex flex-col items-center gap-1.5 text-center", className)}>
      <div
        className="rounded-full p-0.5"
        style={accentColor ? { boxShadow: `0 0 0 2px ${accentColor}60, 0 0 16px ${accentColor}30` } : undefined}
      >
        <PlayerAvatar playerId={playerId ?? 0} fallbackText={name} size={60} className="rounded-full" />
      </div>
      <div>
        <div className="text-xs font-bold text-chalk truncate max-w-[90px] sm:text-sm sm:max-w-[120px]">{name}</div>
        <div className="label-xs text-slate-500">
          {handLabel ?? (role === "pitcher" ? "Pitcher" : "Batter")}
        </div>
      </div>
    </div>
  );
}
