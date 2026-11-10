import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import path from 'node:path';
import { createHrAuditTestDatabase } from '../testing/hrAuditDatabase';
import { runMigrations } from '../db/migrate';
import { mutateDepartment } from '../services/hrMasterMutations';
import { users, roles } from '../db/schema/users';
import type { AuditContext } from '../domain/hrAudit';

const migrations = path.resolve(__dirname, '../../drizzle');

test('Scoped Department Uniqueness Tests', async (t) => {
  const fixture = await createHrAuditTestDatabase();
  t.after(async () => { await fixture.cleanup(); });
  const { owner, runtime, runtimeRole, ownerUrl } = fixture;

  await runMigrations(ownerUrl, migrations, runtimeRole);

  await owner.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO "${runtimeRole}"`);
  await owner.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${runtimeRole}"`);
  await owner.query(`REVOKE UPDATE, DELETE, TRUNCATE ON hr_audit_events, hr_audit_targets, hr_mutation_receipts FROM "${runtimeRole}"`);

  const { rows: [cmc] } = await owner.query(
    "INSERT INTO organization_groups(code, name) VALUES('CMC','PT Citra Medika') ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id"
  );
  const { rows: [mgm] } = await owner.query(
    "INSERT INTO organization_groups(code, name) VALUES('MGM','PT Multi Gas Medika') ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id"
  );

  const cmcGroupId = Number(cmc.id);
  const mgmGroupId = Number(mgm.id);

  const adminDb = drizzle(owner);
  const [role] = await adminDb.insert(roles).values({
    name: 'HR Manager',
    code: 'hr_manager',
    isSystem: true,
  }).returning();

  const [user] = await adminDb.insert(users).values({
    username: 'hrmanager',
    email: 'hrmanager@company.local',
    passwordHash: 'dummy',
    roleId: role.id,
  }).returning();

  const db = drizzle(runtime);

  const context: AuditContext = {
    actor: { id: String(user.id), username: user.username, name: 'HR Manager' },
    operationId: randomUUID(),
  };

  const uniqueSuffix = randomUUID().slice(0, 8);
  const deptName = `MEDICARE TEST ${uniqueSuffix}`;
  const deptCode = `MDT-${uniqueSuffix.slice(0, 4)}`.toUpperCase();

  let mgmDeptId: number | null = null;
  let cmcDeptId: number | null = null;

  await t.test('1. Create department in MGM successfully', async () => {
    const res = await db.transaction(async (tx) => {
      return await mutateDepartment(tx, { ...context, operationId: randomUUID() }, {
        type: 'CREATE',
        data: {
          name: deptName,
          code: deptCode,
          groupId: mgmGroupId,
        },
      });
    });

    assert.ok(res.department.id);
    assert.equal(res.department.name, deptName);
    assert.equal(res.department.groupId, mgmGroupId);
    mgmDeptId = res.department.id;
  });

  await t.test('2. Create department with same name & code in CMC successfully (scoped uniqueness)', async () => {
    const res = await db.transaction(async (tx) => {
      return await mutateDepartment(tx, { ...context, operationId: randomUUID() }, {
        type: 'CREATE',
        data: {
          name: deptName,
          code: deptCode,
          groupId: cmcGroupId,
        },
      });
    });

    assert.ok(res.department.id);
    assert.notEqual(res.department.id, mgmDeptId);
    assert.equal(res.department.name, deptName);
    assert.equal(res.department.groupId, cmcGroupId);
    cmcDeptId = res.department.id;
  });

  await t.test('3. Duplicate department in same group (CMC) fails with 409 Conflict', async () => {
    await assert.rejects(
      async () => {
        await db.transaction(async (tx) => {
          return await mutateDepartment(tx, { ...context, operationId: randomUUID() }, {
            type: 'CREATE',
            data: {
              name: deptName,
              code: deptCode,
              groupId: cmcGroupId,
            },
          });
        });
      },
      (err: any) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /Departemen dengan nama atau kode tersebut sudah terdaftar di kelompok ini/);
        return true;
      }
    );
  });
});
