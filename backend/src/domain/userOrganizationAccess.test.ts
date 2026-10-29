import assert from 'node:assert/strict';
import test from 'node:test';
import { canManageAccount, canAssignAccountRole } from './userOrganizationAccess';
const caller = {groupIds:[1],isGlobalAdministrator:false};
test('account administration requires complete ownership and never takes over global or multi-group targets',()=>{
  assert.equal(canManageAccount(caller,{groupIds:[1],employeeGroupId:1,isGlobalAdministrator:false}),true);
  for(const target of [
    {groupIds:[2],employeeGroupId:2,isGlobalAdministrator:false},
    {groupIds:[1,2],employeeGroupId:1,isGlobalAdministrator:false},
    {groupIds:[],employeeGroupId:null,isGlobalAdministrator:false},
    {groupIds:[1],employeeGroupId:2,isGlobalAdministrator:false},
    {groupIds:[1],employeeGroupId:1,isGlobalAdministrator:true},
  ]) assert.equal(canManageAccount(caller,target),false);
  assert.equal(canManageAccount({...caller,isGlobalAdministrator:true},{groupIds:[],employeeGroupId:null,isGlobalAdministrator:true}),true);
});
test('group administrators cannot elevate roles or gain global role-definition permissions',()=>{
  assert.equal(canAssignAccountRole({global:false,isHr:true,callerPermissions:['access.users.manage'],roleCode:'employee',rolePermissions:['tickets.create']}),true);
  assert.equal(canAssignAccountRole({global:false,isHr:true,callerPermissions:['access.users.manage'],roleCode:'super_admin',rolePermissions:[]}),false);
  assert.equal(canAssignAccountRole({global:false,isHr:false,callerPermissions:['access.users.manage'],roleCode:'custom',rolePermissions:['access.roles.manage']}),false);
  assert.equal(canAssignAccountRole({global:false,isHr:false,callerPermissions:['access.users.manage'],roleCode:'custom',rolePermissions:['access.users.manage']}),true);
});
