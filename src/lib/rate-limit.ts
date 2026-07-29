/**
 * In-memory sliding-window rate limiter.
 *
 * IMPORTANT — this is a soft cap, not a security control.
 *
 * State lives in the process, so the limit applies per instance. On a single
 * container or VPS that is the whole application and the cap is real. On
 * serverless (Vercel), each lambda has its own memory, so N concurrent
 * instances allow roughly N times the configured limit, and a cold start
 * resets the window. It is enough to stop a careless client or a naive
 * scraper from hammering the public MLB endpoints this app proxies; it is not
 * enough to stop a determined attacker.
 *
 * A shared store (Redis/Upstash) is the fix when that matters. `RateLimiter`
 * is deliberately a plain class over an injectable clock so it can be swapped
 * or wrapped without touching callers.
 */

export interface RateLimitResult {
  /** Whether this request is permitted. */
  allowed: boolean;
  /** Requests permitted per window. */
  limit: number;
  /** Requests still available in the current window. */
  remaining: number;
  /** Epoch ms when the current window frees up. */
  resetAt: number;
  /** Seconds to wait before retrying; only meaningful when blocked. */
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock, for tests. */
  now?: () => number;
  /**
   * Cap on tracked keys, so a flood of unique clients cannot grow the map
   * without bound. Oldest-active keys are dropped first when exceeded.
   */
  maxKeys?: number;
}

export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly maxKeys: number;
  /** key -> timestamps of requests inside the current window. */
  private readonly hits = new Map<string, number[]>();

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.now = options.now ?? (() => Date.now());
    this.maxKeys = options.maxKeys ?? 10_000;
  }

  /** Record a request for `key` and report whether it is allowed. */
  check(key: string): RateLimitResult {
    const now = this.now();
    const windowStart = now - this.windowMs;

    const previous = this.hits.get(key) ?? [];
    // Drop timestamps that have aged out of the window.
    const recent = previous.filter((ts) => ts > windowStart);

    if (recent.length >= this.limit) {
      // Blocked: do not record the attempt, otherwise a client that keeps
      // retrying would push its own window forward and never recover.
      const oldest = recent[0];
      const resetAt = oldest + this.windowMs;
      this.hits.set(key, recent);
      return {
        allowed: false,
        limit: this.limit,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }

    recent.push(now);
    this.hits.set(key, recent);
    this.evictIfNeeded();

    return {
      allowed: true,
      limit: this.limit,
      remaining: this.limit - recent.length,
      resetAt: recent[0] + this.windowMs,
      retryAfterSeconds: 0,
    };
  }

  /** Drop keys whose windows have fully expired; then trim oldest if still over. */
  private evictIfNeeded(): void {
    if (this.hits.size <= this.maxKeys) return;

    const windowStart = this.now() - this.windowMs;
    for (const [key, timestamps] of this.hits) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= windowStart) {
        this.hits.delete(key);
      }
    }

    // Still over budget: evict by least-recent activity. Map preserves
    // insertion order, which is close enough and avoids a full sort.
    if (this.hits.size > this.maxKeys) {
      const excess = this.hits.size - this.maxKeys;
      let removed = 0;
      for (const key of this.hits.keys()) {
        if (removed++ >= excess) break;
        this.hits.delete(key);
      }
    }
  }

  /** Number of tracked keys. Exposed for tests and diagnostics. */
  get size(): number {
    return this.hits.size;
  }

  /** Forget all state. */
  reset(): void {
    this.hits.clear();
  }
}

/**
 * Derive a client key from proxy headers.
 *
 * These headers are trivially spoofable, which is another reason this is a
 * soft cap. `x-forwarded-for` may be a comma-separated chain; the leftmost
 * entry is the original client as recorded by the first proxy.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Standard rate-limit headers for a response. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))),
  };
  if (!result.allowed) headers["Retry-After"] = String(result.retryAfterSeconds);
  return headers;
}
