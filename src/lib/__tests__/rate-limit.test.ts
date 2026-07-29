import { test, expect, describe } from "bun:test";
import { RateLimiter, clientKeyFromHeaders, rateLimitHeaders } from "@/lib/rate-limit";

/** Limiter driven by a manual clock, so window behaviour is deterministic. */
function makeLimiter(limit = 3, windowMs = 1000, maxKeys?: number) {
  let clock = 1_000_000;
  const limiter = new RateLimiter({
    limit,
    windowMs,
    maxKeys,
    now: () => clock,
  });
  return {
    limiter,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("windowing", () => {
  test("allows requests up to the limit", () => {
    const { limiter } = makeLimiter(3, 1000);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
  });

  test("blocks the request that exceeds the limit", () => {
    const { limiter } = makeLimiter(3, 1000);
    limiter.check("a");
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
  });

  test("counts down remaining", () => {
    const { limiter } = makeLimiter(3, 1000);
    expect(limiter.check("a").remaining).toBe(2);
    expect(limiter.check("a").remaining).toBe(1);
    expect(limiter.check("a").remaining).toBe(0);
  });

  test("recovers once the window slides past the old hits", () => {
    const { limiter, advance } = makeLimiter(2, 1000);
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);

    advance(1001);
    expect(limiter.check("a").allowed).toBe(true);
  });

  test("slides rather than resetting in fixed buckets", () => {
    const { limiter, advance } = makeLimiter(2, 1000);
    limiter.check("a"); // t=0
    advance(600);
    limiter.check("a"); // t=600
    expect(limiter.check("a").allowed).toBe(false);

    // At t=1001 only the first hit has aged out, so exactly one slot frees up.
    advance(401);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  test("a blocked attempt does not extend the client's own window", () => {
    const { limiter, advance } = makeLimiter(1, 1000);
    limiter.check("a"); // t=0, allowed
    advance(500);
    expect(limiter.check("a").allowed).toBe(false); // t=500, blocked

    // The block must not have recorded a hit at t=500; otherwise a client
    // that retries constantly would never recover.
    advance(501); // t=1001, original hit has aged out
    expect(limiter.check("a").allowed).toBe(true);
  });
});

describe("key isolation", () => {
  test("tracks each key independently", () => {
    const { limiter } = makeLimiter(2, 1000);
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });
});

describe("reporting", () => {
  test("reports retryAfter of at least one second when blocked", () => {
    const { limiter } = makeLimiter(1, 1000);
    limiter.check("a");
    const blocked = limiter.check("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(blocked.remaining).toBe(0);
  });

  test("rateLimitHeaders emits Retry-After only when blocked", () => {
    const { limiter } = makeLimiter(1, 1000);
    const ok = rateLimitHeaders(limiter.check("a"));
    expect(ok["RateLimit-Limit"]).toBe("1");
    expect(ok["Retry-After"]).toBeUndefined();

    const blocked = rateLimitHeaders(limiter.check("a"));
    expect(blocked["Retry-After"]).toBeDefined();
    expect(blocked["RateLimit-Remaining"]).toBe("0");
  });
});

describe("memory bounds", () => {
  test("does not grow without bound across many unique keys", () => {
    const { limiter, advance } = makeLimiter(5, 1000, 50);
    for (let i = 0; i < 500; i++) {
      limiter.check(`client-${i}`);
      // Age keys out so expiry-based eviction has something to collect.
      if (i % 10 === 0) advance(200);
    }
    expect(limiter.size).toBeLessThanOrEqual(50);
  });

  test("reset clears all state", () => {
    const { limiter } = makeLimiter(1, 1000);
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    limiter.reset();
    expect(limiter.check("a").allowed).toBe(true);
  });
});

describe("clientKeyFromHeaders", () => {
  test("uses the leftmost x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" });
    expect(clientKeyFromHeaders(headers)).toBe("203.0.113.7");
  });

  test("trims surrounding whitespace", () => {
    expect(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "  198.51.100.4  " }))).toBe(
      "198.51.100.4"
    );
  });

  test("falls back to x-real-ip", () => {
    expect(clientKeyFromHeaders(new Headers({ "x-real-ip": "192.0.2.9" }))).toBe("192.0.2.9");
  });

  test("returns a stable placeholder when nothing identifies the client", () => {
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown");
  });

  test("ignores an empty x-forwarded-for and falls through", () => {
    const headers = new Headers({ "x-forwarded-for": "", "x-real-ip": "192.0.2.10" });
    expect(clientKeyFromHeaders(headers)).toBe("192.0.2.10");
  });
});
