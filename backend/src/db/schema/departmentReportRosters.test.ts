import { test } from 'node:test';
import assert from 'node:assert';
import { departmentReportRosters } from './departmentReportRosters';

test('departmentReportRosters schema defines required columns for persistent roster ordering', () => {
  assert.ok(departmentReportRosters.id, 'id column must exist');
  assert.ok(departmentReportRosters.groupId, 'groupId column must exist');
  assert.ok(departmentReportRosters.organizationId, 'organizationId column must exist');
  assert.ok(departmentReportRosters.departmentId, 'departmentId column must exist');
  assert.ok(departmentReportRosters.employeeId, 'employeeId column must exist');
  assert.ok(departmentReportRosters.coordinatorId, 'coordinatorId column must exist');
  assert.ok(departmentReportRosters.sortOrder, 'sortOrder column must exist');
  assert.ok(departmentReportRosters.isCoordinator, 'isCoordinator column must exist');
  assert.ok(departmentReportRosters.updatedById, 'updatedById column must exist');
  assert.ok(departmentReportRosters.createdAt, 'createdAt column must exist');
  assert.ok(departmentReportRosters.updatedAt, 'updatedAt column must exist');
});

