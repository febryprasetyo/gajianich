import test from 'node:test';
import assert from 'node:assert/strict';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createHrAuditTestDatabase } from '../testing/hrAuditDatabase';
import { runMigrations } from '../db/migrate';
import { resolveDocumentProfile, DocumentProfileUnavailableError } from './documentProfile';

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
