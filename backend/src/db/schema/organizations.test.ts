import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { departmentOrganizationMappings, locationOrganizationMappings, organizations, userOrganizationGroupAccess } from './organizations';
test('mapping schema constrains identities to their group and memberships to unique pairs', () => {
  for (const mapping of [departmentOrganizationMappings, locationOrganizationMappings]) {
    const config = getTableConfig(mapping);
    assert.ok(config.foreignKeys.some(fk => fk.reference().columns.map(c => c.name).join(',') === 'organization_id,group_id'));
  }
  assert.ok(getTableConfig(organizations).uniqueConstraints.some(c => c.columns.map(c => c.name).join(',') === 'id,group_id'));
  assert.equal(getTableConfig(userOrganizationGroupAccess).primaryKeys[0].columns.map(c => c.name).join(','), 'user_id,group_id');
});
