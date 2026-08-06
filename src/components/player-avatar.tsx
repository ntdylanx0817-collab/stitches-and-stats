"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface PlayerAvatarProps {
  playerId: number;
  size?: number;
  fallbackText?: string;
  className?: string;
}

export function PlayerAvatar({ playerId, size = 48, fallbackText, className }: PlayerAvatarProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const initials = fallbackText
    ? fallbackText.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "??";

  if (!playerId || error) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cobalt/30 to-crimson/20 text-sm font-bold text-chalk font-scoreboard",
          className
        )}
        style={{ width: size, height: size, fontSize: size * 0.3 }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-lg", className)}
      style={{ width: size, height: size }}
    >
      {!loaded && (
        <div className="absolute inset-0 skeleton-shimmer rounded-lg" />
      )}
      <img
        src={`https://midfield.mlb.com/mlb/photos/players/${playerId}/8x10/`}
        alt={fallbackText ?? `Player ${playerId}`}
        className={cn(
          "h-full w-full object-cover rounded-lg border border-chalk/10 transition-opacity",
          loaded ? "opacity-100" : "opacity-0"
        )}
        style={{ width: size, height: size }}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}
