import {and, eq, inArray, isNull, or, sql, type SQL, type AnyColumn} from 'drizzle-orm';
import type {RequestScope} from '../domain/organizationAccess';
import {employees} from '../db/schema/employees';
import {departmentOrganizationMappings as mappings} from '../db/schema/organizations';
import {db} from '../db';

export function requireHrScope(req: {organizationScope?: RequestScope}): RequestScope {
 const scope = req.organizationScope;
 if (!scope || scope.module !== 'hr') throw Object.assign(new Error('HR organization scope is required'), {statusCode:403});
 return scope;
}
export function historicalScopePredicate(scope: RequestScope, column: AnyColumn): SQL {
 // Global admin viewing all groups (includeUnmapped + no groupId filter) → no restriction
 if (scope.includeUnmapped && !scope.groupIds.length) return sql`true`;
 const mapped = scope.groupIds.length ? inArray(column, scope.groupIds) : sql`false`;
 return scope.includeUnmapped ? or(mapped,isNull(column))! : mapped;
}
export function employeeScopePredicate(scope: RequestScope, departmentColumn: AnyColumn = employees.departmentId): SQL {
 // Global admin viewing all groups (includeUnmapped + no groupId filter) → no restriction
 if (scope.includeUnmapped && !scope.groupIds.length) return sql`true`;
 const mapped = sql`exists (select 1 from ${mappings} where ${mappings.departmentId} = ${departmentColumn} and ${scope.groupIds.length ? inArray(mappings.groupId,scope.groupIds) : sql`false`})`;
 return scope.includeUnmapped ? or(mapped,sql`not exists (select 1 from ${mappings} where ${mappings.departmentId} = ${departmentColumn})`)! : mapped;
}
export async function requireScopedEmployee(scope: RequestScope, employeeId: number, runner: any = db) {
 const [employee] = await runner.select().from(employees).where(and(eq(employees.id,employeeId),employeeScopePredicate({...scope,includeUnmapped:false})));
 if (!employee) throw Object.assign(new Error('Employee unavailable in this organization'),{statusCode:403});
 const [mapping] = await runner.select().from(mappings).where(eq(mappings.departmentId,employee.departmentId));
 if (!mapping || (scope.selectedGroupId !== null && mapping.groupId !== scope.selectedGroupId)) throw Object.assign(new Error('Employee destination group mismatch'),{statusCode:403});
 return {...employee,groupId:mapping.groupId,organizationId:mapping.organizationId};
}
export async function requireScopedDepartment(scope: RequestScope, departmentId: number | null | undefined, runner: any = db) {
 const [mapping] = departmentId == null ? [] : await runner.select().from(mappings).where(and(eq(mappings.departmentId,departmentId),inArray(mappings.groupId,scope.groupIds)));
 if (!mapping || mapping.groupId !== scope.selectedGroupId) throw Object.assign(new Error('Department unavailable in this destination group'),{statusCode:403});
 return mapping;
}
