import { NextResponse, type NextRequest } from "next/server";
import { RateLimiter, clientKeyFromHeaders, rateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * Rate limiting for the public API surface.
 *
 * Every route here proxies a public MLB or Baseball Savant endpoint, so an
 * unthrottled client does not just load this app — it relays that load
 * upstream under this deployment's name. The cap is mostly there to keep a
 * runaway client or a naive scraper from doing that.
 *
 * See src/lib/rate-limit.ts: this is per-instance and therefore a soft cap,
 * not a security control.
 */

const log = logger.child({ component: "rate-limit" });

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const WINDOW_MS = envInt("RATE_LIMIT_WINDOW_MS", 60_000);

/** General allowance for cheap, cached endpoints. */
const generalLimiter = new RateLimiter({
  limit: envInt("RATE_LIMIT_MAX", 120),
  windowMs: WINDOW_MS,
});

/**
 * Tighter allowance for endpoints that pull large Statcast CSVs upstream
 * behind a 30s timeout. These are by far the most expensive to serve.
 */
const expensiveLimiter = new RateLimiter({
  limit: envInt("RATE_LIMIT_MAX_EXPENSIVE", 20),
  windowMs: WINDOW_MS,
});

const EXPENSIVE_ROUTES = [
  "/api/fastest-pitches",
  "/api/home-run-derby",
  "/api/leaderboard",
  "/api/player-zones",
  "/api/simulate",
];

function isExpensive(pathname: string): boolean {
  return EXPENSIVE_ROUTES.some((route) => pathname.startsWith(route));
}

export function middleware(req: NextRequest) {
  // Opt-out for local development or self-hosted single-user deployments.
  if (process.env.RATE_LIMIT_ENABLED === "false") return NextResponse.next();

  const { pathname } = req.nextUrl;
  const expensive = isExpensive(pathname);
  const limiter = expensive ? expensiveLimiter : generalLimiter;

  // Scope the key by tier so heavy requests cannot exhaust the general
  // allowance for the same client, and vice versa.
  const key = `${expensive ? "x" : "g"}:${clientKeyFromHeaders(req.headers)}`;
  const result = limiter.check(key);
  const headers = rateLimitHeaders(result);

  if (!result.allowed) {
    log.warn("request throttled", {
      path: pathname,
      tier: expensive ? "expensive" : "general",
      limit: result.limit,
      retryAfterSeconds: result.retryAfterSeconds,
    });

    return NextResponse.json(
      { error: "rate limit exceeded", status: 429 },
      { status: 429, headers }
    );
  }

  const res = NextResponse.next();
  for (const [name, value] of Object.entries(headers)) res.headers.set(name, value);
  return res;
}

export const config = {
  // Only the API surface. Pages and static assets are served from cache and
  // are not the thing worth protecting here.
  matcher: "/api/:path*",
};
