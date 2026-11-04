import Redis from 'ioredis';

let redisInstance: Redis | null = null;
let isRedisAvailable = false;

export function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  if (!redisInstance) {
    try {
      redisInstance = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          if (times > 3) {
            return null; // Stop reconnecting after 3 attempts
          }
          return Math.min(times * 100, 1000);
        },
        connectTimeout: 2000,
      });

      redisInstance.on('connect', () => {
        isRedisAvailable = true;
      });

      redisInstance.on('ready', () => {
        isRedisAvailable = true;
      });

      redisInstance.on('error', (err) => {
        isRedisAvailable = false;
        // Silent error log to prevent crashing or flooding console
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[Redis] Connection warning:', err.message);
        }
      });

      redisInstance.on('close', () => {
        isRedisAvailable = false;
      });

      // Try initial connection in background
      redisInstance.connect().catch((err) => {
        isRedisAvailable = false;
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[Redis] Initial connect failed, running in fallback mode:', err.message);
        }
      });
    } catch {
      redisInstance = null;
      isRedisAvailable = false;
    }
  }

  return redisInstance;
}

const KEY_PREFIX = 'gajianich:v1:';
const stats = { hits: 0, misses: 0 };
const inflight = new Map<string, Promise<unknown>>();
let injectedClient: Redis | null = null;

/** Test seam: inject a fake client (bypasses REDIS_URL and connection state). */
export function __setRedisForTest(client: Redis | null): void {
  injectedClient = client;
  inflight.clear();
}

export function cacheStats(): { hits: number; misses: number } {
  return { ...stats };
}

export function resetCacheStats(): void {
  stats.hits = 0;
  stats.misses = 0;
}

function activeClient(): Redis | null {
  if (injectedClient) return injectedClient;
  const client = getRedisClient();
  return isCacheReady() && client ? client : null;
}

export function isCacheReady(): boolean {
  return injectedClient !== null || (isRedisAvailable && redisInstance !== null);
}

/**
 * Get cached item or run the fetcher on miss / Redis failure.
 * Concurrent misses for the same key share one fetch (single-flight).
 * null/undefined results are never cached.
 */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fallbackFn: () => Promise<T>
): Promise<T> {
  const fullKey = KEY_PREFIX + key;
  const client = activeClient();

  if (client) {
    try {
      const cached = await client.get(fullKey);
      if (cached !== null) {
        stats.hits++;
        return JSON.parse(cached) as T;
      }
    } catch {
      // Fall through to fetcher on cache read error
    }
  }

  const pending = inflight.get(fullKey) as Promise<T> | undefined;
  if (pending) return pending;

  stats.misses++;
  const run = (async () => {
    const fresh = await fallbackFn();
    if (client && fresh !== undefined && fresh !== null) {
      try {
        await client.set(fullKey, JSON.stringify(fresh), 'EX', ttlSeconds);
      } catch {
        // Ignore cache write error
      }
    }
    return fresh;
  })();
  inflight.set(fullKey, run);
  try {
    return await run;
  } finally {
    inflight.delete(fullKey);
  }
}

/** Invalidate a single key, or every key matching a `*` pattern (via SCAN, non-blocking). */
export async function invalidateCache(keyOrPattern: string): Promise<void> {
  const client = activeClient();
  if (!client) return;
  const fullKey = KEY_PREFIX + keyOrPattern;

  try {
    if (!keyOrPattern.includes('*')) {
      await client.del(fullKey);
      return;
    }
    let cursor = '0';
    do {
      const [next, found] = await client.scan(cursor, 'MATCH', fullKey, 'COUNT', 200);
      cursor = next;
      if (found.length > 0) await client.del(...found);
    } while (cursor !== '0');
  } catch {
    // Ignore cache deletion error
  }
}
