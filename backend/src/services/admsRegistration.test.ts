import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceCidr, parseRegisterInput, parseToggleInput, registerAdmsDevice, toggleAdmsDevice, getAdmsCandidates } from './admsRegistration';

test('parseSourceCidr normalizes IPv4 and validates CIDR boundaries', () => {
  assert.equal(parseSourceCidr('192.168.10.224'), '192.168.10.224/32');
  assert.equal(parseSourceCidr('192.168.10.0/24'), '192.168.10.0/24');
  assert.equal(parseSourceCidr('  10.0.0.5/32  '), '10.0.0.5/32');
  assert.equal(parseSourceCidr('172.16.0.0/16'), '172.16.0.0/16');

  // Disallowed: too broad or invalid
  for (const bad of [
    '',
    '0.0.0.0/0',
    '10.0.0.0/8',
    '192.168.1.0/15',
    '256.1.1.1',
    '192.168.1.1/33',
    '192.168.1.1/-1',
    'abc',
    '192.168.1.1; DROP TABLE',
    '::1',
  ]) {
    assert.throws(() => parseSourceCidr(bad), /IP \/ CIDR tidak valid/);
  }
});

test('parseRegisterInput validates deviceId, serial, and enabled flag', () => {
  const valid = parseRegisterInput({
    deviceId: 2,
    serial: 'WAE4242300038',
    sourceCidr: '192.168.10.4',
    enabled: true,
  });
  assert.equal(valid.deviceId, 2);
  assert.equal(valid.serial, 'WAE4242300038');
  assert.equal(valid.sourceCidr, '192.168.10.4/32');
  assert.equal(valid.enabled, true);

  for (const bad of [
    { deviceId: 0, serial: 'SN123', sourceCidr: '192.168.1.1' },
    { deviceId: -1, serial: 'SN123', sourceCidr: '192.168.1.1' },
    { deviceId: 'abc', serial: 'SN123', sourceCidr: '192.168.1.1' },
    { deviceId: 1, serial: '', sourceCidr: '192.168.1.1' },
    { deviceId: 1, serial: 'SN with space', sourceCidr: '192.168.1.1' },
    { deviceId: 1, serial: 'SN123$!@', sourceCidr: '192.168.1.1' },
    { deviceId: 1, serial: 'A'.repeat(101), sourceCidr: '192.168.1.1' },
  ]) {
    assert.throws(() => parseRegisterInput(bad), /Input registrasi ADMS tidak valid/);
  }
});

test('parseToggleInput validates boolean flag', () => {
  assert.deepEqual(parseToggleInput({ enabled: true }), { enabled: true });
  assert.deepEqual(parseToggleInput({ enabled: false }), { enabled: false });
  assert.throws(() => parseToggleInput({ enabled: 'yes' }), /Status aktivasi harus berupa boolean/);
});

test('registerAdmsDevice checks scope and persists atomic changes', async () => {
  const scope: any = { module: 'hr', groupIds: [1], selectedGroupId: 1 };
  const queries: { sql: string; params?: any[] }[] = [];
  const fakeClient = {
    query: async (sql: string, params?: any[]) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT id, group_id, serial_number')) {
        return { rows: [{ id: 2, group_id: 1, serial_number: 'WAE4242300038', is_enabled: true }] };
      }
      if (sql.includes('INSERT INTO adms.devices')) {
        return { rows: [{ serial: 'WAE4242300038', device_id: '2', allowed_network: '192.168.10.4/32', enabled: true }] };
      }
      return { rows: [] };
    },
    release: () => {},
  };
  const fakePool = {
    connect: async () => fakeClient,
  };

  const result = await registerAdmsDevice(fakePool as any, scope, {
    deviceId: 2,
    serial: 'WAE4242300038',
    sourceCidr: '192.168.10.4/32',
    enabled: true,
  });

  assert.equal(result.deviceId, 2);
  assert.equal(result.serial, 'WAE4242300038');
  assert.ok(queries.some(q => q.sql === 'BEGIN'));
  assert.ok(queries.some(q => q.sql.includes("connection_type = 'ADMS'")));
  assert.ok(queries.some(q => q.sql.includes('INSERT INTO adms.devices')));
  assert.ok(queries.some(q => q.sql === 'COMMIT'));
});

test('registerAdmsDevice rejects device outside selected group', async () => {
  const scope: any = { module: 'hr', groupIds: [1], selectedGroupId: 1 };
  const fakeClient = {
    query: async (sql: string) => {
      if (sql.includes('SELECT id, group_id, serial_number')) {
        return { rows: [] }; // not found in group
      }
      return { rows: [] };
    },
    release: () => {},
  };
  const fakePool = { connect: async () => fakeClient };

  await assert.rejects(
    () => registerAdmsDevice(fakePool as any, scope, {
      deviceId: 99,
      serial: 'SN99',
      sourceCidr: '192.168.10.4/32',
      enabled: true,
    }),
    /Mesin tidak ditemukan dalam kelompok organisasi aktif/
  );
});

test('toggleAdmsDevice updates enabled status', async () => {
  const scope: any = { module: 'hr', groupIds: [1], selectedGroupId: 1 };
  const queries: { sql: string; params?: any[] }[] = [];
  const fakePool = {
    query: async (sql: string, params?: any[]) => {
      queries.push({ sql, params });
      if (sql.includes('UPDATE adms.devices')) {
        return { rowCount: 1, rows: [{ serial: 'WAE4242900026', device_id: '1', enabled: false }] };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  const res = await toggleAdmsDevice(fakePool as any, scope, 1, false);
  assert.equal(res.enabled, false);
  assert.ok(queries.some(q => q.sql.includes('UPDATE adms.devices') && q.sql.includes('SET enabled = $1')));
});

test('getAdmsCandidates returns device list with ADMS status', async () => {
  const scope: any = { module: 'hr', groupIds: [1], selectedGroupId: 1, includeUnmapped: false };
  const fakePool = {
    query: async () => ({
      rows: [
        {
          id: '1',
          name: 'Absensi Office',
          serialNumber: 'WAE4242900026',
          ip: '192.168.10.224',
          connectionType: 'ADMS',
          isEnabled: true,
          admsRegistered: true,
          admsEnabled: true,
          allowedNetwork: '192.168.10.224/32',
          lastSeenAt: '2026-10-30T05:41:24.058Z',
        },
      ],
    }),
  };

  const candidates = await getAdmsCandidates(fakePool as any, scope);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].id, 1);
  assert.equal(candidates[0].connectionType, 'ADMS');
  assert.equal(candidates[0].admsRegistered, true);
});
