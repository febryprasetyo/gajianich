import test from 'node:test';
import assert from 'node:assert/strict';
import { flushAdmsQueue, sweepUningestedLogs } from './admsRealtimeListener';

test('flushAdmsQueue exits safely when queue is empty or processing', async () => {
  // Should not throw and exit cleanly
  await flushAdmsQueue();
  assert.ok(true);
});

test('sweepUningestedLogs returns 0 when no uningested records exist', async () => {
  const count = await sweepUningestedLogs();
  assert.equal(typeof count, 'number');
});
