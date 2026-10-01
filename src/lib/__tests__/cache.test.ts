import { test, expect, describe } from "bun:test";
import { getCached, setCached, getOrSet, clearCachePrefix } from "@/lib/cache";

// The cache is a module-level singleton with no reset hook, so every test uses
// a unique key prefix rather than trying to isolate the store.
let counter = 0;
const uniq = (label: string) => `test:${label}:${counter++}:${Math.random()}`;

describe("getCached / setCached", () => {
  test("returns a stored value before it expires", () => {
    const key = uniq("hit");
    setCached(key, { v: 1 }, 60_000);
    expect(getCached<{ v: number }>(key)).toEqual({ v: 1 });
  });

  test("returns null for an unknown key", () => {
    expect(getCached(uniq("missing"))).toBeNull();
  });

  test("treats an expired entry as a miss", async () => {
    const key = uniq("ttl");
    setCached(key, "stale", 5);
    await Bun.sleep(20);
    expect(getCached(key)).toBeNull();
  });

  test("stores falsy values without confusing them for a miss", () => {
    const zero = uniq("zero");
    const empty = uniq("empty");
    setCached(zero, 0, 60_000);
    setCached(empty, "", 60_000);
    expect(getCached<number>(zero)).toBe(0);
    expect(getCached<string>(empty)).toBe("");
  });
});

describe("getOrSet", () => {
  test("computes on miss and caches the result", async () => {
    const key = uniq("compute");
    let calls = 0;
    const fn = async () => {
      calls++;
      return "value";
    };

    expect(await getOrSet(key, 60_000, fn)).toBe("value");
    expect(await getOrSet(key, 60_000, fn)).toBe("value");
    expect(calls).toBe(1);
  });

  test("deduplicates concurrent callers into a single upstream call", async () => {
    const key = uniq("dedupe");
    let calls = 0;
    const fn = async () => {
      calls++;
      await Bun.sleep(15);
      return calls;
    };

    const results = await Promise.all([
      getOrSet(key, 60_000, fn),
      getOrSet(key, 60_000, fn),
      getOrSet(key, 60_000, fn),
    ]);

    expect(calls).toBe(1);
    expect(results).toEqual([1, 1, 1]);
  });

  test("propagates a rejection to every concurrent caller", async () => {
    const key = uniq("reject");
    const fn = async () => {
      await Bun.sleep(5);
      throw new Error("upstream down");
    };

    const settled = await Promise.allSettled([
      getOrSet(key, 60_000, fn),
      getOrSet(key, 60_000, fn),
    ]);

    expect(settled.every((r) => r.status === "rejected")).toBe(true);
  });

  test("retries after a failure instead of caching the error", async () => {
    const key = uniq("retry");
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls === 1) throw new Error("transient");
      return "recovered";
    };

    await expect(getOrSet(key, 60_000, fn)).rejects.toThrow("transient");
    // The failed attempt must not be left in the inflight map, or this hangs
    // on the dead promise and returns the original rejection forever.
    expect(await getOrSet(key, 60_000, fn)).toBe("recovered");
    expect(calls).toBe(2);
  });

  test("does not cache a rejected value", async () => {
    const key = uniq("nocache-error");
    await expect(
      getOrSet(key, 60_000, async () => {
        throw new Error("nope");
      })
    ).rejects.toThrow();
    expect(getCached(key)).toBeNull();
  });

  test("caches null as a real value", async () => {
    const key = uniq("null");
    let calls = 0;
    const fn = async () => {
      calls++;
      return null;
    };

    expect(await getOrSet(key, 60_000, fn)).toBeNull();
    expect(await getOrSet(key, 60_000, fn)).toBeNull();
    expect(calls).toBe(1);
  });

  test("supports a TTL derived from the resolved value", async () => {
    const key = uniq("dynamic-ttl");
    await getOrSet(key, (value) => value.ttl, async () => ({ ttl: 5, data: "live" }));
    expect(getCached<{ ttl: number; data: string }>(key)?.data).toBe("live");
    await Bun.sleep(20);
    expect(getCached(key)).toBeNull();
  });

  test("serves bounded stale data when a refresh fails", async () => {
    const key = uniq("stale-fallback");
    setCached(key, "last-known-good", 5);
    await Bun.sleep(20);
    let observed: unknown;

    const value = await getOrSet<string>(
      key,
      60_000,
      async () => { throw new Error("upstream unavailable"); },
      { staleIfErrorMs: 60_000, onStale: (error) => { observed = error; } }
    );

    expect(value).toBe("last-known-good");
    expect(observed).toBeInstanceOf(Error);
  });

  test("rejects when stale data is older than the fallback window", async () => {
    const key = uniq("stale-too-old");
    setCached(key, "too-old", 5);
    await Bun.sleep(30);

    await expect(getOrSet<string>(
      key,
      60_000,
      async () => { throw new Error("still down"); },
      { staleIfErrorMs: 5 }
    )).rejects.toThrow("still down");
  });
});

describe("eviction", () => {
  test("stays bounded when far more than the cap is inserted", () => {
    const prefix = uniq("evict");
    for (let i = 0; i < 1200; i++) {
      setCached(`${prefix}:${i}`, i, 60_000);
    }

    // The cap is 1000 across the whole store, so the earliest inserts must
    // have been dropped while the most recent survive.
    expect(getCached(`${prefix}:0`)).toBeNull();
    expect(getCached<number>(`${prefix}:1199`)).toBe(1199);

    clearCachePrefix(prefix);
  });

  test("clearCachePrefix removes only the matching keys", () => {
    const keep = uniq("keep");
    const drop = `drop:${counter++}`;
    setCached(keep, "kept", 60_000);
    setCached(`${drop}:a`, "a", 60_000);
    setCached(`${drop}:b`, "b", 60_000);

    clearCachePrefix(drop);

    expect(getCached(`${drop}:a`)).toBeNull();
    expect(getCached(`${drop}:b`)).toBeNull();
    expect(getCached<string>(keep)).toBe("kept");
  });
});
