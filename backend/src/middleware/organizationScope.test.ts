import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRequestScope, parseGroupSelection } from '../domain/organizationAccess';
const access = {groupIds: [1], isGlobalAdministrator: false};
test('membership confines selected group and never grants access to unprovisioned accounts', () => {
  assert.throws(() => resolveRequestScope({access, module: 'hr', selectedGroupId: 2, mode: 'read'}));
  assert.throws(() => resolveRequestScope({access: {...access, groupIds: []}, module: 'hr', selectedGroupId: null, mode: 'read'}));
  assert.deepEqual(resolveRequestScope({access, module: 'hr', selectedGroupId: null, mode: 'write'}), {
    module: 'hr', groupIds: [1], selectedGroupId: 1, includeUnmapped: false,
  });
});
test('multi-group writes require destination; combined reads only contain memberships', () => {
  const multi = {...access, groupIds: [1,2]};
  assert.throws(() => resolveRequestScope({access: multi, module: 'ga', selectedGroupId: null, mode: 'write'}));
  assert.deepEqual(resolveRequestScope({access: multi, module: 'ga', selectedGroupId: null, mode: 'read'}).groupIds, [1,2]);
  assert.equal(resolveRequestScope({access: multi, module: 'ga', selectedGroupId: 2, mode: 'write'}).selectedGroupId, 2);
});
test('only explicit global administrator can include unresolved in combined read', () => {
  const global = {groupIds: [1,2], isGlobalAdministrator: true};
  assert.equal(resolveRequestScope({access: global, module: 'assets', selectedGroupId: null, mode: 'read'}).includeUnmapped, true);
  assert.equal(resolveRequestScope({access: global, module: 'assets', selectedGroupId: 1, mode: 'read'}).includeUnmapped, false);
  assert.throws(() => resolveRequestScope({access: global, module: 'assets', selectedGroupId: null, mode: 'write'}));
  const singleGroup = resolveRequestScope({access: {...global,groupIds:[1]}, module:'assets', selectedGroupId:null, mode:'read'});
  assert.equal(singleGroup.includeUnmapped,true,'global review remains available with one active group');
  assert.equal(singleGroup.selectedGroupId,null);
});
test('group selection rejects coercion, duplicates, overflow and ambiguous IDs', () => {
  for (const value of ['0','-1','1.5','1x','1e2',' 1','01','9007199254740992', ['1','2'], '']) assert.throws(() => parseGroupSelection(value));
  assert.equal(parseGroupSelection(undefined), null);
  assert.equal(parseGroupSelection('2'), 2);
});
