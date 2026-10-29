import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../app';
import { closeDatabase, pool } from '../db';
import { createTestOperator } from '../testing/testOperator';

test.after(async () => closeDatabase());

test('asset registration creates a reusable manual holder without an HR employee', async () => {
  const server = createApp().listen(0);
  const base = 'http://127.0.0.1:' + (server.address() as {port: number}).port + '/api/v1';
  const suffix = Date.now().toString(36) + process.pid;
  const operator = await createTestOperator();
  const token = operator.token();
  async function api(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, { method, headers: { ...operator.headers(token), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(path==='/assets'&&method==='POST'?{locationId:operator.locationId,...body as object}:body) });
    return { status: response.status, body: await response.json() as any };
  }
  let assetId: number | undefined;
  let categoryId: number | undefined;
  try {
    const category = await api('/assets/categories', 'POST', { name: 'Holder test ' + suffix, codePrefix: ('HC' + suffix).slice(0, 20) });
    assert.equal(category.status, 201);
    categoryId = category.body.id;
    const created = await api('/assets', 'POST', { name: 'Manual asset ' + suffix, categoryId, newCustodian: { displayName: 'Manual Holder ' + suffix, notes: 'Private IT context' } });
    assetId = created.body.id;
    assert.equal(created.status, 201);
    assert.ok(created.body.currentCustodian, 'asset must expose its reusable custodian');
    assert.equal(created.body.currentCustodian.displayName, 'Manual Holder ' + suffix);
    assert.equal(created.body.currentCustodian.employeeId, null);
    assert.equal(created.body.currentCustodian.verificationStatus, 'UNVERIFIED');
    assert.equal(created.body.status, 'Assigned');
    assert.equal(created.body.currentCustodian.notes, undefined, 'asset responses omit IT-only directory notes');
    const employeeToken = operator.token('Employee');
    const deniedSearch = await fetch(base + '/asset-custodians', { headers: { Authorization: 'Bearer ' + employeeToken } });
    assert.equal(deniedSearch.status, 403);
    const history = await api('/assets/' + assetId + '/history');
    assert.equal(history.body.assignmentHistory[0].custodianNameSnapshot, 'Manual Holder ' + suffix);
    assert.equal(history.body.assignmentHistory[0].assignedByUserId, operator.userId);
  } finally {
    if (assetId) {
      await pool.query('DELETE FROM asset_assignment_history WHERE asset_id=$1', [assetId]);
      await api('/assets/' + assetId, 'DELETE');
    }
    if (categoryId) await api('/assets/categories/' + categoryId, 'DELETE');
    await pool.query("DELETE FROM audit_logs WHERE entity = 'ASSET' AND entity_id=$1", [assetId || 0]);
    try {
      await pool.query("DELETE FROM audit_logs WHERE entity IN ('ASSET_CUSTODIAN','AssetCustodian') AND entity_id IN (SELECT id FROM asset_custodians WHERE display_name=$1)", ['Manual Holder ' + suffix]);
      await pool.query('DELETE FROM asset_custodians WHERE display_name=$1', ['Manual Holder ' + suffix]);
    } catch { /* The red test also runs before the additive migration exists. */ }
    await new Promise<void>(resolve => server.close(() => resolve()));
    await operator.cleanup();
  }
});


test('custodian lifecycle keeps history immutable and rolls back failed inline operations', async () => {
  const server = createApp().listen(0);
  const base = 'http://127.0.0.1:' + (server.address() as {port: number}).port + '/api/v1';
  const suffix = Date.now().toString(36) + process.pid;
  const operator = await createTestOperator();
  const admin = operator.token('ITAdmin');
  const staff = operator.token('ITStaff');
  const assetIds: number[] = [];
  const categoryIds: number[] = [];
  const holderNames = ['Primary ', 'Rollback ', 'Staff ', 'Alternative ', 'Inactive '].map(prefix => prefix + suffix);
  async function api(path: string, method = 'GET', body?: unknown, token = admin) {
    const response = await fetch(base + path, {method, headers: {...operator.headers(token), 'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(method==='POST'&&(path==='/assets'||path==='/asset-custodians')?{locationId:operator.locationId,...body as object}:body)});
    return {status: response.status, body: await response.json() as any};
  }
  try {
    const category = await api('/assets/categories', 'POST', {name: 'Device ' + suffix, codePrefix: ('DX' + suffix).slice(0,20)});
    assert.equal(category.status,201,JSON.stringify(category.body));
    categoryIds.push(category.body.id);
    const laptop = await api('/assets/categories', 'POST', {name: 'Laptop ' + suffix, codePrefix: ('LX' + suffix).slice(0,20)});
    assert.equal(laptop.status,201,JSON.stringify(laptop.body));
    categoryIds.push(laptop.body.id);

    const failed = await api('/assets', 'POST', {name:'Rollback asset', categoryId:category.body.id, newCustodian:{displayName:holderNames[1]}, computerSpecs:{cpuName:'CPU',ramSizeGb:8,ramSlotCount:1,disk1SizeGb:256}});
    assert.equal(failed.status,400, JSON.stringify(failed.body));
    const rollbackRows = await pool.query('SELECT id FROM asset_custodians WHERE display_name=$1',[holderNames[1]]);
    assert.equal(rollbackRows.rowCount,0,'invalid asset details must roll back inline custodian');

    const optionalSpecs = await api('/assets', 'POST', {name:'Laptop without specifications',categoryId:laptop.body.id});
    assert.equal(optionalSpecs.status,201,JSON.stringify(optionalSpecs.body));
    assetIds.push(optionalSpecs.body.id);
    assert.equal(optionalSpecs.body.computerSpecs,null);
    const partialSpecs = await api('/assets/' + optionalSpecs.body.id,'PUT',{computerSpecs:{ramSizeGb:16}});
    assert.equal(partialSpecs.status,200,JSON.stringify(partialSpecs.body));
    assert.equal(partialSpecs.body.computerSpecs.ramSizeGb,16);
    assert.equal(partialSpecs.body.computerSpecs.cpuName,null);
    const clearedSpecs = await api('/assets/' + optionalSpecs.body.id,'PUT',{computerSpecs:{cpuName:'',ramSizeGb:null}});
    assert.equal(clearedSpecs.status,200,JSON.stringify(clearedSpecs.body));
    assert.equal(clearedSpecs.body.computerSpecs,null);

    const created = await api('/assets', 'POST', {name:'Reusable asset', categoryId:category.body.id, newCustodian:{displayName:holderNames[0]}});
    assert.equal(created.status,201,JSON.stringify(created.body));
    const id = created.body.id;
    assetIds.push(id);
    const holderId = created.body.currentCustodian.id;
    const beforeEditCount = (await pool.query('SELECT count(*)::int AS count FROM asset_assignment_history WHERE asset_id=$1',[id])).rows[0].count;
    const metadataEdit = await api('/assets/' + id,'PUT',{name:'Metadata edited asset',custodianId:holderId});
    assert.equal(metadataEdit.status,200);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM asset_assignment_history WHERE asset_id=$1',[id])).rows[0].count,beforeEditCount,'editing metadata with the unchanged holder must not create a new assignment period');


    const forbidden = await api('/assets/' + id + '/assign','POST',{newCustodian:{displayName:holderNames[2]}},staff);
    assert.equal(forbidden.status,403);
    assert.equal((await pool.query('SELECT id FROM asset_custodians WHERE display_name=$1',[holderNames[2]])).rowCount,0);

    assert.equal((await api('/asset-custodians/' + holderId,'PATCH',{recordStatus:'INACTIVE'})).status,409);
    assert.equal((await api('/asset-custodians/' + holderId,'PATCH',{displayName:holderNames[0] + ' renamed'})).status,200);
    holderNames.push(holderNames[0] + ' renamed');
    const history = await api('/assets/' + id + '/history');
    assert.equal(history.body.assignmentHistory[0].custodianNameSnapshot,holderNames[0]);

    const target = await api('/asset-custodians','POST',{displayName:holderNames[3],duplicateAcknowledged:true});
    assert.equal(target.status,201);
    assert.equal((await api('/asset-custodians/' + holderId + '/merge','POST',{targetCustodianId:target.body.id})).status,200);
    const mergedAsset = await api('/assets/' + id);
    assert.equal(mergedAsset.body.currentCustodian.id,target.body.id);
    assert.equal((await api('/assets/' + id + '/history')).body.assignmentHistory[0].custodianNameSnapshot,holderNames[0]);
    assert.equal((await api('/assets/' + id + '/assign','POST',{custodianId:holderId},staff)).status,409);

    const inactive = await api('/asset-custodians','POST',{displayName:holderNames[4],duplicateAcknowledged:true});
    assert.equal(inactive.status,201);
    assert.equal((await api('/asset-custodians/' + inactive.body.id,'PATCH',{recordStatus:'INACTIVE'})).status,200);
    assert.equal((await api('/assets/' + id + '/assign','POST',{custodianId:inactive.body.id},staff)).status,409);

    assert.equal((await api('/assets/' + id + '/assign','POST',{custodianId:target.body.id,newCustodian:{displayName:'invalid'}})).status,400);
    assert.equal((await api('/assets/' + id + '/assign','POST',{assignedToEmployeeId:1})).status,400);
    const legacyEmployee = (await pool.query('INSERT INTO employees (employee_number,full_name,email) VALUES ($1,$2,$3) RETURNING id',['LEGACY-' + suffix,'Legacy person ' + suffix,'legacy-' + suffix + '@example.test'])).rows[0];
    await pool.query('UPDATE assets SET current_user_id=$1 WHERE id=$2',[legacyEmployee.id,id]);
    const reassigned = await api('/assets/' + id + '/assign','POST',{custodianId:target.body.id},staff);
    assert.equal(reassigned.status,200);
    assert.equal(reassigned.body.asset.assignedToEmployeeId,null,'response alias cannot expose retained legacy employee after reassignment');
    assert.equal(reassigned.body.asset.assignedEmployeeName,holderNames[3]);
    const returned = await api('/assets/' + id + '/unassign','POST',{},staff);
    assert.equal(returned.status,200);
    assert.equal(returned.body.asset.currentCustodianId,null);
    assert.equal(returned.body.asset.assignedToEmployeeId,null);
    assert.equal(returned.body.asset.assignedEmployeeName,null);
    // The retained physical legacy column remains untouched by new writes.
    assert.equal(Number((await pool.query('SELECT current_user_id FROM assets WHERE id=$1',[id])).rows[0].current_user_id),Number(legacyEmployee.id));
    await pool.query('UPDATE assets SET current_user_id=NULL WHERE id=$1',[id]);
    await pool.query('DELETE FROM employees WHERE id=$1',[legacyEmployee.id]);
    assert.equal((await pool.query('SELECT id FROM asset_assignment_history WHERE asset_id=$1 AND returned_at IS NULL',[id])).rowCount,0);
    assert.equal((await api('/assets/' + id + '/assign','POST',{custodianId:target.body.id},staff)).status,200);
    const edited = await api('/assets/' + id,'PUT',{custodianId:null});
    assert.equal(edited.status,200);
    assert.equal(edited.body.currentCustodian,null);
    assert.equal(edited.body.status,'Available');

    const stored = (await pool.query('SELECT current_user_id FROM assets WHERE id=$1',[id])).rows[0];
    assert.equal(stored.current_user_id,null,'new writes never populate legacy employee assignment column');
    const assignments = (await pool.query('SELECT employee_id, custodian_id, custodian_name_snapshot, assigned_by_user_id FROM asset_assignment_history WHERE asset_id=$1',[id])).rows;
    assert.ok(assignments.every(row => row.employee_id === null && row.custodian_id && row.custodian_name_snapshot && Number(row.assigned_by_user_id) === operator.userIdForRole(row.custodian_name_snapshot === holderNames[0] ? 'ITAdmin' : 'ITStaff')));
  } finally {
    for (const id of assetIds) {
      await pool.query('DELETE FROM asset_assignment_history WHERE asset_id=$1',[id]);
      await pool.query("DELETE FROM audit_logs WHERE entity='ASSET' AND entity_id=$1",[id]);
      await api('/assets/' + id,'DELETE');
    }
    for (const id of categoryIds) if (id) await api('/assets/categories/' + id,'DELETE');
    await pool.query('DELETE FROM employees WHERE employee_number=$1',['LEGACY-' + suffix]);
    try {
      await pool.query('DELETE FROM audit_logs WHERE entity_id IN (SELECT id FROM asset_custodians WHERE display_name = ANY($1)) AND entity IN (\'ASSET_CUSTODIAN\',\'AssetCustodian\')',[holderNames]);
      // Delete merge sources first to respect the canonical-holder self FK.
      await pool.query("DELETE FROM asset_custodians WHERE display_name = ANY($1) AND record_status='MERGED'",[holderNames]);
      await pool.query('DELETE FROM asset_custodians WHERE display_name = ANY($1)',[holderNames]);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await operator.cleanup();
    }
  }
});


test('deleteAsset permanently removes an asset and cleanly cascades its assignment history, specs, and accessories', async () => {
  const server = createApp().listen(0);
  const base = 'http://127.0.0.1:' + (server.address() as {port: number}).port + '/api/v1';
  const suffix = Date.now().toString(36) + process.pid;
  const operator = await createTestOperator();
  const token = operator.token();
  async function api(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, { method, headers: { ...operator.headers(token), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(path==='/assets'&&method==='POST'?{locationId:operator.locationId,...body as object}:body) });
    return { status: response.status, body: await response.json() as any };
  }
  let assetId: number | undefined;
  let categoryId: number | undefined;
  try {
    const category = await api('/assets/categories', 'POST', { name: 'Laptop ' + suffix, codePrefix: ('LP' + suffix).slice(0, 20) });
    assert.equal(category.status, 201);
    categoryId = category.body.id;

    // Create asset with custodian (which inserts assignment history)
    const created = await api('/assets', 'POST', {
      name: 'Laptop to delete ' + suffix,
      categoryId,
      newCustodian: { displayName: 'Holder for Delete ' + suffix },
      specs: { cpuName: 'Core i7', ramSizeGb: 16, ramSlotCount: 2, disk1SizeGb: 512 },
      accessories: [{ accessoryType: 'Charger', quantity: 1, condition: 'Good' }],
    });
    assert.equal(created.status, 201);
    assetId = created.body.id;

    // Verify assignment history exists
    const histBefore = await pool.query('SELECT count(*)::int as count FROM asset_assignment_history WHERE asset_id=$1', [assetId]);
    assert.ok(histBefore.rows[0].count > 0, 'asset must have assignment history records');

    // Call DELETE /assets/:id directly without manually clearing assignment history first
    const deleted = await api('/assets/' + assetId, 'DELETE');
    assert.equal(deleted.status, 200, 'DELETE /assets/:id must succeed without foreign key error');
    assert.equal(deleted.body.message, 'Asset deleted successfully');

    // Verify DB state: asset, assignment history, specs, and accessories are all gone
    const assetCheck = await pool.query('SELECT id FROM assets WHERE id=$1', [assetId]);
    assert.equal(assetCheck.rowCount, 0, 'asset must be deleted from database');
    const histCheck = await pool.query('SELECT id FROM asset_assignment_history WHERE asset_id=$1', [assetId]);
    assert.equal(histCheck.rowCount, 0, 'assignment history must be deleted');
    const specsCheck = await pool.query('SELECT id FROM asset_computer_specs WHERE asset_id=$1', [assetId]);
    assert.equal(specsCheck.rowCount, 0, 'specs must be deleted');
    const accCheck = await pool.query('SELECT id FROM asset_accessories WHERE asset_id=$1', [assetId]);
    assert.equal(accCheck.rowCount, 0, 'accessories must be deleted');

    // Deleting again returns 404
    const notFound = await api('/assets/' + assetId, 'DELETE');
    assert.equal(notFound.status, 404);

    assetId = undefined; // Successfully deleted
  } finally {
    if (assetId) {
      await pool.query('DELETE FROM asset_assignment_history WHERE asset_id=$1', [assetId]);
      await api('/assets/' + assetId, 'DELETE');
    }
    if (categoryId) await api('/assets/categories/' + categoryId, 'DELETE');
    try {
      await pool.query("DELETE FROM audit_logs WHERE entity_id IN (SELECT id FROM asset_custodians WHERE display_name=$1) AND entity IN ('ASSET_CUSTODIAN','AssetCustodian')", ['Holder for Delete ' + suffix]);
      await pool.query('DELETE FROM asset_custodians WHERE display_name=$1', ['Holder for Delete ' + suffix]);
    } catch { }
    await new Promise<void>(resolve => server.close(() => resolve()));
    await operator.cleanup();
  }
});
