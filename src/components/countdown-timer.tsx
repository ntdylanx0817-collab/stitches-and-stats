"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  gameDate: string;
  className?: string;
}

export function CountdownTimer({ gameDate, className }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    const update = () => {
      const target = new Date(gameDate).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setIsStarted(true);
        setTimeLeft("LIVE");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [gameDate]);

  if (isStarted) {
    return (
      <span className={cn("flex items-center gap-1.5 font-scoreboard text-[10px] font-bold uppercase tracking-wide text-mint", className)}>
        <span className="h-1.5 w-1.5 animate-live-dot rounded-full bg-mint" />
        LIVE
      </span>
    );
  }

  const target = new Date(gameDate).getTime();
  const now = Date.now();
  const diff = target - now;
  const hours = diff / (1000 * 60 * 60);

  const color = hours < 0.083 ? "text-crimson" : hours < 0.5 ? "text-amber" : "text-warning-track";

  return (
    <span className={cn("flex items-center gap-1 font-scoreboard text-[10px] font-bold uppercase tracking-wide", color, className)}>
      <Clock className="h-3 w-3" />
      {timeLeft}
    </span>
  );
}
