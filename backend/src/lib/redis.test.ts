import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrSetCache, invalidateCache, isCacheReady } from './redis.js';

test('redis cache module behaves gracefully when REDIS_URL is not set', async () => {
  // When REDIS_URL is not set or Redis is down, isCacheReady() must be false
  assert.equal(isCacheReady(), false);

  let callCount = 0;
  const result = await getOrSetCache('test:key', 60, async () => {
    callCount++;
    return { success: true, count: callCount };
  });

  assert.deepEqual(result, { success: true, count: 1 });
  assert.equal(callCount, 1);

  // Subsequent call still calls fallback when cache is not ready
  const result2 = await getOrSetCache('test:key', 60, async () => {
    callCount++;
    return { success: true, count: callCount };
  });

  assert.deepEqual(result2, { success: true, count: 2 });
  assert.equal(callCount, 2);

  // Invalidate does not throw error
  await assert.doesNotReject(async () => {
    await invalidateCache('test:key');
    await invalidateCache('test:*');
  });
});


import { __setRedisForTest, cacheStats, resetCacheStats } from './redis.js';

function fakeRedis() {
  const store = new Map<string, string>();
  const calls = { keys: 0, scan: 0, set: [] as unknown[][] };
  return {
    store, calls,
    async get(k: string) { return store.get(k) ?? null; },
    async set(k: string, v: string, ...rest: unknown[]) { calls.set.push([k, v, ...rest]); store.set(k, v); return 'OK'; },
    async del(...ks: string[]) { ks.forEach((k) => store.delete(k)); return ks.length; },
    async keys() { calls.keys++; return []; },
    async scan(cursor: string, _m: string, pattern: string) {
      calls.scan++;
      const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      return ['0', [...store.keys()].filter((k) => re.test(k))] as [string, string[]];
    },
  };
}

test('uses namespaced keys, TTL, and records hit/miss stats', async () => {
  const r = fakeRedis();
  __setRedisForTest(r as never);
  resetCacheStats();
  let n = 0;
  const f = async () => ({ n: ++n });
  assert.deepEqual(await getOrSetCache('a', 30, f), { n: 1 });
  assert.deepEqual(await getOrSetCache('a', 30, f), { n: 1 });
  assert.ok(r.store.has('gajianich:v1:a'));
  assert.deepEqual(r.calls.set[0].slice(2), ['EX', 30]);
  assert.deepEqual(cacheStats(), { hits: 1, misses: 1 });
  __setRedisForTest(null);
});

test('single-flight: concurrent misses share one fetch', async () => {
  __setRedisForTest(fakeRedis() as never);
  let n = 0;
  const f = async () => { n++; await new Promise((r) => setTimeout(r, 20)); return { ok: true }; };
  await Promise.all([getOrSetCache('sf', 30, f), getOrSetCache('sf', 30, f), getOrSetCache('sf', 30, f)]);
  assert.equal(n, 1);
  __setRedisForTest(null);
});

test('does not cache null/undefined results', async () => {
  const r = fakeRedis();
  __setRedisForTest(r as never);
  assert.equal(await getOrSetCache('nul', 30, async () => null), null);
  assert.equal(r.store.size, 0);
  __setRedisForTest(null);
});

test('pattern invalidation uses SCAN, never KEYS', async () => {
  const r = fakeRedis();
  __setRedisForTest(r as never);
  await getOrSetCache('p:1', 30, async () => 1);
  await getOrSetCache('p:2', 30, async () => 2);
  await getOrSetCache('q:1', 30, async () => 3);
  await invalidateCache('p:*');
  assert.deepEqual([...r.store.keys()], ['gajianich:v1:q:1']);
  assert.equal(r.calls.keys, 0);
  assert.ok(r.calls.scan > 0);
  __setRedisForTest(null);
});
