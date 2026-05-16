/**
 * In-memory API cache with TTL — reduces Firestore reads and improves
 * performance on weak networks. Cache is cleared on logout.
 */

interface CacheEntry<T> {
  data:      T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 5 * 60_000; // 5 minutes

export const apiCache = {
  set<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
  },

  get<T>(key: string): T | null {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
    return entry.data;
  },

  invalidate(key: string): void {
    store.delete(key);
  },

  invalidatePrefix(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  clear(): void {
    store.clear();
  },

  size(): number {
    return store.size;
  },
};

// Wrap any async getter with caching
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const cached = apiCache.get<T>(key);
  if (cached !== null) return cached;
  const data = await fetcher();
  apiCache.set(key, data, ttlMs);
  return data;
}
