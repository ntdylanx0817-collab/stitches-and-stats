"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { BaseballMark } from "@/components/ui/baseball-mark";

/** Shimmer skeleton block for loading states */
export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`skeleton-shimmer rounded-md ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

/** Card skeleton with multiple shimmer lines */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass rounded-2xl p-5">
      <Skeleton className="mb-4 h-5 w-1/3" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${85 - i * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Pitch log entry skeleton */
export function PitchLogSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
        >
          <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
          <Skeleton className="h-2 w-1.5 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2 w-2/3" />
          </div>
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

/** Strike zone skeleton */
export function StrikeZoneSkeleton() {
  return (
    <div className="flex flex-col items-center">
      <div className="relative aspect-square w-full max-w-[340px]">
        <div className="absolute inset-0 rounded-lg border border-white/5 bg-white/[0.02]" />
        <div className="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded border border-dashed border-cobalt/30" />
        {/* Faux pitch dots */}
        {[
          { x: "45%", y: "40%" },
          { x: "55%", y: "50%" },
          { x: "48%", y: "60%" },
          { x: "52%", y: "45%" },
        ].map((pos, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="absolute h-3 w-3 rounded-full bg-cobalt/40"
            style={{ left: pos.x, top: pos.y, transform: "translate(-50%, -50%)" }}
          />
        ))}
      </div>
    </div>
  );
}

/** Empty state for when there's no data */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="glass relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl p-10 text-center"
    >
      {/* Oversized ball behind the copy. Faint enough to read as texture, and
          it fills what is otherwise a large empty panel with something that
          belongs to the sport. */}
      {/* Positioned inline, not with `absolute`: `.glass > *` sets
          `position: relative` on every direct child and ties with the utility
          on specificity, which would drop this into flow above the copy
          instead of behind it. */}
      <BaseballMark
        size={190}
        className="pointer-events-none text-warning-track/[0.07]"
        style={{ position: "absolute", top: -32, right: -32 }}
      />
      <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-warning-track/20 bg-warning-track/5">
        <Icon className="h-6 w-6 text-warning-track/70" />
      </div>
      <div className="relative">
        <h3 className="mb-1 text-base font-semibold text-white">{title}</h3>
        {description && (
          <p className="mx-auto max-w-md text-sm text-slate-400">{description}</p>
        )}
      </div>
      {action}
    </motion.div>
  );
}

/** Error state with retry */
export function ErrorState({
  title = "Failed to load",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="glass flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-crimson/30 bg-crimson/15 shadow-lg shadow-crimson/20">
        <svg className="h-5 w-5 text-crimson" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold text-white">{title}</h3>
        {description && <p className="mx-auto max-w-md text-xs text-slate-400">{description}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-cobalt/30 bg-cobalt/10 px-3 py-1.5 text-xs font-medium text-cobalt transition-all duration-200 hover:scale-105 hover:border-cobalt/60 hover:bg-cobalt/20 hover:shadow-lg hover:shadow-cobalt/20 active:scale-95"
        >
          Try again
        </button>
      )}
    </motion.div>
  );
}
