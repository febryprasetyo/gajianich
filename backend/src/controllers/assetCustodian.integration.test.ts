import assert from 'node:assert/strict';
import test from 'node:test';
import { and, eq, inArray } from 'drizzle-orm';
import { createApp } from '../app';
import { db, closeDatabase } from '../db';
import { assetCustodians } from '../db/schema/assetCustodians';
import { assetCategories, assets, assetAssignmentHistory } from '../db/schema/assets';
import { employees } from '../db/schema/employees';
import { auditLogs } from '../db/schema/system';
import { createTestOperator } from '../testing/testOperator';
test('directory authorizes mutations, acknowledges concurrent duplicates, links and merges without changing snapshots', async () => {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${(server.address() as {
    port: number;
  }).port}/api/v1/asset-custodians`;
  const suffix = `${process.pid}${Date.now()}`;
  const operator = await createTestOperator();
  const tokens = Object.fromEntries(['SuperAdmin', 'ITStaff', 'Employee'].map(roleName => [roleName, operator.token(roleName)]));
  const ids: number[] = [];
  const employeeIds: number[] = [];
  let categoryId: number | undefined;
  let assetId: number | undefined;
  async function api(path = '', method = 'GET', body?: unknown, role = 'SuperAdmin') {
    const r = await fetch(base + path, { method, headers: { ...operator.headers(tokens[role]), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(method==='POST'&&path===''?{locationId:operator.locationId,...body as object}:body) }) });
    const result = { status: r.status, body: await r.json() as any };
    if (method === 'POST' && r.status === 201 && result.body.id)
      ids.push(result.body.id);
    return result;
  }
  try {
    assert.equal((await api('', 'POST', { displayName: 'Forbidden' }, 'ITStaff')).status, 403);
    assert.equal((await api('/resolve-employee', 'POST', { employeeId: 1 }, 'Employee')).status, 403);
    assert.equal((await api('', 'POST', { displayName: '  ' })).status, 400);
    const first = await api('', 'POST', { displayName: `Custodian Budi ${suffix}` });
    assert.equal(first.status, 201);
    assert.equal(first.body.employeeId, null);
    const duplicate = await api('', 'POST', { displayName: `Custodian Budi ${suffix}` });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, 'DUPLICATE_CANDIDATES');
    const second = await api('', 'POST', { displayName: `Custodian Budi ${suffix}`, duplicateAcknowledged: true });
    assert.equal(second.status, 201);
    assert.notEqual(second.body.id, first.body.id);
    const race = await Promise.all([api('', 'POST', { displayName: `Concurrent Zebra ${suffix}` }), api('', 'POST', { displayName: `Concurrent Zebro ${suffix}` })]);
    assert.deepEqual(race.map(r => r.status).sort(), [201, 409]);
    const search = await api(`?search=${encodeURIComponent('Custodian   Budi ' + suffix)}`);
    assert.equal(search.status, 200);
    assert.ok(search.body.custodians.some((c: any) => c.id === first.body.id));
    assert.ok(Array.isArray(search.body.employees));
    const [employee] = await db.insert(employees).values({ departmentId:operator.departmentId, employeeCode: `C${suffix}`, fullName: `Custodian Budi ${suffix}`, email: `c${suffix}@test.example` }).returning();
    employeeIds.push(employee.id);
    const hrdDuplicate = await api('', 'POST', { displayName: employee.fullName });
    assert.equal(hrdDuplicate.status, 409);
    assert.ok(hrdDuplicate.body.candidates.some((c: any) => c.candidateType === 'EMPLOYEE' && c.id === employee.id));
    const candidates = await api('/reconciliation-candidates');
    assert.ok(candidates.body.some((entry: any) => entry.custodian.id === first.body.id && entry.matches.some((e: any) => e.id === employee.id)));
    const linked = await api(`/${first.body.id}/link-employee`, 'POST', { employeeId: employee.id });
    assert.equal(linked.status, 200);
    assert.equal(linked.body.origin, 'MANUAL');
    assert.equal(linked.body.verificationStatus, 'VERIFIED');
    assert.equal((await api(`/${second.body.id}/link-employee`, 'POST', { employeeId: employee.id })).status, 409);
    const resolved = await Promise.all([api('/resolve-employee', 'POST', { employeeId: employee.id }, 'ITStaff'), api('/resolve-employee', 'POST', { employeeId: employee.id }, 'ITStaff')]);
    assert.ok(resolved.every(r => r.status === 200 && r.body.id === first.body.id));
    const [category] = await db.insert(assetCategories).values({ name: `Custodian fixture ${suffix}`, codePrefix: `C${suffix}`.slice(0, 20) }).returning();
    categoryId = category.id;
    const [asset] = await db.insert(assets).values({ locationId:operator.locationId, assetCode: `C${suffix}`, name: 'Fixture', categoryId: category.id, currentCustodianId: second.body.id, status: 'Assigned' }).returning();
    assetId = asset.id;
    const [history] = await db.insert(assetAssignmentHistory).values({ assetId: asset.id, custodianId: second.body.id, custodianNameSnapshot: 'Original immutable name', locationNameSnapshot: 'Original location', assignedByUserId: operator.userId }).returning();
    assert.equal((await api(`/${second.body.id}`, 'PATCH', { recordStatus: 'INACTIVE' })).status, 409);
    assert.equal((await api(`/${second.body.id}`, 'PATCH', { displayName: 'Renamed holder' })).status, 200);
    const merged = await api(`/${second.body.id}/merge`, 'POST', { targetCustodianId: first.body.id });
    assert.equal(merged.status, 200);
    assert.equal((await db.select().from(assets).where(eq(assets.id, asset.id)))[0].currentCustodianId, first.body.id);
    assert.equal((await db.select().from(assetCustodians).where(eq(assetCustodians.id, second.body.id)))[0].recordStatus, 'MERGED');
    const preserved = (await db.select().from(assetAssignmentHistory).where(eq(assetAssignmentHistory.id, history.id)))[0];
    assert.equal(preserved.custodianId, second.body.id);
    assert.equal(preserved.custodianNameSnapshot, 'Original immutable name');
    assert.equal(preserved.locationNameSnapshot, 'Original location');
    assert.equal((await api(`/${second.body.id}`, 'PATCH', { recordStatus: 'ACTIVE' })).status, 409);
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entity, 'ASSET_CUSTODIAN'));
    assert.ok(logs.some(l => l.entityId === second.body.id && l.action === 'MERGE' && l.userId === operator.userId));
    const custodianAssets = await api(`/${first.body.id}/assets`);
    assert.equal(custodianAssets.status, 200);
    assert.equal(custodianAssets.body.assets.length, 1);
    assert.equal(custodianAssets.body.assets[0].id, asset.id);
    assert.equal(custodianAssets.body.custodian.id, first.body.id);
  }
  finally {
    if (assetId) {
      await db.delete(assetAssignmentHistory).where(eq(assetAssignmentHistory.assetId, assetId));
      await db.delete(assets).where(eq(assets.id, assetId));
    }
    if (categoryId)
      await db.delete(assetCategories).where(eq(assetCategories.id, categoryId));
    if (ids.length) {
      await db.delete(auditLogs).where(and(eq(auditLogs.entity, 'ASSET_CUSTODIAN'), inArray(auditLogs.entityId, ids)));
      await db.delete(assetCustodians).where(inArray(assetCustodians.id, ids));
    }
    if (employeeIds.length)
      await db.delete(employees).where(inArray(employees.id, employeeIds));
    await new Promise<void>(resolve => server.close(() => resolve()));
    await operator.cleanup();
    await closeDatabase();
  }
});
