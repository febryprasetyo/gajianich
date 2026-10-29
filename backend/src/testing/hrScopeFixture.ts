import {eq,inArray} from 'drizzle-orm';
import {organizationGroups,departmentOrganizationMappings,userOrganizationGroupAccess} from '../db/schema/organizations';
import {departments} from '../db/schema/master';
import {employees} from '../db/schema/employees';
import type {RequestScope} from '../domain/organizationAccess';

/** Explicit CMC ownership for synthetic HR fixtures; never used against application data. */
export async function createHrScopeFixture(database:any,existingDepartment?:{id:number;code:string;name:string}) {
 const [group]=await database.insert(organizationGroups).values({code:'CMC',name:'CMC fixture'}).onConflictDoUpdate({target:organizationGroups.code,set:{isActive:true}}).returning();
 const department=existingDepartment??(await database.insert(departments).values({code:'HR-SCOPE',name:'HR scope fixture'}).returning())[0];
 await database.insert(departmentOrganizationMappings).values({departmentId:department.id,groupId:group.id,approvalReference:'Synthetic test fixture'});
 const scope:RequestScope={module:'hr',groupIds:[group.id],includeUnmapped:false,selectedGroupId:group.id};
 return {group,department,scope,
  async mapDepartment(departmentId:number) {await database.insert(departmentOrganizationMappings).values({departmentId,groupId:group.id,approvalReference:'Synthetic test fixture'});},
  async assignEmployees(ids:number[]) {await database.update(employees).set({departmentId:department.id}).where(inArray(employees.id,ids));},
  async grantUsers(ids:number[]) {await database.insert(userOrganizationGroupAccess).values(ids.map(userId=>({userId,groupId:group.id})));},
 };
}

/** Keep synthetic inserts in an explicitly chosen fixture owner, including nested transactions. */
export function ownedFixtureDatabase<T extends object>(database:T,scope:RequestScope,departmentId:number):T {
 return new Proxy(database,{get(target,key){
  if(key==='insert') return(table:any)=>{
   const builder=(target as any).insert(table);
   return new Proxy(builder,{get(insert,method){
    if(method==='values') return(values:any)=>{
     const enrich=(row:any)=>({...row,...(table.groupId && row.groupId===undefined?{groupId:scope.selectedGroupId}:{}),...(table===employees && row.departmentId===undefined?{departmentId}:{})});
     return insert.values(Array.isArray(values)?values.map(enrich):enrich(values));
    };
    const value=Reflect.get(insert,method);return typeof value==='function'?value.bind(insert):value;
   }});
  };
  if(key==='transaction') return(work:any,config?:any)=>(target as any).transaction((tx:any)=>work(ownedFixtureDatabase(tx,scope,departmentId)),config);
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
 }});
}
