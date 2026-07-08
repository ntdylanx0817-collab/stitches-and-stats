// Simple in-memory TTL cache to avoid hammering public MLB endpoints
// and to satisfy the "Data Caching" requirement from the brief.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  fetchedAt: number;
}

const store = new Map<string, CacheEntry<any>>();

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
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    fetchedAt: Date.now(),
  });
}

export function getOrSet<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) return Promise.resolve(cached);
  return fn().then((v) => {
    setCached(key, v, ttlMs);
    return v;
  });
}

export function clearCachePrefix(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

export function cacheStats() {
  return {
    size: store.size,
    keys: Array.from(store.keys()),
  };
}
