"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper, ExternalLink, Clock, Search, Filter,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton, ErrorState, EmptyState } from "@/components/loading-states";
import { BaseballMark } from "@/components/ui/baseball-mark";
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
      {/* Editorial masthead */}
      <section aria-labelledby="news-title" className="scorebook-panel relative mb-4 px-5 py-6 sm:px-8 sm:py-8">
        <BaseballMark
          size={230}
          className="pointer-events-none text-warning-track/[0.06]"
          style={{ position: "absolute", right: -38, top: -66 }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="editorial-kicker">Clubhouse wire</span>
            <h1 id="news-title" className="font-scoreboard mt-3 text-4xl font-black uppercase leading-none tracking-[-0.035em] text-chalk sm:text-5xl">
              The Baseball Wire
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
              The day&apos;s essential stories, analysis, and transactions from trusted baseball desks.
            </p>
          </div>
          <div className="flex items-end gap-5 sm:justify-end">
            <div className="border-l border-chalk/15 pl-3">
              <div className="broadcast-number text-2xl font-black text-chalk">{data?.total ?? "—"}</div>
              <div className="font-scoreboard text-[9px] uppercase tracking-[0.16em] text-slate-500">Stories</div>
            </div>
            <div className="border-l border-chalk/15 pl-3">
              <div className="broadcast-number text-2xl font-black text-chalk">{sources.length || "—"}</div>
              <div className="font-scoreboard text-[9px] uppercase tracking-[0.16em] text-slate-500">Sources</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="scorecard-cut border-chalk/15 bg-midnight/45 hover:border-heritage-red/40 hover:bg-heritage-red/10"
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <div className="scorecard-cut mb-4 border border-chalk bg-card/30 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 flex items-center gap-1 font-scoreboard text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <Filter className="h-3 w-3" /> News desks
          </span>
          <button
            type="button"
            aria-pressed={sourceFilter === "all"}
            onClick={() => setSourceFilter("all")}
            className={cn(
              "scorecard-cut border px-3 py-1 text-xs font-medium transition-colors",
              sourceFilter === "all"
                ? "border-heritage-red/50 bg-heritage-red/15 text-chalk"
                : "border-chalk/10 bg-chalk/[0.02] text-slate-400 hover:bg-chalk/5 hover:text-chalk"
            )}
          >
            All desks
            {data && <span className="ml-1.5 text-[10px] text-slate-500">{data.articles.length}</span>}
          </button>
          {sources.map((s) => {
            const active = sourceFilter === s.slug;
            const count = sourceCounts.get(s.slug) ?? 0;
            return (
              <button
                type="button"
                aria-pressed={active}
                key={s.slug}
                onClick={() => setSourceFilter(s.slug)}
                className={cn(
                  "scorecard-cut flex items-center gap-1.5 border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-chalk/30 bg-chalk/10 text-chalk"
                    : "border-chalk/10 bg-chalk/[0.02] text-slate-400 hover:bg-chalk/5 hover:text-chalk"
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
                {count > 0 && <span className="text-[10px] text-slate-500">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="scorebook-rule mb-3" />
        <div className="relative max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the wire by keyword…"
            className="scorecard-cut h-10 border-chalk/10 bg-midnight/35 pl-9"
          />
        </div>
      </div>

      {/* Articles */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={cn("scorecard-cut border border-chalk bg-card/30 p-4", i === 0 && "md:col-span-2 lg:row-span-2")}>
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
        <ScrollArea className="h-[calc(100vh-410px)] min-h-[460px] pr-2">
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
                    className={cn(
                      "scorecard-cut group relative flex min-h-[190px] flex-col overflow-hidden border border-chalk bg-card/30 p-4 transition-all hover:-translate-y-0.5 hover:border-heritage-red/40 hover:shadow-xl hover:shadow-black/15",
                      idx === 0 && "min-h-[300px] md:col-span-2 md:p-6 lg:row-span-2 lg:min-h-[395px]"
                    )}
                  >
                    <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: article.sourceColor }} />
                    {idx === 0 && (
                      <BaseballMark
                        size={260}
                        className="pointer-events-none text-warning-track/[0.045]"
                        style={{ position: "absolute", right: -52, bottom: -72 }}
                      />
                    )}
                    {/* Source + trust badge */}
                    <div className="relative mb-3 flex items-center justify-between gap-2">
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
                            "scorecard-cut border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                            trust.color
                          )}
                        >
                          {trust.label}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    {idx === 0 && <span className="editorial-kicker relative mb-4">Lead story</span>}
                    <h2 className={cn(
                      "relative mb-2 line-clamp-3 font-semibold leading-snug text-chalk transition-colors group-hover:text-heritage-red",
                      idx === 0 ? "max-w-2xl text-2xl sm:text-3xl" : "text-sm"
                    )}>
                      {article.title}
                    </h2>

                    {/* Description */}
                    {article.description && (
                      <p className={cn("relative mb-3 text-xs leading-relaxed text-slate-400", idx === 0 ? "max-w-2xl line-clamp-4 sm:text-sm sm:leading-6" : "line-clamp-2")}>
                        {article.description}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="relative mt-auto flex items-center justify-between border-t border-chalk/10 pt-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(article.publishedTimestamp)}
                      </span>
                      <span className={cn("flex items-center gap-0.5 text-slate-400 transition-opacity", idx === 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
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
