import test from 'node:test';
import assert from 'node:assert/strict';
import { admsReadCommandStatus, buildAdmsReviewQuery, filterMonitorDevices, formatAdmsLocalTimestamp, startMonitorPolling, validateAdmsHistoryRequest, validateAdmsReviewRange, withMonitorDeadline, validateCidrInput, validateAdmsRegistration, validateNewAdmsDevice } from './admsMonitor.ts';

test('slow responses never accumulate overlapping monitor requests', async context => {
  context.mock.timers.enable(Number(process.versions.node.split('.')[0]) < 20 ? ['setTimeout'] : { apis: ['setTimeout'] });
  let calls = 0;
  let complete;
  const stop = startMonitorPolling(() => {
    calls += 1;
    return new Promise(resolve => { complete = resolve; });
  });
  await Promise.resolve();
  context.mock.timers.tick(15000);
  assert.equal(calls, 1);
  complete();
  await Promise.resolve();
  context.mock.timers.tick(4999);
  assert.equal(calls, 1);
  context.mock.timers.tick(1);
  assert.equal(calls, 2);
  stop();
  complete();
  await Promise.resolve();
  context.mock.timers.tick(15000);
  assert.equal(calls, 2);
});

test('unmount or filter change aborts the pending poll and prevents later polls', async context => {
  context.mock.timers.enable(Number(process.versions.node.split('.')[0]) < 20 ? ['setTimeout'] : { apis: ['setTimeout'] });
  let signal;
  let calls = 0;
  const stop = startMonitorPolling(async currentSignal => { signal = currentSignal; calls += 1; });
  await Promise.resolve();
  await Promise.resolve();
  stop();
  assert.equal(signal.aborted, true);
  context.mock.timers.tick(15000);
  assert.equal(calls, 1);
});

test('cleanup before initial poll prevents any request', async () => {
  let called = false;
  const stop = startMonitorPolling(async () => { called = true; });
  stop();
  await Promise.resolve();
  assert.equal(called, false);
});

test('quick filters distinguish online devices and current unmapped logs', () => {
  const devices = [{ id: 1, online: true, unmappedLogs: 0 }, { id: 2, online: false, unmappedLogs: 4 }];
  assert.deepEqual(filterMonitorDevices(devices, 'online').map(device => device.id), [1]);
  assert.deepEqual(filterMonitorDevices(devices, 'unmapped').map(device => device.id), [2]);
  assert.deepEqual(filterMonitorDevices(devices, 'all').map(device => device.id), [1, 2]);
});

test('hung transport becomes stale at the deadline and monitoring recovers on the next poll', async context => {
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  context.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    const id = ++nextTimer;
    timers.set(id, { callback, at: now + delay });
    return id;
  });
  context.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  const advance = milliseconds => {
    now += milliseconds;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= now) { timers.delete(id); timer.callback(); }
    }
  };
  const flush = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };
  let calls = 0;
  let timedOutSignal;
  let status = 'ready';
  const stop = startMonitorPolling(async lifecycle => {
    try {
      await withMonitorDeadline(signal => {
        calls += 1;
        if (calls === 1) {
          timedOutSignal = signal;
          return new Promise(() => {});
        }
        return Promise.resolve();
      }, lifecycle);
      status = 'ready';
    } catch (error) {
      if (!lifecycle.aborted) {
        assert.equal(error.name, 'TimeoutError');
        status = 'stale';
      }
    }
  });
  await flush();
  advance(9999);
  await flush();
  assert.equal(status, 'ready');
  advance(1);
  await flush();
  assert.equal(status, 'stale');
  assert.equal(timedOutSignal.aborted, true);
  advance(5000);
  await flush();
  assert.equal(calls, 2);
  assert.equal(status, 'ready');
  stop();
});

test('lifecycle cancellation aborts a hung transport without waiting for its deadline', async () => {
  const lifecycle = new AbortController();
  let requestSignal;
  const pending = withMonitorDeadline(signal => {
    requestSignal = signal;
    return new Promise(() => {});
  }, lifecycle.signal);
  lifecycle.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(requestSignal.aborted, true);
});


test('review log filters retain PIN leading zeros and use independent server pagination', () => {
  const query = new URLSearchParams(buildAdmsReviewQuery({ deviceId: '3', pin: '00123', startDate: '2026-10-01', endDate: '2026-10-30', page: 2 }));
  assert.equal(query.get('deviceId'), '3');
  assert.equal(query.get('pin'), '00123');
  assert.equal(query.get('startDate'), '2026-10-01');
  assert.equal(query.get('endDate'), '2026-10-30');
  assert.equal(query.get('page'), '2');
  assert.equal(query.get('limit'), '20');
  assert.equal(query.has('source'), false);
  assert.equal(query.has('outcome'), false);
  const empty = new URLSearchParams(buildAdmsReviewQuery({ deviceId: '', pin: '', startDate: '', endDate: '', page: 1 }));
  assert.deepEqual([...empty.keys()], ['page', 'limit']);
});

test('review date range rejects reversed dates and allows same-day or open-ended filtering', () => {
  assert.ok(validateAdmsReviewRange('2026-10-30', '2026-10-01'));
  assert.equal(validateAdmsReviewRange('2026-10-30', '2026-10-30'), null);
  assert.equal(validateAdmsReviewRange('2026-10-01', ''), null);
  assert.equal(validateAdmsReviewRange('', '2026-10-30'), null);
});

test('ADMS scan timestamps preserve device-local hours without browser timezone conversion', () => {
  assert.equal(formatAdmsLocalTimestamp('2026-10-30 07:05:09'), '30/10/2026 07:05:09');
  assert.equal(formatAdmsLocalTimestamp('2026-10-30T07:05:09.000'), '30/10/2026 07:05:09');
  assert.equal(formatAdmsLocalTimestamp('2026-10-30T07:05:09Z'), '2026-10-30T07:05:09Z');
});


test('historical requests require one group, a device, and a complete valid date range', () => {
  assert.ok(validateAdmsHistoryRequest(null, '3', '2026-10-01', '2026-10-30'));
  assert.ok(validateAdmsHistoryRequest(1, '', '2026-10-01', '2026-10-30'));
  assert.ok(validateAdmsHistoryRequest(1, '0', '2026-10-01', '2026-10-30'));
  assert.ok(validateAdmsHistoryRequest(1, '3', '', '2026-10-30'));
  assert.ok(validateAdmsHistoryRequest(1, '3', '2026-02-30', '2026-03-01'));
  assert.ok(validateAdmsHistoryRequest(1, '3', '2026-10-30', '2026-10-01'));
});

test('historical request limit counts both endpoints and works across month boundaries', () => {
  assert.equal(validateAdmsHistoryRequest(1, '3', '2026-10-01', '2026-10-31'), null);
  assert.ok(validateAdmsHistoryRequest(1, '3', '2026-10-01', '2026-11-01'));
  assert.equal(validateAdmsHistoryRequest(1, '3', '2026-10-15', '2026-11-14'), null);
  assert.ok(validateAdmsHistoryRequest(1, '3', '2026-10-15', '2026-11-15'));
  assert.equal(validateAdmsHistoryRequest(1, '3', '2026-10-30', '2026-10-30'), null);
});

test('historical command acknowledgement describes machine acceptance without claiming log completion', () => {
  assert.equal(admsReadCommandStatus('PENDING').label, 'Menunggu mesin');
  assert.equal(admsReadCommandStatus('SENT').label, 'Menunggu balasan mesin');
  assert.equal(admsReadCommandStatus('ACKNOWLEDGED').label, 'Permintaan diterima mesin');
  assert.equal(admsReadCommandStatus('UNSUPPORTED').label, 'Firmware tidak mendukung');
  assert.equal(admsReadCommandStatus('FAILED').label, 'Permintaan gagal');
  assert.equal(admsReadCommandStatus('EXPIRED').label, 'Permintaan kedaluwarsa');
});


test('deadline keeps its timeout reason even when the transport immediately rejects on abort', async context => {
  context.mock.timers.enable(Number(process.versions.node.split('.')[0]) < 20 ? ['setTimeout'] : { apis: ['setTimeout'] });
  const pending = withMonitorDeadline(signal => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted by transport', 'AbortError')));
  }), new AbortController().signal);
  context.mock.timers.tick(10000);
  await assert.rejects(pending, { name: 'TimeoutError' });
});

test('validateCidrInput validates IPv4 and subnet mask boundaries', () => {
  assert.equal(validateCidrInput('192.168.10.224'), null);
  assert.equal(validateCidrInput('192.168.10.224/32'), null);
  assert.equal(validateCidrInput('192.168.10.0/24'), null);
  assert.equal(validateCidrInput('10.0.0.0/16'), null);

  assert.ok(validateCidrInput(''));
  assert.ok(validateCidrInput('0.0.0.0'));
  assert.ok(validateCidrInput('192.168.10.256'));
  assert.ok(validateCidrInput('192.168.10.0/8'));
  assert.ok(validateCidrInput('192.168.10.0/33'));
  assert.ok(validateCidrInput('not an ip'));
});

test('validateAdmsRegistration validates group, device, serial, and cidr', () => {
  assert.equal(validateAdmsRegistration(1, '2', 'WAE4242300038', '192.168.10.4'), null);
  assert.ok(validateAdmsRegistration(null, '2', 'WAE4242300038', '192.168.10.4'));
  assert.ok(validateAdmsRegistration(1, '', 'WAE4242300038', '192.168.10.4'));
  assert.ok(validateAdmsRegistration(1, '2', '', '192.168.10.4'));
  assert.ok(validateAdmsRegistration(1, '2', 'INVALID SERIAL$$', '192.168.10.4'));
  assert.ok(validateAdmsRegistration(1, '2', 'WAE4242300038', 'invalid_cidr'));
});

test('validateNewAdmsDevice validates name, ip, port, group, serial, and cidr', () => {
  assert.equal(validateNewAdmsDevice(1, 'Absensi Baru', '192.168.10.50', 4370, 'WAE9999999999', '192.168.10.50/32'), null);
  // Auto defaults sourceCidr when empty
  assert.equal(validateNewAdmsDevice(1, 'Absensi Baru', '192.168.10.50', '4370', 'WAE9999999999', ''), null);
  assert.ok(validateNewAdmsDevice(null, 'Absensi Baru', '192.168.10.50', 4370, 'WAE9999999999', ''));
  assert.ok(validateNewAdmsDevice(1, '', '192.168.10.50', 4370, 'WAE9999999999', ''));
  assert.ok(validateNewAdmsDevice(1, 'Absensi Baru', 'not an ip', 4370, 'WAE9999999999', ''));
  assert.ok(validateNewAdmsDevice(1, 'Absensi Baru', '192.168.10.50', 99999, 'WAE9999999999', ''));
  assert.ok(validateNewAdmsDevice(1, 'Absensi Baru', '192.168.10.50', 4370, '', ''));
});
