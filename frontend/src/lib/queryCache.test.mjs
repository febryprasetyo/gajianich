import test from 'node:test';
import assert from 'node:assert/strict';
import { organizationRequests } from './access/organizationScope.ts';
import {
  getCachedValue,
  fetchWithCache,
  invalidateQueryCache,
  clearQueryCache,
} from './queryCache.ts';

test('deduplicates concurrent in-flight requests for the same key', async () => {
  clearQueryCache();
  organizationRequests.change(1, true);

  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 20));
    return { items: [1, 2, 3] };
  };

  const [a, b, c] = await Promise.all([
    fetchWithCache('/assets?page=1', fetcher),
    fetchWithCache('/assets?page=1', fetcher),
    fetchWithCache('/assets?page=1', fetcher),
  ]);

  assert.equal(calls, 1);
  assert.deepEqual(a, { items: [1, 2, 3] });
  assert.deepEqual(b, { items: [1, 2, 3] });
  assert.deepEqual(c, { items: [1, 2, 3] });
  assert.deepEqual(getCachedValue('/assets?page=1'), { items: [1, 2, 3] });
});

test('isolates cache entries by active organization groupId', async () => {
  clearQueryCache();

  organizationRequests.change(1, true);
  await fetchWithCache('/master/locations', async () => ['CMC-Loc']);

  organizationRequests.change(2, true);
  assert.equal(getCachedValue('/master/locations'), undefined);
  await fetchWithCache('/master/locations', async () => ['MGM-Loc']);

  assert.deepEqual(getCachedValue('/master/locations'), ['MGM-Loc']);

  organizationRequests.change(1, true);
  assert.deepEqual(getCachedValue('/master/locations'), ['CMC-Loc']);
});

test('invalidateQueryCache removes matching keys or all keys', async () => {
  clearQueryCache();
  organizationRequests.change(1, true);

  await fetchWithCache('/assets?page=1', async () => 'assets-1');
  await fetchWithCache('/tickets?page=1', async () => 'tickets-1');

  invalidateQueryCache('/assets');
  assert.equal(getCachedValue('/assets?page=1'), undefined);
  assert.equal(getCachedValue('/tickets?page=1'), 'tickets-1');

  invalidateQueryCache();
  assert.equal(getCachedValue('/tickets?page=1'), undefined);
});
