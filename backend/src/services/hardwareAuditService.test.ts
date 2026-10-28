import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetFromAudit } from './hardwareAuditService';
import { assets, assetCategories, assetAssignmentHistory } from '../db/schema/assets';
import { assetCustodians } from '../db/schema/assetCustodians';
import { hardwareAuditLogs } from '../db/schema/hardwareAudits';

function fixture() {
  const writes: Array<{ table: unknown; values: any }> = [];
  const selected: unknown[] = [];
  const runner = {
    select: () => ({ from: (table: unknown) => {
      selected.push(table);
      const rows = table === hardwareAuditLogs ? [{ id: 91, custodianName: 'Nama Mentah Collector', serialNumber: 'TEST-SERIAL', manufacturer: 'Lenovo', model: 'T14' }]
        : table === assetCategories ? [{ id: 3, name: 'Other equipment', codePrefix: 'EQ' }]
        : table === assetCustodians ? [{ id: 81, displayName: 'Karyawan Valid Prod' }] : [];
      const result = Object.assign(Promise.resolve(rows), { limit: async () => rows });
      return { where: () => result };
    }}),
    insert: (table: unknown) => ({ values: (values: any) => {
      writes.push({ table, values });
      return { returning: async () => [{ id: 77, ...values }] };
    }}),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  };
  return { runner, writes, selected };
}

test('Available hardware stays unassigned even with a collector name and a supplied custodian', async () => {
  const { runner, writes, selected } = fixture();
  await createAssetFromAudit(91, { categoryId: 3, status: 'Available', custodianId: 81 }, 1, runner);
  const asset = writes.find(w => w.table === assets)?.values;
  assert.equal(asset.status, 'Available');
  assert.equal(asset.currentCustodianId, null);
  assert.equal(writes.filter(w => w.table === assetAssignmentHistory).length, 0);
  assert.equal(selected.includes(assetCustodians), false);
});

test('Assigned hardware uses the explicitly selected custodian ID rather than collector name', async () => {
  const { runner, writes } = fixture();
  await createAssetFromAudit(91, { categoryId: 3, status: 'Assigned', custodianId: 81 }, 1, runner);
  const asset = writes.find(w => w.table === assets)?.values;
  assert.equal(asset.status, 'Assigned');
  assert.equal(asset.currentCustodianId, 81);
  assert.equal(writes.find(w => w.table === assetAssignmentHistory)?.values.custodianId, 81);
  assert.equal(writes.filter(w => w.table === assetCustodians).length, 0);
});

test('duplicate hardware serial is rejected with the existing asset code before any write', async () => {
  const { runner, writes } = fixture();
  const originalSelect = runner.select;
  let assetQueries = 0;
  runner.select = () => ({ from: (table: unknown) => {
    if (table === assets && ++assetQueries === 1) {
      const rows = [{ id: 14, assetCode: 'LPT-2026-0013' }];
      return { where: () => Object.assign(Promise.resolve(rows), { limit: async () => rows }) };
    }
    return originalSelect().from(table);
  }});
  await assert.rejects(
    createAssetFromAudit(91, { categoryId: 3, status: 'Assigned', custodianId: 81 }, 1, runner),
    /Serial number.*TEST-SERIAL.*LPT-2026-0013.*Tautkan Spesifikasi/,
  );
  assert.equal(writes.length, 0);
});
