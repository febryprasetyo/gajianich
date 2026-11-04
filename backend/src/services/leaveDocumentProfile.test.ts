import test from 'node:test';
import assert from 'node:assert/strict';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createHrAuditTestDatabase } from '../testing/hrAuditDatabase';
import { runMigrations } from '../db/migrate';
import {
  resolveDocumentProfile,
  DocumentProfileUnavailableError,
  detectImageMime,
  createOrganizationWithLogo,
  uploadOrganizationLogo,
  listOrganizationLogos,
  listLeaveDocumentOrganizations,
  getDocumentAssetById,
} from './documentProfile';

test('CMC official leave document profile resolves with approved F4 template and logo', async (t) => {
  const fixture = await createHrAuditTestDatabase();
  t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);

  const database = drizzle(fixture.owner);

  // 1. Fetch the CMC group and organization seeded by migration 0041
  const { rows: orgRows } = await fixture.owner.query("SELECT id, group_id FROM organizations WHERE code = 'CMC'");
  assert.equal(orgRows.length, 1, 'Expected canonical CMC organization');
  const cmcOrgId = Number(orgRows[0].id);
  const cmcGroupId = Number(orgRows[0].group_id);

  // 2. Resolve document profile for LEAVE
  const snapshot = await resolveDocumentProfile(database, {
    groupId: cmcGroupId,
    organizationId: cmcOrgId,
    kind: 'LEAVE',
  });

  assert.equal(snapshot.kind, 'LEAVE');
  assert.equal(snapshot.groupId, cmcGroupId);
  assert.equal(snapshot.organizationId, cmcOrgId);
  assert.equal(snapshot.layoutKey, 'cmc-leave-f4-v1');
  assert.equal(snapshot.identity.name, 'PT Cahaya Mas Cemerlang');
  assert.equal(snapshot.identity.logoAssetKey, '/images/logo-cmc.png');
  assert.equal(snapshot.labels.formNumber, '001');
  assert.equal(snapshot.labels.revisionCode, 'REV. 170208-1-W');
  assert.ok(snapshot.signatories.some(s => s.key === 'applicant'));
  assert.ok(snapshot.signatories.some(s => s.key === 'direct_supervisor'));
  assert.ok(snapshot.signatories.some(s => s.key === 'hrd'));
  assert.ok(snapshot.signatories.some(s => s.key === 'higher_supervisor'));

  // 3. MGM remains fail-closed (no official profile provisioned yet)
  const { rows: mgmRows } = await fixture.owner.query("SELECT id FROM organization_groups WHERE code = 'MGM'");
  assert.equal(mgmRows.length, 1, 'Expected MGM group');
  const mgmGroupId = Number(mgmRows[0].id);

  await assert.rejects(
    resolveDocumentProfile(database, {
      groupId: mgmGroupId,
      organizationId: cmcOrgId, // Mismatched group and org
      kind: 'LEAVE',
    }),
    DocumentProfileUnavailableError
  );
});

const SAMPLE_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

const SAMPLE_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);

const SAMPLE_WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x14, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c,
]);

test('detectImageMime validates magic bytes for PNG, JPEG, WebP and rejects SVG/others', () => {
  assert.equal(detectImageMime(SAMPLE_PNG), 'image/png');
  assert.equal(detectImageMime(SAMPLE_JPEG), 'image/jpeg');
  assert.equal(detectImageMime(SAMPLE_WEBP), 'image/webp');
  assert.equal(detectImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(detectImageMime(Buffer.from('not an image')), null);
  assert.equal(detectImageMime(Buffer.alloc(0)), null);
});

test('uploadOrganizationLogo provisions LEAVE profile, deduplicates assets, and lists leave document organizations', async (t) => {
  const fixture = await createHrAuditTestDatabase();
  t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);

  const ownerDb = drizzle(fixture.owner);
  const runtimeDb = drizzle(fixture.runtime);

  const { rows: groupRows } = await fixture.owner.query("SELECT id, code FROM organization_groups ORDER BY id");
  const cmcGroup = groupRows.find((r: any) => r.code === 'CMC');
  const mgmGroup = groupRows.find((r: any) => r.code === 'MGM');
  assert.ok(cmcGroup && mgmGroup);
  const cmcGroupId = Number(cmcGroup.id);
  const mgmGroupId = Number(mgmGroup.id);

  // Add a second organization under CMC group (without any document profile yet)
  const { rows: newOrgRows } = await fixture.owner.query(
    "INSERT INTO organizations (group_id, code, name, is_active) VALUES ($1, 'CMC_SUB', 'PT Cahaya Mitra Cemerlang', true) RETURNING id",
    [cmcGroupId]
  );
  const subOrgId = Number(newOrgRows[0].id);

  const { rows: cmcOrgRows } = await fixture.owner.query("SELECT id FROM organizations WHERE code = 'CMC'");
  const cmcOrgId = Number(cmcOrgRows[0].id);

  // List organization logos before upload -> CMC has v1 (/images/logo-cmc.png), CMC_SUB has null
  const initialLogos = await listOrganizationLogos(runtimeDb, [cmcGroupId]);
  const subInitial = initialLogos.find((item) => item.organizationId === subOrgId);
  assert.ok(subInitial);
  assert.equal(subInitial.logoAssetKey, null);
  assert.equal(subInitial.version, null);

  // Upload logo for CMC_SUB using runtimeDb (verifies runtime role permissions!)
  const uploaded1 = await uploadOrganizationLogo(runtimeDb, {
    organizationId: subOrgId,
    allowedGroupIds: [cmcGroupId],
    buffer: SAMPLE_PNG,
    userId: null,
  });
  assert.equal(uploaded1.version, 1);
  assert.match(uploaded1.logoAssetKey, /^\/api\/v1\/document-assets\/\d+$/);

  // Verify asset retrieval and group scope check
  const assetId = Number(uploaded1.logoAssetKey.split('/').pop());
  const asset = await getDocumentAssetById(runtimeDb, assetId, [cmcGroupId]);
  assert.ok(asset);
  assert.equal(asset.mimeType, 'image/png');
  assert.deepEqual(asset.content, SAMPLE_PNG);

  const assetWrongGroup = await getDocumentAssetById(runtimeDb, assetId, [mgmGroupId]);
  assert.equal(assetWrongGroup, null);

  // Resolve LEAVE profile for CMC_SUB now succeeds with the uploaded logo!
  const subSnapshot = await resolveDocumentProfile(runtimeDb, {
    groupId: cmcGroupId,
    organizationId: subOrgId,
    kind: 'LEAVE',
  });
  assert.equal(subSnapshot.identity.name, 'PT Cahaya Mitra Cemerlang');
  assert.equal(subSnapshot.identity.logoAssetKey, uploaded1.logoAssetKey);
  assert.equal(subSnapshot.layoutKey, 'cmc-leave-f4-v1');

  // Re-uploading the exact same PNG bytes deduplicates document_assets and increments identity version to 2
  const uploaded2 = await uploadOrganizationLogo(runtimeDb, {
    organizationId: subOrgId,
    allowedGroupIds: [cmcGroupId],
    buffer: SAMPLE_PNG,
    userId: null,
  });
  assert.equal(uploaded2.version, 2);
  assert.equal(uploaded2.logoAssetKey, uploaded1.logoAssetKey);

  // Create department + employee mapped to CMC org, then listLeaveDocumentOrganizations
  const { rows: deptRows } = await fixture.owner.query(
    "INSERT INTO departments (code, name, is_active) VALUES ('D-TEST', 'Dept Test', true) RETURNING id"
  );
  const deptId = Number(deptRows[0].id);
  await fixture.owner.query(
    "INSERT INTO department_organization_mappings (department_id, group_id, organization_id, approval_reference) VALUES ($1, $2, $3, 'test-ref')",
    [deptId, cmcGroupId, cmcOrgId]
  );
  const { rows: empRows } = await fixture.owner.query(
    "INSERT INTO employees (employee_number, full_name, department_id, status) VALUES ('E-001', 'Budi Santoso', $1, 'Active') RETURNING id",
    [deptId]
  );
  const empId = Number(empRows[0].id);

  const options = await listLeaveDocumentOrganizations(ownerDb, {
    groupId: cmcGroupId,
    defaultOrganizationId: cmcOrgId,
  });
  assert.equal(options.length, 2);
  const cmcOpt = options.find((o) => o.organizationId === cmcOrgId);
  const subOpt = options.find((o) => o.organizationId === subOrgId);
  assert.ok(cmcOpt && subOpt);
  assert.equal(cmcOpt.isEmployeeDefault, true);
  assert.equal(subOpt.isEmployeeDefault, false);
  assert.equal(subOpt.logoAssetKey, uploaded1.logoAssetKey);
  assert.ok(empId > 0);

  // Create a brand new organization with logo via createOrganizationWithLogo using runtimeDb
  const createdOrg = await createOrganizationWithLogo(runtimeDb, {
    groupId: cmcGroupId,
    name: 'PT Mitra Global Mandiri',
    allowedGroupIds: [cmcGroupId],
    buffer: SAMPLE_JPEG,
    userId: null,
  });
  assert.equal(createdOrg.code, 'MGM');
  assert.equal(createdOrg.name, 'PT Mitra Global Mandiri');
  assert.equal(createdOrg.version, 1);
  assert.match(createdOrg.logoAssetKey, /^\/api\/v1\/document-assets\/\d+$/);

  const optionsAfterCreate = await listLeaveDocumentOrganizations(runtimeDb, {
    groupId: cmcGroupId,
    defaultOrganizationId: cmcOrgId,
  });
  assert.equal(optionsAfterCreate.length, 3);
});

test('resolveIssuingOrganizationForLeave enforces HR permission, same group, and active LEAVE profile', async (t) => {
  const fixture = await createHrAuditTestDatabase();
  t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);

  const ownerDb = drizzle(fixture.owner);
  const runtimeDb = drizzle(fixture.runtime);

  const { rows: groupRows } = await fixture.owner.query("SELECT id, code FROM organization_groups ORDER BY id");
  const cmcGroupId = Number(groupRows.find((r: any) => r.code === 'CMC').id);
  const mgmGroupId = Number(groupRows.find((r: any) => r.code === 'MGM').id);

  const { rows: cmcOrgRows } = await fixture.owner.query("SELECT id FROM organizations WHERE code = 'CMC'");
  const cmcOrgId = Number(cmcOrgRows[0].id);

  const { rows: subOrgRows } = await fixture.owner.query(
    "INSERT INTO organizations (group_id, code, name, is_active) VALUES ($1, 'CMC_SUB2', 'PT Cahaya Sub Dua', true) RETURNING id",
    [cmcGroupId]
  );
  const subOrgId = Number(subOrgRows[0].id);

  const { rows: noProfOrgRows } = await fixture.owner.query(
    "INSERT INTO organizations (group_id, code, name, is_active) VALUES ($1, 'CMC_NOPROF', 'PT Tanpa Profil', true) RETURNING id",
    [cmcGroupId]
  );
  const noProfOrgId = Number(noProfOrgRows[0].id);

  const { rows: mgmOrgRows } = await fixture.owner.query(
    "INSERT INTO organizations (group_id, code, name, is_active) VALUES ($1, 'MGM_MAIN', 'PT MGM Utama', true) RETURNING id",
    [mgmGroupId]
  );
  const mgmOrgId = Number(mgmOrgRows[0].id);

  await uploadOrganizationLogo(runtimeDb, {
    organizationId: subOrgId,
    allowedGroupIds: [cmcGroupId],
    buffer: SAMPLE_WEBP,
    userId: null,
  });

  const { resolveIssuingOrganizationForLeave, IssuingOrganizationInvalidError } = await import('./documentProfile');

  // 1. HR choosing subOrgId in same group -> uses subOrgId and its logo
  const resolvedHr = await resolveIssuingOrganizationForLeave(runtimeDb, {
    groupId: cmcGroupId,
    defaultOrganizationId: cmcOrgId,
    requestedOrganizationId: subOrgId,
    canSelectOrganization: true,
  });
  assert.equal(resolvedHr.organizationId, subOrgId);
  assert.ok(resolvedHr.documentProfileSnapshot);
  assert.equal(resolvedHr.documentProfileSnapshot.identity.name, 'PT Cahaya Sub Dua');

  // 2. Non-HR passing requestedOrganizationId -> ignored, falls back to defaultOrganizationId (CMC)
  const resolvedNonHr = await resolveIssuingOrganizationForLeave(runtimeDb, {
    groupId: cmcGroupId,
    defaultOrganizationId: cmcOrgId,
    requestedOrganizationId: subOrgId,
    canSelectOrganization: false,
  });
  assert.equal(resolvedNonHr.organizationId, cmcOrgId);
  assert.ok(resolvedNonHr.documentProfileSnapshot);
  assert.equal(resolvedNonHr.documentProfileSnapshot.identity.name, 'PT Cahaya Mas Cemerlang');

  // 3. HR choosing org from different group -> 422 IssuingOrganizationInvalidError
  await assert.rejects(
    resolveIssuingOrganizationForLeave(runtimeDb, {
      groupId: cmcGroupId,
      defaultOrganizationId: cmcOrgId,
      requestedOrganizationId: mgmOrgId,
      canSelectOrganization: true,
    }),
    IssuingOrganizationInvalidError
  );

  // 4. HR choosing org without active LEAVE profile -> 422 IssuingOrganizationInvalidError
  await assert.rejects(
    resolveIssuingOrganizationForLeave(runtimeDb, {
      groupId: cmcGroupId,
      defaultOrganizationId: cmcOrgId,
      requestedOrganizationId: noProfOrgId,
      canSelectOrganization: true,
    }),
    IssuingOrganizationInvalidError
  );
});

test('MGM group can upload organization logo and resolve F4 leave profile without missing template error', async (t) => {
  const fixture = await createHrAuditTestDatabase();
  t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  const database = drizzle(fixture.owner);

  const { rows: mgmRows } = await fixture.owner.query("SELECT id FROM organization_groups WHERE code = 'MGM'");
  assert.equal(mgmRows.length, 1);
  const mgmGroupId = Number(mgmRows[0].id);

  // Create organization under MGM group with logo
  const created = await createOrganizationWithLogo(database, {
    groupId: mgmGroupId,
    name: 'PT Multi Gas Medika',
    code: 'MGM_TEST',
    allowedGroupIds: [mgmGroupId],
    buffer: SAMPLE_PNG,
    userId: null,
  });

  assert.equal(created.groupId, mgmGroupId);
  assert.equal(created.name, 'PT Multi Gas Medika');
  assert.equal(created.version, 1);
  assert.match(created.logoAssetKey, /^\/api\/v1\/document-assets\/\d+$/);

  // Profile resolution must succeed for MGM
  const snapshot = await resolveDocumentProfile(database, {
    groupId: mgmGroupId,
    organizationId: created.organizationId,
    kind: 'LEAVE',
  });

  assert.equal(snapshot.kind, 'LEAVE');
  assert.equal(snapshot.groupId, mgmGroupId);
  assert.equal(snapshot.organizationId, created.organizationId);
  assert.equal(snapshot.identity.name, 'PT Multi Gas Medika');
  assert.equal(snapshot.identity.logoAssetKey, created.logoAssetKey);
  assert.equal(snapshot.layoutKey, 'cmc-leave-f4-v1');
});




