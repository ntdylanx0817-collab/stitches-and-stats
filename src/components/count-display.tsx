"use client";

import { cn } from "@/lib/utils";

interface CountDisplayProps {
  balls: number;
  strikes: number;
  outs?: number;
  className?: string;
}

/** Visual ball/strike count: filled dots up to the current count, plus the big "B-S" number. */
export function CountDisplay({ balls, strikes, outs, className }: CountDisplayProps) {
  const safeBalls = Math.max(0, Math.min(balls, 3));
  const safeStrikes = Math.max(0, Math.min(strikes, 2));

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="font-scoreboard text-2xl font-black text-chalk num leading-none">
        {balls}-{strikes}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1" aria-label={`${balls} balls`}>
          {Array.from({ length: 3 }).map((_, i) => (
            <span
              key={`ball-${i}`}
              className={cn(
                "h-2.5 w-2.5 rounded-full border transition-colors",
                i < safeBalls ? "border-mint bg-mint shadow-[0_0_6px_rgba(61,219,160,0.7)]" : "border-chalk/25 bg-transparent"
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-1" aria-label={`${strikes} strikes`}>
          {Array.from({ length: 2 }).map((_, i) => (
            <span
              key={`strike-${i}`}
              className={cn(
                "h-2.5 w-2.5 rounded-full border transition-colors",
                i < safeStrikes ? "border-crimson bg-crimson shadow-[0_0_6px_rgba(255,59,92,0.7)]" : "border-chalk/25 bg-transparent"
              )}
            />
          ))}
        </div>
        {outs != null && (
          <div className="flex items-center gap-1" aria-label={`${outs} outs`}>
            {Array.from({ length: 3 }).map((_, i) => (
              <span
                key={`out-${i}`}
                className={cn(
                  "h-2.5 w-2.5 rounded-full border transition-colors",
                  i < Math.min(outs, 3) ? "border-warning-track bg-warning-track shadow-[0_0_6px_rgba(230,126,34,0.7)]" : "border-chalk/25 bg-transparent"
                )}
              />
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="label-xs text-slate-600">Balls</span>
        <span className="label-xs text-slate-600">Strikes</span>
        {outs != null && <span className="label-xs text-slate-600">Outs</span>}
      </div>
    </div>
  );
}
