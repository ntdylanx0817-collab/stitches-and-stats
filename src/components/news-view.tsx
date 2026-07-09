"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper, ExternalLink, Clock, Loader2, Search, Filter,
  Shield, TrendingUp, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton, ErrorState, EmptyState } from "@/components/loading-states";
import { cn } from "@/lib/utils";

interface NewsArticle {
  id: string;
  title: string;
  link: string;
  description: string;
  publishedAt: string;
  publishedTimestamp: number;
  source: string;
  sourceSlug: string;
  sourceColor: string;
  imageUrl?: string;
}

interface NewsSource {
  name: string;
  slug: string;
  color: string;
  trustLevel: "official" | "major" | "analytical" | "fan";
}

interface NewsResponse {
  total: number;
  sources: NewsSource[];
  articles: NewsArticle[];
  cachedAt: number;
}

const TRUST_LABELS: Record<string, { label: string; color: string }> = {
  official: { label: "Official", color: "text-mint border-mint/30 bg-mint/10" },
  major: { label: "Major Outlet", color: "text-cobalt border-cobalt/30 bg-cobalt/10" },
  analytical: { label: "Analytical", color: "text-amber border-amber/30 bg-amber/10" },
  fan: { label: "Fan Blog", color: "text-slate-400 border-slate-600 bg-slate-700/20" },
};

/** Format a timestamp as a relative time (e.g., "2h ago"). */
function timeAgo(timestamp: number): string {
  if (!timestamp) return "—";
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NewsView() {
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery<NewsResponse>({
    queryKey: ["news", sourceFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      const res = await fetch(`/api/news?${params}`);
      if (!res.ok) throw new Error("news fetch failed");
      return res.json();
    },
    refetchInterval: 60_000, // Auto-refresh every 60s for near-real-time updates
    staleTime: 30_000,
    retry: 2,
  });

  const sources = data?.sources ?? [];
  const articles = useMemo(() => {
    let a = data?.articles ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      a = a.filter(
        (art) =>
          art.title.toLowerCase().includes(q) ||
          art.description.toLowerCase().includes(q)
      );
    }
    return a;
  }, [data?.articles, search]);

  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of data?.articles ?? []) {
      counts.set(a.sourceSlug, (counts.get(a.sourceSlug) ?? 0) + 1);
    }
    return counts;
  }, [data?.articles]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Newspaper className="h-5 w-5 text-cobalt" />
            Baseball News
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Aggregated from {sources.length} trustworthy sources · auto-refreshes every 60s
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="border-white/10 bg-white/[0.02] hover:bg-white/5"
        >
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Source filter chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
          <Filter className="h-3 w-3" /> Sources
        </span>
        <button
          onClick={() => setSourceFilter("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            sourceFilter === "all"
              ? "border-cobalt/40 bg-cobalt/15 text-cobalt"
              : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          All Sources
          {data && (
            <span className="ml-1.5 text-[10px] text-slate-500">{data.articles.length}</span>
          )}
        </button>
        {sources.map((s) => {
          const active = sourceFilter === s.slug;
          const count = sourceCounts.get(s.slug) ?? 0;
          return (
            <button
              key={s.slug}
              onClick={() => setSourceFilter(s.slug)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
              {count > 0 && <span className="text-[10px] text-slate-500">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search articles by keyword…"
          className="h-9 rounded-lg border-white/5 bg-white/[0.02] pl-9"
        />
      </div>

      {/* Articles */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="glass rounded-xl p-4">
              <div className="mb-2 flex items-center gap-2">
                <Skeleton className="h-2 w-12 rounded-full" />
                <Skeleton className="h-2 w-16" />
              </div>
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="mb-1 h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load news"
          description="Some RSS feeds may be temporarily unavailable. Try refreshing."
          onRetry={() => refetch()}
        />
      ) : articles.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={search.trim() ? "No matching articles" : "No articles found"}
          description={
            search.trim()
              ? `No articles matching "${search}". Try a different keyword.`
              : "The news feeds may be updating. Try refreshing in a moment."
          }
        />
      ) : (
        <ScrollArea className="h-[calc(100vh-340px)] min-h-[400px] pr-2">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence initial={false}>
              {articles.map((article, idx) => {
                const source = sources.find((s) => s.slug === article.sourceSlug);
                const trust = source ? TRUST_LABELS[source.trustLevel] : null;
                return (
                  <motion.a
                    key={`${article.sourceSlug}-${article.id}-${idx}`}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    className="glass-hover group flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-white/15"
                  >
                    {/* Source + trust badge */}
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: article.sourceColor }}
                        />
                        <span className="text-[11px] font-semibold text-slate-300">
                          {article.source}
                        </span>
                      </div>
                      {trust && (
                        <span
                          className={cn(
                            "rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                            trust.color
                          )}
                        >
                          {trust.label}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold leading-snug text-white transition-colors group-hover:text-cobalt">
                      {article.title}
                    </h3>

                    {/* Description */}
                    {article.description && (
                      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-slate-400">
                        {article.description}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="mt-auto flex items-center justify-between text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(article.publishedTimestamp)}
                      </span>
                      <span className="flex items-center gap-0.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
                        Read <ExternalLink className="h-3 w-3" />
                      </span>
                    </div>
                  </motion.a>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
