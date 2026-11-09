import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { departmentOrganizationMappings, locationOrganizationMappings, organizations, userOrganizationGroupAccess, employeeOrganizationTransfers } from './organizations';

test('mapping schema constrains identities to their group and memberships to unique pairs', () => {
  for (const mapping of [departmentOrganizationMappings, locationOrganizationMappings]) {
    const config = getTableConfig(mapping);
    assert.ok(config.foreignKeys.some(fk => fk.reference().columns.map(c => c.name).join(',') === 'organization_id,group_id'));
  }
  assert.ok(getTableConfig(organizations).uniqueConstraints.some(c => c.columns.map(c => c.name).join(',') === 'id,group_id'));
  assert.equal(getTableConfig(userOrganizationGroupAccess).primaryKeys[0].columns.map(c => c.name).join(','), 'user_id,group_id');
});

test('employeeOrganizationTransfers schema defines references and indexes', () => {
  const config = getTableConfig(employeeOrganizationTransfers);
  assert.equal(config.name, 'employee_organization_transfers');
  const fkCols = config.foreignKeys.map(fk => fk.reference().columns.map(c => c.name).join(','));
  assert.ok(fkCols.includes('employee_id'));
  assert.ok(fkCols.includes('from_group_id'));
  assert.ok(fkCols.includes('to_group_id'));
  assert.ok(fkCols.includes('from_department_id'));
  assert.ok(fkCols.includes('to_department_id'));
  assert.ok(fkCols.includes('transferred_by'));
  assert.ok(config.indexes.length >= 2);
});
