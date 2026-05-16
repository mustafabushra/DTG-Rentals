/**
 * localStorage persistence layer — keyed by user UID.
 * Used as a fallback when Firestore returns empty data (network issues,
 * cold-start race, etc.) and to survive logout/re-login without data loss.
 */

const PREFIX = 'dtg-cache-v1';

const COLLECTIONS = [
  'owners', 'properties', 'units', 'tenants',
  'contracts', 'payments', 'maintenance',
] as const;

export type CachedCollections = {
  [K in typeof COLLECTIONS[number]]?: any[];
};

function key(uid: string, col: string) {
  return `${PREFIX}:${uid}:${col}`;
}

function safeGet(k: string): any[] {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeSet(k: string, data: any[]) {
  try { localStorage.setItem(k, JSON.stringify(data)); } catch {}
}

/** Save one collection to cache for this user. */
export function saveCacheCol(uid: string, col: string, data: any[]) {
  safeSet(key(uid, col), data);
}

/** Save all collections at once. */
export function saveCache(uid: string, data: CachedCollections) {
  for (const col of COLLECTIONS) {
    if (data[col] !== undefined) safeSet(key(uid, col), data[col]!);
  }
}

/** Load all collections from cache for this user. */
export function loadCache(uid: string): CachedCollections {
  const result: CachedCollections = {};
  for (const col of COLLECTIONS) {
    result[col] = safeGet(key(uid, col));
  }
  return result;
}

/** Returns true if the cache has at least one record across any collection. */
export function cacheHasData(uid: string): boolean {
  return COLLECTIONS.some(col => safeGet(key(uid, col)).length > 0);
}

/** Remove all cached data for this user (called on explicit reset, not logout). */
export function clearCache(uid: string) {
  for (const col of COLLECTIONS) {
    try { localStorage.removeItem(key(uid, col)); } catch {}
  }
}
