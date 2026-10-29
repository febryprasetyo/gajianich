import type { GroupAccess } from './organizationAccess';
export interface AccountOwnership {groupIds:number[]; employeeGroupId:number|null; isGlobalAdministrator:boolean}
export function canManageAccount(caller:GroupAccess,target:AccountOwnership):boolean {
  if(caller.isGlobalAdministrator) return true;
  return !target.isGlobalAdministrator && target.groupIds.length>0
    && target.groupIds.every(id=>caller.groupIds.includes(id))
    && (target.employeeGroupId===null || caller.groupIds.includes(target.employeeGroupId));
}
export function canAssignAccountRole(input:{global:boolean;isHr:boolean;callerPermissions:string[];roleCode:string;rolePermissions:string[]}):boolean {
  if(input.global) return true;
  if(input.roleCode.replace(/_/g,'').toLowerCase()==='superadmin') return false;
  if(input.isHr) return input.roleCode==='employee';
  return input.rolePermissions.every(code=>input.callerPermissions.includes(code))
    && !input.rolePermissions.includes('access.roles.manage');
}
