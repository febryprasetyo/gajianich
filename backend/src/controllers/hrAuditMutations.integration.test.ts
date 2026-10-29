import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import { createHrAuditTestDatabase } from '../testing/hrAuditDatabase';
import { runMigrations } from '../db/migrate';
import { hrAuditEvents, hrAuditTargets } from '../db/schema/hrAudit';
import { users, roles } from '../db/schema/users';
import { departments } from '../db/schema/master';
import { mutateEmployee, mutateDepartment, mutateLocation, setHrSetting } from '../services/hrMasterMutations';
import type { AuditContext } from '../domain/hrAudit';

const migrations = path.resolve(__dirname, '../../drizzle');

test('HR Master Mutations & Audit Integration Tests', async (t) => {
  const fixture = await createHrAuditTestDatabase();
  t.after(async () => { await fixture.cleanup(); });
  const { owner, runtime, runtimeRole, ownerUrl } = fixture;

  await runMigrations(ownerUrl, migrations, runtimeRole);

  // Grant runtime table permissions for testing
  await owner.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO "${runtimeRole}"`);
  await owner.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${runtimeRole}"`);
  await owner.query(`REVOKE UPDATE, DELETE, TRUNCATE ON hr_audit_events, hr_audit_targets, hr_mutation_receipts FROM "${runtimeRole}"`);

  const {rows:[group]} = await owner.query("INSERT INTO organization_groups(code,name) VALUES('CMC','CMC') RETURNING id");
  const scope = {module:'hr' as const,groupIds:[Number(group.id)],selectedGroupId:Number(group.id),includeUnmapped:false};
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

  await t.test('mutateDepartment CRUD and no-op handling', async () => {
    // 1. CREATE
    const resCreate = await db.transaction(async (tx) => {
      return await mutateDepartment(tx, { ...context, operationId: randomUUID() }, {
        type: 'CREATE',
        data: { name: 'Finance Dept', code: 'FIN' },
      });
    });
    assert.ok(resCreate.department.id);
    assert.equal(resCreate.department.name, 'Finance Dept');
    assert.ok(resCreate.eventId);

    // Verify audit event
    const [createEvent] = await db.select().from(hrAuditEvents).where(eq(hrAuditEvents.id, BigInt(resCreate.eventId)));
    assert.equal(createEvent.action, 'CREATE');
    assert.equal(createEvent.entityType, 'department');

    // 2. UPDATE with change
    const deptId = resCreate.department.id;
    const resUpdate = await db.transaction(async (tx) => {
      return await mutateDepartment(tx, { ...context, operationId: randomUUID() }, {
        type: 'UPDATE',
        id: deptId,
        data: { name: 'Finance & Accounting' },
      });
    });
    assert.equal(resUpdate.department.name, 'Finance & Accounting');
    assert.ok(resUpdate.eventId);

    // 3. UPDATE no-op (same data)
    const resNoop = await db.transaction(async (tx) => {
      return await mutateDepartment(tx, { ...context, operationId: randomUUID() }, {
        type: 'UPDATE',
        id: deptId,
        data: { name: 'Finance & Accounting' },
      });
    });
    assert.equal(resNoop.eventId, null); // No event created on no-op

    // 4. DELETE
    const resDelete = await db.transaction(async (tx) => {
      return await mutateDepartment(tx, { ...context, operationId: randomUUID() }, {
        type: 'DELETE',
        id: deptId,
      });
    });
    assert.ok(resDelete.eventId);
    const [delEvent] = await db.select().from(hrAuditEvents).where(eq(hrAuditEvents.id, BigInt(resDelete.eventId)));
    assert.equal(delEvent.action, 'DELETE');

    // Verify department is deleted
    const [found] = await db.select().from(departments).where(eq(departments.id, deptId));
    assert.equal(found, undefined);
  });

  await t.test('mutateLocation CRUD and no-op handling', async () => {
    const resCreate = await db.transaction(async (tx) => {
      return await mutateLocation(tx, { ...context, operationId: randomUUID() }, {
        type: 'CREATE',
        data: { name: 'Headquarters', code: 'HQ', address: 'Jakarta' },
      });
    });
    assert.ok(resCreate.location.id);
    assert.ok(resCreate.eventId);

    const locId = resCreate.location.id;
    const resUpdate = await db.transaction(async (tx) => {
      return await mutateLocation(tx, { ...context, operationId: randomUUID() }, {
        type: 'UPDATE',
        id: locId,
        data: { address: 'Jakarta Pusat' },
      });
    });
    assert.equal(resUpdate.location.address, 'Jakarta Pusat');
    assert.ok(resUpdate.eventId);

    const resNoop = await db.transaction(async (tx) => {
      return await mutateLocation(tx, { ...context, operationId: randomUUID() }, {
        type: 'UPDATE',
        id: locId,
        data: { address: 'Jakarta Pusat' },
      });
    });
    assert.equal(resNoop.eventId, null);

    const resDelete = await db.transaction(async (tx) => {
      return await mutateLocation(tx, { ...context, operationId: randomUUID() }, {
        type: 'DELETE',
        id: locId,
      });
    });
    assert.ok(resDelete.eventId);
  });

  await t.test('mutateEmployee CREATE/UPDATE/DELETE and snapshot sanitization', async () => {
    const [dept] = await db.insert(departments).values({ name: 'HR Operations', code: 'HROPS' }).returning();
    await owner.query("INSERT INTO department_organization_mappings(department_id,group_id,approval_reference) VALUES($1,$2,'test-approved')",[dept.id,group.id]);

    // 1. CREATE employee
    const resCreate = await db.transaction(async (tx) => {
      return await mutateEmployee(tx, { ...context, operationId: randomUUID() }, {
        type: 'CREATE',
        data: {
          employeeCode: 'EMP-TEST-001',
          fullName: 'Siti Rahma',
          departmentId: dept.id,
          position: 'HR Specialist',
          status: 'Active',
          email: 'siti.rahma@company.local',
          nikKtp: '3201234567890001', // sensitive!
          npwp: '01.234.567.8-901.000', // sensitive!
          bankAccount: '123456789', // sensitive!
        },
      },scope);
    });
    assert.ok(resCreate.employee.id);
    assert.ok(resCreate.eventId);

    // Verify audit target has redacted sensitive values
    const [target] = await db.select().from(hrAuditTargets).where(eq(hrAuditTargets.eventId, BigInt(resCreate.eventId)));
    assert.ok(target);
    const after = target.after as Record<string, unknown>;
    assert.equal(after.fullName, 'Siti Rahma');
    assert.equal('nikKtp' in after, false);
    assert.equal('npwp' in after, false);
    assert.equal('bankAccount' in after, false);

    const empId = resCreate.employee.id;

    // 2. UPDATE employee
    const resUpdate = await db.transaction(async (tx) => {
      return await mutateEmployee(tx, { ...context, operationId: randomUUID() }, {
        type: 'UPDATE',
        id: empId,
        data: {
          position: 'Lead HR Specialist',
        },
      },scope);
    });
    assert.equal(resUpdate.employee.position, 'Lead HR Specialist');
    assert.ok(resUpdate.eventId);

    // 3. DELETE employee
    const resDelete = await db.transaction(async (tx) => {
      return await mutateEmployee(tx, { ...context, operationId: randomUUID() }, {
        type: 'DELETE',
        id: empId,
      },scope);
    });
    assert.ok(resDelete.eventId);
    const [delTarget] = await db.select().from(hrAuditTargets).where(eq(hrAuditTargets.eventId, BigInt(resDelete.eventId)));
    assert.equal(delTarget.entityId, String(empId));
    assert.equal(delTarget.after, null);
    assert.ok(delTarget.before);
  });

  await t.test('setHrSetting captures attendance_strict_integrity but ignores non-HR settings', async () => {
    // 1. attendance_strict_integrity -> generates audit event
    const resStrict = await db.transaction(async (tx) => {
      return await setHrSetting(tx, { ...context, operationId: randomUUID() }, {
        key: 'attendance_strict_integrity',
        value: 'true',
      });
    });
    assert.ok(resStrict.eventId);
    const [event] = await db.select().from(hrAuditEvents).where(eq(hrAuditEvents.id, BigInt(resStrict.eventId!)));
    assert.equal(event.entityType, 'hr_setting');
    assert.equal(event.entityId, 'attendance_strict_integrity');

    // 2. non-HR setting -> does NOT generate audit event
    const resOther = await db.transaction(async (tx) => {
      return await setHrSetting(tx, { ...context, operationId: randomUUID() }, {
        key: 'asset_tracking_prefix',
        value: 'AST-',
      });
    });
    assert.equal(resOther.eventId, null);
  });
});
