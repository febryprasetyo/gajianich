import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHrAuditTestDatabase } from '../testing/hrAuditDatabase';
import { runMigrations } from '../db/migrate';

test('employee organization transfer requires admin permission and executes transfer cleanly', async (t) => {
  const fixture = await createHrAuditTestDatabase();
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  const original = process.env.DATABASE_URL;
  process.env.DATABASE_URL = fixture.ownerUrl;

  const { default: express } = await import('express');
  const { default: employeeRoutes } = await import('../routes/employeeRoutes');
  const { generateToken } = await import('../utils/jwt');
  const { closeDatabase } = await import('../db');

  const query = (text: string, params?: unknown[]) => fixture.owner.query(text, params);

  // 1. Seed Groups: CMC & MGM
  const groups = (
    await query(
      "INSERT INTO organization_groups(code, name) VALUES ('CMC', 'PT Cipta Mandiri Creatif'), ('MGM', 'PT Multi Gas Medika') ON CONFLICT (code) DO UPDATE SET is_active=true RETURNING id::int, code"
    )
  ).rows;
  const cmc = groups.find((g: any) => g.code === 'CMC').id;
  const mgm = groups.find((g: any) => g.code === 'MGM').id;

  // 2. Seed Roles: super_admin, it_admin, staff
  const roles = (
    await query(
      "INSERT INTO roles(code, name) VALUES ('super_admin', 'SuperAdmin'), ('it_admin', 'IT Admin'), ('employee', 'Employee') RETURNING id::int, code"
    )
  ).rows;
  const superAdminRole = roles.find((r: any) => r.code === 'super_admin').id;
  const itAdminRole = roles.find((r: any) => r.code === 'it_admin').id;
  const staffRole = roles.find((r: any) => r.code === 'employee').id;

  // 3. Seed Permissions & Grants
  const perms = ['attendance.view', 'attendance.manage', 'master.view', 'employees.transfer'];
  for (const code of perms) {
    await query("INSERT INTO permissions(code, name, module) VALUES ($1, $1, 'master') ON CONFLICT(code) DO NOTHING", [code]);
  }

  // Grant employees.transfer to it_admin
  const transferPerm = (await query("SELECT id FROM permissions WHERE code = 'employees.transfer'")).rows[0].id;
  const viewPerm = (await query("SELECT id FROM permissions WHERE code = 'attendance.view'")).rows[0].id;
  await query('INSERT INTO role_permissions(role_id, permission_id) VALUES ($1, $2)', [itAdminRole, transferPerm]);
  await query('INSERT INTO role_permissions(role_id, permission_id) VALUES ($1, $2)', [itAdminRole, viewPerm]);
  await query('INSERT INTO role_permissions(role_id, permission_id) VALUES ($1, $2)', [staffRole, viewPerm]);

  // 4. Seed Departments
  const depts = (
    await query(
      "INSERT INTO departments(name, code, is_active) VALUES ('CMC IT', 'CMC-IT', true), ('MGM Ops', 'MGM-OPS', true) RETURNING id::int, code"
    )
  ).rows;
  const cmcDeptId = depts.find((d: any) => d.code === 'CMC-IT').id;
  const mgmDeptId = depts.find((d: any) => d.code === 'MGM-OPS').id;

  await query("INSERT INTO department_organization_mappings(department_id, group_id, approval_reference) VALUES ($1, $2, 'test-map')", [cmcDeptId, cmc]);
  await query("INSERT INTO department_organization_mappings(department_id, group_id, approval_reference) VALUES ($1, $2, 'test-map')", [mgmDeptId, mgm]);

  // 5. Seed Employees: Rifa Fitrina initially in MGM
  const emps = (
    await query(
      "INSERT INTO employees(employee_number, full_name, department_id, status) VALUES ('EMP-RIFA', 'Rifa Fitrina', $1, 'Active') RETURNING id::int",
      [mgmDeptId]
    )
  ).rows;
  const rifaId = emps[0].id;

  // 6. Seed Users: Admin user & Staff user & Rifa's user account
  const { rows: [adminUser] } = await query(
    "INSERT INTO users(username, password_hash, role_id, role) VALUES ('admin1', 'hash', $1, 'SuperAdmin') RETURNING id::int",
    [superAdminRole]
  );
  const { rows: [itAdminUser] } = await query(
    "INSERT INTO users(username, password_hash, role_id, role) VALUES ('itadmin1', 'hash', $1, 'IT Admin') RETURNING id::int",
    [itAdminRole]
  );
  const { rows: [staffUser] } = await query(
    "INSERT INTO users(username, password_hash, role_id, role) VALUES ('staff1', 'hash', $1, 'Employee') RETURNING id::int",
    [staffRole]
  );
  const { rows: [rifaUser] } = await query(
    "INSERT INTO users(username, password_hash, role_id, role, employee_id) VALUES ('rifa.fitrina', 'hash', $1, 'Employee', $2) RETURNING id::int",
    [staffRole, rifaId]
  );

  // Link Rifa's account to initial MGM group
  await query('INSERT INTO user_organization_group_access(user_id, group_id) VALUES ($1, $2)', [rifaUser.id, mgm]);

  // Build Express app with routes
  const app = express();
  app.use(express.json());
  app.use('/employees', employeeRoutes);

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeDatabase();
    process.env.DATABASE_URL = original;
    await fixture.cleanup();
  });

  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const adminToken = generateToken({ userId: adminUser.id, roleId: superAdminRole, roleName: 'SuperAdmin' });
  const itAdminToken = generateToken({
    userId: itAdminUser.id,
    roleId: itAdminRole,
    roleName: 'IT Admin',
    permissions: ['employees.transfer', 'attendance.view'],
  });
  const staffToken = generateToken({
    userId: staffUser.id,
    roleId: staffRole,
    roleName: 'Employee',
    permissions: ['attendance.view'],
  });

  const callApi = async (path: string, token: string, method = 'GET', body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  };

  // Test Case 1: Staff without employees.transfer is rejected (403 Forbidden)
  const staffAttempt = await callApi(`/employees/${rifaId}/transfer`, staffToken, 'POST', {
    targetGroupId: cmc,
    targetDepartmentId: cmcDeptId,
    effectiveDate: '2026-11-09',
    reason: 'Staff unauthorized transfer',
  });
  assert.equal(staffAttempt.status, 403, 'Staff user must be forbidden from transferring');

  // Test Case 2: Validation fails when target department does not belong to target group
  const invalidDeptAttempt = await callApi(`/employees/${rifaId}/transfer`, itAdminToken, 'POST', {
    targetGroupId: cmc,
    targetDepartmentId: mgmDeptId, // Mismatch: mgmDeptId belongs to MGM, not CMC
    effectiveDate: '2026-11-09',
    reason: 'Mismatched dept test',
  });
  assert.equal(invalidDeptAttempt.status, 400, 'Should reject mismatched target department');

  // Test Case 3: Admin successfully transfers Rifa from MGM to CMC
  const successTransfer = await callApi(`/employees/${rifaId}/transfer`, itAdminToken, 'POST', {
    targetGroupId: cmc,
    targetDepartmentId: cmcDeptId,
    effectiveDate: '2026-11-09',
    reason: 'Rotasi penugasan operasional ke kantor CMC',
  });
  assert.equal(successTransfer.status, 200, 'Admin transfer must succeed');
  assert.equal(successTransfer.body.success, true);
  assert.equal(successTransfer.body.toGroup.code, 'CMC');
  assert.equal(successTransfer.body.employee.departmentId, cmcDeptId);

  // Verify in DB that employee department is updated
  const { rows: [updatedEmployee] } = await query('SELECT department_id::int FROM employees WHERE id = $1', [rifaId]);
  assert.equal(updatedEmployee.department_id, cmcDeptId);

  // Verify that Rifa's linked user account is now in CMC
  const { rows: userGroups } = await query('SELECT group_id::int FROM user_organization_group_access WHERE user_id = $1', [rifaUser.id]);
  assert.deepEqual(userGroups.map((g: any) => g.group_id), [cmc]);

  // Verify transfer record was logged in employee_organization_transfers
  const { rows: transfers } = await query('SELECT from_group_id::int, to_group_id::int, reason FROM employee_organization_transfers WHERE employee_id = $1', [rifaId]);
  assert.equal(transfers.length, 1);
  assert.equal(transfers[0].from_group_id, mgm);
  assert.equal(transfers[0].to_group_id, cmc);
  assert.equal(transfers[0].reason, 'Rotasi penugasan operasional ke kantor CMC');

  // Test Case 4: Fetch transfer history via GET /employees/:id/transfers
  const history = await callApi(`/employees/${rifaId}/transfers`, itAdminToken, 'GET');
  assert.equal(history.status, 200);
  assert.equal(history.body.length, 1);
  assert.equal(history.body[0].toGroupId, cmc);

  // Test Case 5: Transfer candidate endpoint returns groups with mapped departments
  const candidates = await callApi('/employees/transfer-candidates', itAdminToken, 'GET');
  assert.equal(candidates.status, 200);
  assert.ok(Array.isArray(candidates.body));
  const cmcCandidate = candidates.body.find((c: any) => c.code === 'CMC');
  assert.ok(cmcCandidate);
  assert.ok(cmcCandidate.departments.some((d: any) => d.id === cmcDeptId));
});
