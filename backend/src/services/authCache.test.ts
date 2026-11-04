import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { __setRedisForTest } from '../lib/redis.js';
import { getCachedIdentity, getCachedPermissions, invalidateAuthCache, invalidateAuthOnSuccessfulMutation } from './authCache.js';

function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    async get(k: string) { return store.get(k) ?? null; },
    async set(k: string, v: string) { store.set(k, v); return 'OK'; },
    async del(...ks: string[]) { ks.forEach((k) => store.delete(k)); return ks.length; },
    async scan(_c: string, _m: string, pattern: string) {
      const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      return ['0', [...store.keys()].filter((k) => re.test(k))] as [string, string[]];
    },
  };
}

test('identity is cached per user; inactive (null) accounts are never cached', async () => {
  __setRedisForTest(fakeRedis() as never);
  let calls = 0;
  const active = async () => { calls++; return { userId: 1 } as never; };
  await getCachedIdentity(1, active);
  await getCachedIdentity(1, active);
  assert.equal(calls, 1);

  let nullCalls = 0;
  const inactive = async () => { nullCalls++; return null; };
  assert.equal(await getCachedIdentity(2, inactive), null);
  assert.equal(await getCachedIdentity(2, inactive), null);
  assert.equal(nullCalls, 2);
  __setRedisForTest(null);
});

test('permissions are cached per role and refreshed after invalidation', async () => {
  __setRedisForTest(fakeRedis() as never);
  let version = 0;
  const loader = async () => [`perm.v${++version}`];
  assert.deepEqual(await getCachedPermissions(5, 'Admin', loader), ['perm.v1']);
  assert.deepEqual(await getCachedPermissions(5, 'Admin', loader), ['perm.v1']);
  await invalidateAuthCache();
  assert.deepEqual(await getCachedPermissions(5, 'Admin', loader), ['perm.v2']);
  __setRedisForTest(null);
});

test('mutation middleware invalidates only after a successful (2xx) response', async () => {
  const r = fakeRedis();
  __setRedisForTest(r as never);
  const run = async (statusCode: number) => {
    await getCachedIdentity(9, async () => ({ userId: 9 }) as never);
    const res = Object.assign(new EventEmitter(), { statusCode });
    let nexted = false;
    invalidateAuthOnSuccessfulMutation({ method: 'PUT' } as never, res as never, () => { nexted = true; });
    assert.ok(nexted);
    res.emit('finish');
    await new Promise((x) => setImmediate(x));
  };
  await run(500);
  assert.equal(r.store.size, 1);
  await run(200);
  assert.equal(r.store.size, 0);
  __setRedisForTest(null);
});

test('GET requests never trigger invalidation', async () => {
  const r = fakeRedis();
  __setRedisForTest(r as never);
  await getCachedIdentity(3, async () => ({ userId: 3 }) as never);
  const res = Object.assign(new EventEmitter(), { statusCode: 200 });
  invalidateAuthOnSuccessfulMutation({ method: 'GET' } as never, res as never, () => {});
  res.emit('finish');
  await new Promise((x) => setImmediate(x));
  assert.equal(r.store.size, 1);
  __setRedisForTest(null);
});
