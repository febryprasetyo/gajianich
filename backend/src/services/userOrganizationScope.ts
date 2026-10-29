import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db';
import { users, roles, rolePermissions, permissions } from '../db/schema/users';
import { employees } from '../db/schema/employees';
import { departmentOrganizationMappings, organizationGroups, userOrganizationGroupAccess } from '../db/schema/organizations';
import { loadGroupAccess } from './organizationScope';
import { canManageAccount,canAssignAccountRole } from '../domain/userOrganizationAccess';
import type { OrganizationScopedRequest } from '../middleware/organizationScope';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export class AccountAccessError extends Error { constructor(message='Account unavailable',public statusCode=404){super(message);} }
type Reader=Pick<NodePgDatabase,'select'>;
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function accountAccess(req:AuthenticatedRequest) {
  if(!req.user?.userId) throw new AccountAccessError('Authenticated account required',401);
  const access=await loadGroupAccess(req.user.userId);
  const scope=(req as OrganizationScopedRequest).organizationScope;
  if(scope && !access.isGlobalAdministrator) return {...access,groupIds:scope.groupIds};
  return access;
}
export function accountListPredicate(access:{groupIds:number[];isGlobalAdministrator:boolean},selectedGroupId:number|null):SQL {
  const groupIds=selectedGroupId===null?access.groupIds:[selectedGroupId];
  if(access.isGlobalAdministrator && selectedGroupId===null) return sql`true`;
  if(!groupIds.length) return sql`false`;
  const allowed=sql.join(groupIds.map(id=>sql`${id}`),sql`, `);
  return sql`EXISTS (SELECT 1 FROM user_organization_group_access a WHERE a.user_id=${users.id} AND a.group_id IN (${allowed}))
    AND (${access.isGlobalAdministrator} OR (
      NOT EXISTS (SELECT 1 FROM user_organization_group_access b WHERE b.user_id=${users.id} AND b.group_id NOT IN (${allowed}))
      AND NOT EXISTS (SELECT 1 FROM roles r WHERE r.id=${users.roleId} AND replace(lower(r.code),'_','')='superadmin')
      AND NOT (${users.roleId} IS NULL AND replace(lower(${users.role}),'_','')='superadmin')
      AND (${users.employeeId} IS NULL OR EXISTS (SELECT 1 FROM employees e JOIN department_organization_mappings m ON m.department_id=e.department_id WHERE e.id=${users.employeeId} AND m.group_id IN (${allowed})))
    ))`;
}
export async function assertAccountTarget(req:AuthenticatedRequest,userId:number,executor:Reader=db){
  const access=await accountAccess(req);
  const [target]=await executor.select({user:users,code:roles.code}).from(users).leftJoin(roles,eq(users.roleId,roles.id)).where(eq(users.id,userId));
  if(!target) throw new AccountAccessError();
  const groups=await executor.select({id:userOrganizationGroupAccess.groupId}).from(userOrganizationGroupAccess).where(eq(userOrganizationGroupAccess.userId,userId));
  const [employee]=target.user.employeeId ? await executor.select({groupId:departmentOrganizationMappings.groupId}).from(employees).leftJoin(departmentOrganizationMappings,eq(employees.departmentId,departmentOrganizationMappings.departmentId)).where(eq(employees.id,target.user.employeeId)) : [];
  const global=(target.user.roleId===null?target.user.role:target.code??'').toLowerCase().replace(/_/g,'')==='superadmin';
  const employeeUnmapped=target.user.employeeId!==null && !employee?.groupId;
  if(!access.isGlobalAdministrator && (employeeUnmapped || !canManageAccount(access,{groupIds:groups.map(g=>g.id),employeeGroupId:employee?.groupId??null,isGlobalAdministrator:global}))) throw new AccountAccessError();
  return {access,target:target.user,groupIds:groups.map(g=>g.id)};
}
export async function validateAccountAssignment(req:AuthenticatedRequest,input:{roleId:number;employeeId?:number|null;groupIds?:number[]},existingGroups:number[]=[],executor:Reader=db){
  const access=await accountAccess(req);
  const [role]=await executor.select().from(roles).where(eq(roles.id,input.roleId));
  if(!role) throw new AccountAccessError('Selected role does not exist',400);
  const grants=await executor.select({code:permissions.code}).from(rolePermissions).innerJoin(permissions,eq(rolePermissions.permissionId,permissions.id)).where(eq(rolePermissions.roleId,role.id));
  const hr=(req.user?.roleName??'').toLowerCase().replace(/[\s_&-]/g,'').startsWith('hrattendance') || (req.user?.roleName??'').toLowerCase()==='hrd';
  if(!canAssignAccountRole({global:access.isGlobalAdministrator,isHr:hr,callerPermissions:req.user?.permissions??[],roleCode:role.code,rolePermissions:grants.map(g=>g.code)})) throw new AccountAccessError('Role assignment outside your authority',403);
  let employeeGroup:number|null=null;
  if(input.employeeId){
    const [row]=await executor.select({id:employees.id,groupId:departmentOrganizationMappings.groupId}).from(employees).leftJoin(departmentOrganizationMappings,eq(employees.departmentId,departmentOrganizationMappings.departmentId)).where(eq(employees.id,input.employeeId));
    if(!row) throw new AccountAccessError('Selected employee does not exist',400);
    employeeGroup=row.groupId;
    if(!access.isGlobalAdministrator && (!employeeGroup || !access.groupIds.includes(employeeGroup))) throw new AccountAccessError('Employee outside your group',403);
  }
  const groups=[...new Set(input.groupIds ?? (employeeGroup?[employeeGroup]:existingGroups.length?existingGroups:(req as OrganizationScopedRequest).organizationScope?.selectedGroupId?[(req as OrganizationScopedRequest).organizationScope!.selectedGroupId!]:[]))];
  if(!access.isGlobalAdministrator && (!groups.length || groups.some(id=>!access.groupIds.includes(id)))) throw new AccountAccessError('Group assignment outside your authority',403);
  if(employeeGroup && !groups.includes(employeeGroup)) throw new AccountAccessError('Employee group must be included in account membership',400);
  const active=groups.length?await executor.select({id:organizationGroups.id}).from(organizationGroups).where(and(inArray(organizationGroups.id,groups),eq(organizationGroups.isActive,true))):[];
  if(active.length!==groups.length) throw new AccountAccessError('Group unavailable',400);
  return groups;
}
export async function withAccountMutation<T>(req:AuthenticatedRequest,userId:number,work:(tx:Tx)=>Promise<T>):Promise<T>{
  return db.transaction(async tx=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(697165001)`);
    await tx.execute(sql`SELECT id FROM users WHERE id=${userId} FOR UPDATE`);
    const {target}=await assertAccountTarget(req,userId,tx);
    const [role]=target.roleId?await tx.select().from(roles).where(eq(roles.id,target.roleId)):[];
    const global=(target.roleId===null?target.role:role?.code??'').toLowerCase().replace(/_/g,'')==='superadmin';
    const [nextRole]=req.body?.roleId?await tx.select().from(roles).where(eq(roles.id,req.body.roleId)):[];
    const demoting=nextRole && nextRole.code.replace(/_/g,'').toLowerCase()!=='superadmin';
    if(global && (req.method==='DELETE'||req.body?.status==='inactive'||demoting)){
      const admins=await tx.execute<{count:string}>(sql`SELECT count(*)::text AS count FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE lower(u.status)='active' AND (replace(lower(r.code),'_','')='superadmin' OR (u.role_id IS NULL AND replace(lower(u.role),'_','')='superadmin'))`);
      if(admins.rows[0]?.count==='1') throw new AccountAccessError('Cannot remove the last active SuperAdmin',400);
    }
    return work(tx);
  });
}
export async function replaceAccountGroups(tx:Tx,userId:number,groupIds:number[]){
  await tx.delete(userOrganizationGroupAccess).where(eq(userOrganizationGroupAccess.userId,userId));
  if(groupIds.length) await tx.insert(userOrganizationGroupAccess).values(groupIds.map(groupId=>({userId,groupId})));
}
