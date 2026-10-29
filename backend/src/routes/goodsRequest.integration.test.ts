import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import sharp from 'sharp';
import { createHrAuditTestDatabase } from '../testing/hrAuditDatabase';
import { runMigrations } from '../db/migrate';
import { createDocumentProfileFixture } from '../testing/documentProfileFixture';

test('GA API saves complete requests, protects evidence, handles drafts, status transitions, and signed documents', async t => {
  const fixture = await createHrAuditTestDatabase();
  const directory = await mkdtemp(path.join(tmpdir(), 'gajianich-ga-api-'));
  let closeApp = async () => {};
  t.after(async () => { await closeApp(); await fixture.cleanup(); await rm(directory, { recursive: true, force: true }); });
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  await fixture.owner.query('GRANT SELECT ON users, roles, permissions, role_permissions TO "' + fixture.runtimeRole + '"');
  const owner = await createDocumentProfileFixture(fixture.owner);
  await fixture.owner.query('GRANT SELECT ON organization_groups, organizations, user_organization_group_access, document_profiles, document_template_versions, document_identity_versions TO "' + fixture.runtimeRole + '"');
  process.env.DATABASE_URL = fixture.runtime.options.connectionString!;
  process.env.GA_STORAGE_DIR = directory;
  const { createApp } = await import('../app');
  const { closeDatabase } = await import('../db');
  const { generateToken } = await import('../utils/jwt');
  const { rows: [role] } = await fixture.owner.query("INSERT INTO roles(code,name) VALUES('super_admin','SuperAdmin') RETURNING id");
  const { rows: [user] } = await fixture.owner.query("INSERT INTO users(username,email,password_hash,role_id) VALUES('ga_test','ga_test@example.test','unused',$1) RETURNING id", [role.id]);
  const token = generateToken({ userId: Number(user.id), roleId: Number(role.id), roleName: 'SuperAdmin', email: 'ga_test@example.test' });
  const { rows: [restricted] } = await fixture.owner.query("INSERT INTO users(username,password_hash,role) VALUES('ga_restricted','unused','Employee') RETURNING id");
  const noPermission = generateToken({ userId: Number(restricted.id), roleId: 0, roleName: 'Employee', email: null });
  const missingUser = generateToken({ userId: 99999999, roleId: Number(role.id), roleName: 'SuperAdmin', email: 'missing@example.test' });
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  closeApp = async () => { await new Promise<void>(resolve => server.close(() => resolve())); await closeDatabase(); };
  const address = server.address() as { port: number };
  const base = 'http://127.0.0.1:' + address.port + '/api/v1/ga/requests';
  const image = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#fff' } }).png().toBuffer();
  const payload = {
    groupId:owner.groupId, organizationId:owner.organizationId,
    title: 'Pengadaan Laptop Staff',
    purpose: 'Karyawan baru divisi HR-GA',
    requestDate: '2026-10-20', requesterName: 'Fathiya', jobTitle: 'GA', division: 'HR-GA',
    items: [{ name: 'Laptop', quantity: 2, estimatedPrice: 6199000, subtotal: 1, notes: 'Karyawan baru', attachmentKeys: ['proof-1'] }]
  };
  function body(input = payload, buffer = image) {
    const data = new FormData(); data.append('payload', JSON.stringify({groupId:owner.groupId,organizationId:owner.organizationId,...input}));
    data.append('evidence', new Blob([new Uint8Array(buffer)], { type: 'image/png' }), 'proof-1'); return data;
  }
  const auth = { Authorization: 'Bearer ' + token, 'X-Organization-Group-Id': String(owner.groupId) };
  assert.equal((await fetch(base)).status, 401);
  assert.equal((await fetch(base, { headers: { Authorization: 'Bearer ' + noPermission } })).status, 403);
  const incomplete = { ...payload, items: [...payload.items, { ...payload.items[0], name: 'Mouse', attachmentKeys: [] }] };
  const invalid = await fetch(base, { method: 'POST', headers: auth, body: body(incomplete) });
  assert.equal(invalid.status, 400); assert.match((await invalid.json()).error, /Item 2/);
  const broken = await fetch(base, { method: 'POST', headers: auth, body: body(payload, Buffer.from('invalid image')) });
  assert.equal(broken.status, 400); assert.deepEqual(await readdir(directory), []);
  
  // Complete requests remain draft until staff decide.
  const saved = await fetch(base, { method: 'POST', headers: auth, body: body() });
  assert.equal(saved.status, 201);
  const { id } = await saved.json();
  const detail = await (await fetch(base + '/' + id, { headers: auth })).json();
  assert.equal(detail.title, 'Pengadaan Laptop Staff');
  assert.equal(detail.status, 'draft');
  assert.equal(detail.items[0].subtotal, '12398000');
  assert.equal(detail.items[0].attachments.length, 1);
  
  await fixture.owner.query("INSERT INTO ga_goods_request_items(request_id,position,name,quantity,estimated_price,subtotal) VALUES($1,2,'Mouse Wireless',1,150000,150000),($1,3,'Mouse USB',1,100000,100000)", [id]);
  await fixture.owner.query("UPDATE ga_goods_requests SET created_at = now() - interval '1 day' WHERE id=$1", [id]);
  const extraIds: string[] = [];
  for (let index = 0; index < 21; index++) {
    const { rows: [extra] } = await fixture.owner.query("INSERT INTO ga_goods_requests(id,title,purpose,status,request_date,requester_name,job_title,division,created_by) VALUES(gen_random_uuid(),'Other','', 'approved_manually','2026-10-20','Other','Staff','IT',$1) RETURNING id", [user.id]);
    extraIds.push(extra.id);
  }
  const searchResult = await (await fetch(base + '?search=mOuSe&status=draft', { headers: auth })).json();
  assert.equal(searchResult.total, 1);
  assert.equal(searchResult.items[0].id, id);
  assert.equal(searchResult.items[0].firstItemName, 'Laptop');
  assert.equal(searchResult.items[0].itemCount, 3);
  assert.deepEqual(searchResult.items[0].matchedItemNames, ['Mouse Wireless', 'Mouse USB']);
  const wrongStatus = await (await fetch(base + '?search=mouse&status=cancelled', { headers: auth })).json();
  assert.equal(wrongStatus.total, 0);
  const literalSearch = await (await fetch(base + '?search=%25', { headers: auth })).json();
  assert.equal(literalSearch.total, 0);
  await fixture.owner.query('DELETE FROM ga_goods_requests WHERE id = ANY($1::uuid[])', [extraIds]);

  await fixture.owner.query('DELETE FROM ga_goods_request_items WHERE request_id=$1 AND position>1', [id]);
  const approve = await fetch(base + '/' + id + '/status', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ toStatus: 'approved_manually' }) });
  assert.equal(approve.status, 200);
  assert.equal((await (await fetch(base + '/' + id, { headers: auth })).json()).status, 'approved_manually');

  // Approval cannot jump directly to completed.
  const invalidJump = await fetch(base + '/' + id + '/status', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStatus: 'completed', notes: 'Loncat status' })
  });
  assert.equal(invalidJump.status, 400);

  // 3. Upload signed document
  const signedDocForm = new FormData();
  signedDocForm.append('document', new Blob([new Uint8Array(image)], { type: 'image/png' }), 'scan-ttd-basah.png');
  const uploadDoc = await fetch(base + '/' + id + '/signed-document', {
    method: 'POST',
    headers: auth,
    body: signedDocForm
  });
  assert.equal(uploadDoc.status, 201);
  const signedDocRes = await uploadDoc.json();
  assert.ok(signedDocRes.id);

  // Download signed document
  const streamDoc = await fetch(base + '/' + id + '/signed-document/' + signedDocRes.id, { headers: auth });
  assert.equal(streamDoc.status, 200);

  // Cancel the approved request with an explicit reason.
  const toApproved = await fetch(base + '/' + id + '/status', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStatus: 'cancelled', notes: 'Permintaan tidak diperlukan' })
  });
  assert.equal(toApproved.status, 200);

  // 5. History audit log
  const historyRes = await fetch(base + '/' + id + '/history', { headers: auth });
  assert.equal(historyRes.status, 200);
  const history = await historyRes.json();
  assert.ok(history.length >= 2);
  assert.equal(history[history.length - 1].toStatus, 'cancelled');

  // 6. Create Draft
  const draftData = new FormData();
  draftData.append('payload', JSON.stringify({
    groupId:owner.groupId,organizationId:owner.organizationId,
    title: 'Draft Meja Kantor',
    purpose: 'Rencana',
    isDraft: true,
    items: []
  }));
  const draftSaved = await fetch(base, { method: 'POST', headers: auth, body: draftData });
  assert.equal(draftSaved.status, 201);
  const draftId = (await draftSaved.json()).id;
  const draftDetail = await (await fetch(base + '/' + draftId, { headers: auth })).json();
  assert.equal(draftDetail.status, 'draft');
  assert.equal(draftDetail.items.length, 0);

  const incompleteApproval = await fetch(base + '/' + draftId + '/status', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ toStatus: 'approved_manually' }) });
  assert.equal(incompleteApproval.status, 400);
  const rejectionWithoutReason = await fetch(base + '/' + draftId + '/status', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ toStatus: 'rejected' }) });
  assert.equal(rejectionWithoutReason.status, 400);

  // Filter list by status
  const filterList = await (await fetch(base + '?status=draft', { headers: auth })).json();
  assert.equal(filterList.items.every((it: any) => it.status === 'draft'), true);
  const reject = await fetch(base + '/' + draftId + '/status', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ toStatus: 'rejected', notes: 'Tidak diperlukan' }) });
  assert.equal(reject.status, 200);
  assert.equal((await (await fetch(base + '/' + draftId, { headers: auth })).json()).status, 'rejected');

  // 7. Edit (PUT) and Delete (DELETE) testing
  const testDraftData = new FormData();
  testDraftData.append('payload', JSON.stringify({
    groupId:owner.groupId,organizationId:owner.organizationId,
    title: 'Pengadaan Keyboard Mekanikal',
    purpose: 'Developer baru',
    requestDate: '2026-10-21',
    requesterName: 'Febry Prasetyo',
    jobTitle: 'GA',
    division: 'HRGA',
    isDraft: true,
    items: [{ name: 'Keyboard Keychron', quantity: 1, estimatedPrice: 1200000, notes: 'RGB', attachmentKeys: [] }]
  }));
  const draftCreateRes = await fetch(base, { method: 'POST', headers: auth, body: testDraftData });
  assert.equal(draftCreateRes.status, 201);
  const editableId = (await draftCreateRes.json()).id;

  // Edit draft request
  const editData = new FormData();
  editData.append('payload', JSON.stringify({
    groupId:owner.groupId,organizationId:owner.organizationId,
    title: 'Pengadaan Keyboard & Mouse',
    purpose: 'Developer baru revisi',
    requestDate: '2026-10-21',
    requesterName: 'Febry Prasetyo',
    jobTitle: 'GA',
    division: 'HRGA',
    isDraft: true,
    items: [
      { name: 'Keyboard Keychron Q1', quantity: 2, estimatedPrice: 1500000, notes: 'Revisi jumlah', attachmentKeys: [] }
    ]
  }));
  const editRes = await fetch(base + '/' + editableId, { method: 'PUT', headers: auth, body: editData });
  assert.equal(editRes.status, 200);
  const editResult = await editRes.json();
  assert.equal(editResult.version, 2);

  // Verify updated detail
  const updatedDetail = await (await fetch(base + '/' + editableId, { headers: auth })).json();
  assert.equal(updatedDetail.title, 'Pengadaan Keyboard & Mouse');
  assert.equal(updatedDetail.version, 2);
  assert.equal(updatedDetail.items[0].name, 'Keyboard Keychron Q1');
  assert.equal(updatedDetail.items[0].quantity, 2);

  // Delete draft request
  const deleteRes = await fetch(base + '/' + editableId, { method: 'DELETE', headers: auth });
  assert.equal(deleteRes.status, 200);

  // Subsequent fetch must return 404
  const deletedFetch = await fetch(base + '/' + editableId, { headers: auth });
  assert.equal(deletedFetch.status, 404);

  // Guard: Attempting to edit or delete non-editable request (e.g. cancelled/rejected/approved) must return 403
  const editLocked = await fetch(base + '/' + id, { method: 'PUT', headers: auth, body: editData });
  assert.equal(editLocked.status, 403);
  const deleteLocked = await fetch(base + '/' + id, { method: 'DELETE', headers: auth });
  assert.equal(deleteLocked.status, 403);


});
