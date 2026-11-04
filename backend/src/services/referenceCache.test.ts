import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { __setRedisForTest } from '../lib/redis.js';
import type { RequestScope } from '../domain/organizationAccess.js';
import {
  formatScopeKey,
  getCachedAssetCategories,
  invalidateAssetCategoriesCache,
  getCachedMasterData,
  invalidateMasterDataCache,
  getCachedAssetDashboardSummary,
  invalidateAssetKpiCache,
  getCachedAttendanceSummary,
  invalidateAttendanceSummaryCache,
  getCachedAdmsPin,
  invalidateAdmsPinCache,
  invalidateCacheOnMutation,
} from './referenceCache.js';

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

test('formatScopeKey strictly isolates organizations (CMC vs MGM vs Global)', () => {
  const cmcScope: RequestScope = { module: 'assets', groupIds: [1], includeUnmapped: false, selectedGroupId: 1 };
  const mgmScope: RequestScope = { module: 'assets', groupIds: [2], includeUnmapped: false, selectedGroupId: 2 };
  const globalAll: RequestScope = { module: 'assets', groupIds: [2, 1], includeUnmapped: true, selectedGroupId: null };
  const globalSelectedCmc: RequestScope = { module: 'assets', groupIds: [1], includeUnmapped: false, selectedGroupId: 1 };

  assert.notEqual(formatScopeKey(cmcScope), formatScopeKey(mgmScope));
  assert.notEqual(formatScopeKey(cmcScope), formatScopeKey(globalAll));
  assert.equal(formatScopeKey(cmcScope), formatScopeKey(globalSelectedCmc));
  assert.equal(formatScopeKey(null), 'global');
});

test('organization isolation: cached master data and KPIs never leak across org scopes', async () => {
  const r = fakeRedis();
  __setRedisForTest(r as never);

  const cmcScope: RequestScope = { module: 'hr', groupIds: [1], includeUnmapped: false, selectedGroupId: 1 };
  const mgmScope: RequestScope = { module: 'hr', groupIds: [2], includeUnmapped: false, selectedGroupId: 2 };

  const cmcLocs = await getCachedMasterData('locations', cmcScope, async () => [{ id: 1, name: 'Jakarta CMC' }]);
  const mgmLocs = await getCachedMasterData('locations', mgmScope, async () => [{ id: 2, name: 'Surabaya MGM' }]);

  assert.deepEqual(cmcLocs, [{ id: 1, name: 'Jakarta CMC' }]);
  assert.deepEqual(mgmLocs, [{ id: 2, name: 'Surabaya MGM' }]);

  // Re-reading CMC still returns CMC data
  const cmcAgain = await getCachedMasterData('locations', cmcScope, async () => [{ id: 99, name: 'Wrong' }]);
  assert.deepEqual(cmcAgain, [{ id: 1, name: 'Jakarta CMC' }]);

  await invalidateMasterDataCache('locations');
  const cmcFresh = await getCachedMasterData('locations', cmcScope, async () => [{ id: 1, name: 'Jakarta CMC Updated' }]);
  assert.deepEqual(cmcFresh, [{ id: 1, name: 'Jakarta CMC Updated' }]);

  __setRedisForTest(null);
});

test('asset categories, asset KPIs, attendance summary, and ADMS PIN cache & invalidate', async () => {
  const r = fakeRedis();
  __setRedisForTest(r as never);
  const scope: RequestScope = { module: 'assets', groupIds: [1], includeUnmapped: false, selectedGroupId: 1 };

  let catCalls = 0;
  await getCachedAssetCategories(scope, async () => [{ id: ++catCalls }]);
  await getCachedAssetCategories(scope, async () => [{ id: ++catCalls }]);
  assert.equal(catCalls, 1);
  await invalidateAssetCategoriesCache();
  await getCachedAssetCategories(scope, async () => [{ id: ++catCalls }]);
  assert.equal(catCalls, 2);

  let kpiCalls = 0;
  await getCachedAssetDashboardSummary(scope, async () => ({ total: ++kpiCalls }));
  await getCachedAssetDashboardSummary(scope, async () => ({ total: ++kpiCalls }));
  assert.equal(kpiCalls, 1);
  await invalidateAssetKpiCache();
  await getCachedAssetDashboardSummary(scope, async () => ({ total: ++kpiCalls }));
  assert.equal(kpiCalls, 2);

  let attCalls = 0;
  await getCachedAttendanceSummary('user:7', '2026-11-04', async () => ({ present: ++attCalls }));
  await getCachedAttendanceSummary('user:7', '2026-11-04', async () => ({ present: ++attCalls }));
  assert.equal(attCalls, 1);
  await invalidateAttendanceSummaryCache();
  await getCachedAttendanceSummary('user:7', '2026-11-04', async () => ({ present: ++attCalls }));
  assert.equal(attCalls, 2);

  let pinCalls = 0;
  assert.equal(await getCachedAdmsPin(1, '0012', async () => { pinCalls++; return 42; }), 42);
  assert.equal(await getCachedAdmsPin(1, '0012', async () => { pinCalls++; return 99; }), 42);
  assert.equal(pinCalls, 1);
  await invalidateAdmsPinCache(1);
  assert.equal(await getCachedAdmsPin(1, '0012', async () => { pinCalls++; return 99; }), 99);

  __setRedisForTest(null);
});

test('invalidateCacheOnMutation flushes target patterns only on 2xx non-GET', async () => {
  const r = fakeRedis();
  __setRedisForTest(r as never);
  const scope: RequestScope = { module: 'assets', groupIds: [1], includeUnmapped: false, selectedGroupId: 1 };
  await getCachedAssetDashboardSummary(scope, async () => ({ total: 10 }));
  assert.equal(r.store.size, 1);

  const mw = invalidateCacheOnMutation(['kpi:assets:*']);
  const resFail = Object.assign(new EventEmitter(), { statusCode: 400 });
  mw({ method: 'POST' } as never, resFail as never, () => {});
  resFail.emit('finish');
  await new Promise((x) => setImmediate(x));
  assert.equal(r.store.size, 1);

  const resOk = Object.assign(new EventEmitter(), { statusCode: 201 });
  mw({ method: 'POST' } as never, resOk as never, () => {});
  resOk.emit('finish');
  await new Promise((x) => setImmediate(x));
  assert.equal(r.store.size, 0);

  __setRedisForTest(null);
});
