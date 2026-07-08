// Simple in-memory TTL cache to avoid hammering public MLB endpoints
// and to satisfy the "Data Caching" requirement from the brief.
//
// Two stores:
// - `store`:    committed values with TTL
// - `inflight`: in-flight promises for deduplication (thundering-herd protection)
//
// When a cache miss occurs and multiple callers call getOrSet concurrently
// with the same key, only the first caller invokes `fn()`. All other callers
// await the same in-flight promise and receive the same resolved value.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  fetchedAt: number;
}

const store = new Map<string, CacheEntry<any>>();
const inflight = new Map<string, Promise<any>>();

const MAX_ENTRIES = 1000;

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  // LRU-style eviction: if we're at the cap, drop the oldest entries first.
  if (store.size >= MAX_ENTRIES) {
    const now = Date.now();
    // First pass: drop expired entries (cheapest win)
    for (const [k, e] of store.entries()) {
      if (now > e.expiresAt) store.delete(k);
    }
    // If still over cap, drop the oldest by fetchedAt
    if (store.size >= MAX_ENTRIES) {
      const entries = Array.from(store.entries()).sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
      const toRemove = store.size - MAX_ENTRIES + 1;
      for (let i = 0; i < toRemove; i++) store.delete(entries[i][0]);
    }
  }
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    fetchedAt: Date.now(),
  });
}

/**
 * Get from cache, or compute via `fn` and cache the result.
 * Concurrent calls with the same key share the same in-flight promise,
 * preventing thundering-herd bursts when the cache expires.
 */
export function getOrSet<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) return Promise.resolve(cached);

  // Deduplicate concurrent in-flight requests
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const p = fn().then((v) => {
    setCached(key, v, ttlMs);
    inflight.delete(key);
    return v;
  }).catch((err) => {
    // On error, remove from inflight so the next caller can retry
    inflight.delete(key);
    throw err;
  });
  inflight.set(key, p);
  return p;
}

export function clearCachePrefix(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

export function cacheStats() {
  return {
    size: store.size,
    inflight: inflight.size,
    keys: Array.from(store.keys()),
  };
}
