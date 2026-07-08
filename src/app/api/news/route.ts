import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { getOrSet } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  description: string;
  publishedAt: string;
  publishedTimestamp: number;
  source: string;
  sourceSlug: string;
  sourceColor: string;
  category?: string;
  imageUrl?: string;
}

interface NewsSource {
  name: string;
  slug: string;
  color: string;
  url: string;
  trustLevel: "official" | "major" | "analytical" | "fan";
}

// 10 trustworthy, baseball-relevant RSS sources that are publicly accessible.
// Each is polled in parallel and cached for 60 seconds to stay fresh without
// hammering the upstream feeds.
const NEWS_SOURCES: NewsSource[] = [
  {
    name: "MLB.com",
    slug: "mlb",
    color: "#0469E6",
    url: "https://www.mlb.com/feeds/news/rss.xml",
    trustLevel: "official",
  },
  {
    name: "Yahoo Sports",
    slug: "yahoo",
    color: "#6001D2",
    url: "https://sports.yahoo.com/mlb/rss.xml",
    trustLevel: "major",
  },
  {
    name: "MLB Trade Rumors",
    slug: "mlbtr",
    color: "#FF6B35",
    url: "https://www.mlbtraderumors.com/feed",
    trustLevel: "analytical",
  },
  {
    name: "New York Times",
    slug: "nyt",
    color: "#A3A3A3",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Baseball.xml",
    trustLevel: "major",
  },
  {
    name: "Baseball Prospectus",
    slug: "bp",
    color: "#3DDBA0",
    url: "https://www.baseballprospectus.com/feed/",
    trustLevel: "analytical",
  },
  {
    name: "FanSided",
    slug: "fansided",
    color: "#E84545",
    url: "https://www.fansided.com/feed",
    trustLevel: "fan",
  },
  {
    name: "Call to the Pen",
    slug: "cttp",
    color: "#FFB547",
    url: "https://calltothepen.com/feed/",
    trustLevel: "fan",
  },
  {
    name: "Deadspin",
    slug: "deadspin",
    color: "#1DB954",
    url: "https://deadspin.com/rss",
    trustLevel: "major",
  },
  {
    name: "Sportsnaut",
    slug: "sportsnaut",
    color: "#4DA3FF",
    url: "https://www.sportsnaut.com/feed/",
    trustLevel: "fan",
  },
  {
    name: "Essentially Sports",
    slug: "essentially",
    color: "#FF3B5C",
    url: "https://www.essentiallysports.com/feed/",
    trustLevel: "fan",
  },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  trimValues: true,
});

// Keywords to filter general sports feeds down to baseball-relevant articles.
// Used for feeds that aren't exclusively baseball (Deadspin, Sportsnaut, etc.)
const BASEBALL_KEYWORDS = [
  "mlb", "baseball", "pitcher", "batter", "home run", "strikeout",
  "walk-off", "no-hitter", "perfect game", "world series", "playoffs",
  "wild card", "division series", "all-star", "mvp", "cy young",
  "roster", "trade", "free agent", "signing", "draft", "prospect",
  "inning", "dugout", "mound", "diamond", "slugger", "closer",
  "catcher", "outfielder", "infielder", "shortstop", "designated hitter",
];

/** Check if an article is baseball-relevant (for general sports feeds). */
function isBaseballRelevant(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return BASEBALL_KEYWORDS.some((kw) => text.includes(kw));
}

/** Extract a clean description (strip HTML, truncate). */
function cleanDescription(desc: string): string {
  if (!desc) return "";
  // Strip HTML tags
  const stripped = desc.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim();
  // Truncate to ~200 chars at word boundary
  if (stripped.length <= 200) return stripped;
  return stripped.substring(0, 200).replace(/\s+\S*$/, "") + "…";
}

/** Extract first image URL from description HTML if present. */
function extractImage(desc: string): string | undefined {
  if (!desc) return undefined;
  const match = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

/** Parse a date string into a timestamp. */
function parseDate(dateStr: string): number {
  if (!dateStr) return 0;
  const ts = Date.parse(dateStr);
  return isNaN(ts) ? 0 : ts;
}

/** Fetch and parse a single RSS feed. */
async function fetchFeed(source: NewsSource): Promise<NewsArticle[]> {
  try {
    const res = await fetch(source.url, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      console.error(`[news] ${source.name} returned ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const parsed = parser.parse(xml);

    // RSS 2.0: channel.item; Atom: feed.entry
    const channel = parsed.rss?.channel ?? parsed.feed;
    if (!channel) return [];

    let items: any[] = [];
    if (Array.isArray(channel.item)) items = channel.item;
    else if (Array.isArray(channel.entry)) items = channel.entry;
    else if (channel.item) items = [channel.item];
    else if (channel.entry) items = [channel.entry];

    const isGeneralSports = ["deadspin", "sportsnaut", "essentially", "fansided"].includes(source.slug);

    return items
      .map((item: any): NewsArticle | null => {
        const title = item.title?.["#text"] ?? item.title ?? "";
        const link = item.link?.["@_href"] ?? item.link ?? "";
        const description = item.description?.["#text"] ?? item.description ?? item.summary?.["#text"] ?? item.summary ?? "";
        const pubDate = item.pubDate ?? item.published ?? item["dc:date"] ?? "";
        const id = item.guid?.["#text"] ?? item.guid ?? item.id ?? link ?? title;

        if (!title || !link) return null;

        // Filter general sports feeds to baseball-relevant articles only
        if (isGeneralSports && !isBaseballRelevant(String(title), String(description))) {
          return null;
        }

        return {
          id: String(id),
          title: String(title).trim(),
          link: String(link),
          description: cleanDescription(String(description)),
          publishedAt: String(pubDate),
          publishedTimestamp: parseDate(String(pubDate)),
          source: source.name,
          sourceSlug: source.slug,
          sourceColor: source.color,
          imageUrl: extractImage(String(description)),
        };
      })
      .filter((a): a is NewsArticle => a !== null);
  } catch (err) {
    console.error(`[news] Error fetching ${source.name}:`, (err as Error).message);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const sourceFilter = req.nextUrl.searchParams.get("source") ?? "all";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 50, 200);

  // Cache all sources for 60 seconds — articles refresh frequently but we don't
  // want to hammer the upstream feeds on every page load.
  const cacheKey = "news:all";
  const allArticles = await getOrSet(cacheKey, 60_000, async () => {
    const results = await Promise.allSettled(NEWS_SOURCES.map(fetchFeed));
    const articles: NewsArticle[] = [];
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "fulfilled") {
        articles.push(...results[i].value);
      }
    }
    // Deduplicate by title (some stories appear in multiple feeds)
    const seen = new Set<string>();
    const deduped = articles.filter((a) => {
      const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Sort newest first
    deduped.sort((a, b) => b.publishedTimestamp - a.publishedTimestamp);
    return deduped;
  });

  // Filter by source if requested
  const filtered = sourceFilter !== "all"
    ? allArticles.filter((a) => a.sourceSlug === sourceFilter)
    : allArticles;

  return NextResponse.json({
    total: filtered.length,
    sources: NEWS_SOURCES.map((s) => ({
      name: s.name,
      slug: s.slug,
      color: s.color,
      trustLevel: s.trustLevel,
    })),
    articles: filtered.slice(0, limit),
    cachedAt: Date.now(),
  });
}
