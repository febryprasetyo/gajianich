import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PgDialect} from 'drizzle-orm/pg-core';
import {employees} from '../db/schema/employees';
import {employeeScopePredicate, requireHrScope, historicalScopePredicate} from './hrOrganizationScope';
import {attendanceRecords} from '../db/schema/attendance';
const scope = {module:'hr' as const,groupIds:[11],includeUnmapped:false,selectedGroupId:11};
const globalAllScope = {module:'hr' as const,groupIds:[],includeUnmapped:true,selectedGroupId:null};
test('missing HR scope fails closed before database access', () => assert.throws(() => requireHrScope({}), /scope/i));
test('employee visibility uses mapped departments and the allowed group', () => {
 const query = new PgDialect().sqlToQuery(employeeScopePredicate(scope, employees.departmentId));
 assert.match(query.sql,/department_organization_mappings/);
 assert.ok(query.params.includes(11));
 assert.doesNotMatch(query.sql,/true/i);
});
test('historical ownership uses snapshot without following current employee department', () => {
 const query = new PgDialect().sqlToQuery(historicalScopePredicate(scope, attendanceRecords.groupId));
 assert.match(query.sql,/group_id/);
 assert.doesNotMatch(query.sql,/department/);
 assert.ok(query.params.includes(11));
});
test('global admin viewing all groups: historicalScopePredicate is unrestricted (no false/null filter)', () => {
 const query = new PgDialect().sqlToQuery(historicalScopePredicate(globalAllScope, attendanceRecords.groupId));
 assert.equal(query.sql.trim(), 'true', 'should emit true, not false OR group_id IS NULL');
});
test('global admin viewing all groups: employeeScopePredicate is unrestricted', () => {
 const query = new PgDialect().sqlToQuery(employeeScopePredicate(globalAllScope, employees.departmentId));
 assert.equal(query.sql.trim(), 'true', 'should emit true, not EXISTS(false)');
});
