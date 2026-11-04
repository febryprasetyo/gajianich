import { organizationCacheKey, organizationRequests } from './access/organizationScope';

export interface CacheEntry<T = unknown> {
  data: T;
  updatedAt: number;
}

const cacheStore = new Map<string, CacheEntry>();
const inflightStore = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();

export function resolveScopedKey(key: string): string {
  return organizationCacheKey(key, organizationRequests.groupId);
}

export function getCachedEntry<T>(key: string): CacheEntry<T> | undefined {
  return cacheStore.get(resolveScopedKey(key)) as CacheEntry<T> | undefined;
}

export function getCachedValue<T>(key: string): T | undefined {
  return getCachedEntry<T>(key)?.data;
}

export function setCachedValue<T>(key: string, data: T): void {
  cacheStore.set(resolveScopedKey(key), {
    data,
    updatedAt: Date.now(),
  });
}

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const scopedKey = resolveScopedKey(key);
  const existingInflight = inflightStore.get(scopedKey) as Promise<T> | undefined;
  if (existingInflight) {
    return existingInflight;
  }

  const promise = (async () => {
    const result = await fetcher();
    cacheStore.set(scopedKey, {
      data: result,
      updatedAt: Date.now(),
    });
    return result;
  })();

  inflightStore.set(scopedKey, promise);
  try {
    return await promise;
  } finally {
    inflightStore.delete(scopedKey);
  }
}

export function invalidateQueryCache(prefix?: string): void {
  if (!prefix) {
    cacheStore.clear();
  } else {
    for (const fullKey of cacheStore.keys()) {
      if (fullKey.startsWith(prefix)) {
        cacheStore.delete(fullKey);
      }
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

export function clearQueryCache(): void {
  cacheStore.clear();
  inflightStore.clear();
}

export function subscribeQueryCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
