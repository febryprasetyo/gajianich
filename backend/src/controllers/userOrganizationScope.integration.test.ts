import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createHrAuditTestDatabase} from '../testing/hrAuditDatabase';
import {runMigrations} from '../db/migrate';

test('user management confines all actions and membership/role assignment to current authority',async t=>{
 const fixture=await createHrAuditTestDatabase();
 await runMigrations(fixture.ownerUrl,undefined,fixture.runtimeRole);
 const original=process.env.DATABASE_URL;process.env.DATABASE_URL=fixture.ownerUrl;
 const {default:express}=await import('express');
 const {default:userRoutes}=await import('../routes/userRoutes');
 const {default:roleRoutes}=await import('../routes/roleRoutes');
 const {generateToken}=await import('../utils/jwt');
 const {closeDatabase}=await import('../db');
 const query=(text:string,params?:unknown[])=>fixture.owner.query(text,params);
 const group=(await query("INSERT INTO organization_groups(code,name) VALUES('CMC','CMC'),('MGM','MGM') ON CONFLICT (code) DO UPDATE SET is_active=true RETURNING id::int,code")).rows;
 const cmc=group.find(g=>g.code==='CMC').id,mgm=group.find(g=>g.code==='MGM').id;
 const r=(await query("INSERT INTO roles(code,name) VALUES('hr_attendance','HR Attendance & Time'),('employee','Employee'),('super_admin','SuperAdmin') RETURNING id::int,code")).rows;
 const hr=r.find(g=>g.code==='hr_attendance').id,emp=r.find(g=>g.code==='employee').id,sa=r.find(g=>g.code==='super_admin').id;
 for(const code of ['access.users.view','access.users.manage','access.roles.manage']){
  await query("INSERT INTO permissions(code,name,module) VALUES($1,$1,'access') ON CONFLICT(code) DO NOTHING",[code]);
  await query('INSERT INTO role_permissions(role_id,permission_id) SELECT $1,id FROM permissions WHERE code=$2',[hr,code]);
 }
 const departments=(await query("INSERT INTO departments(name,code) VALUES('CMC test','CT'),('MGM test','MT') RETURNING id::int,code")).rows;
 for(const d of departments)await query("INSERT INTO department_organization_mappings(department_id,group_id,approval_reference) VALUES($1,$2,'test')",[d.id,d.code==='CT'?cmc:mgm]);
 const employees=(await query("INSERT INTO employees(employee_number,full_name,department_id) VALUES('C','CMC employee',$1),('M','MGM employee',$2) RETURNING id::int,employee_number",[departments[0].id,departments[1].id])).rows;
 const cemp=employees.find(e=>e.employee_number==='C').id,memp=employees.find(e=>e.employee_number==='M').id;
 async function make(username:string,roleId:number,employeeId:number|null,groups:number[]){
  const {rows:[u]}=await query("INSERT INTO users(username,password_hash,role_id,role,employee_id) VALUES($1,'unused',$2,'Employee',$3) RETURNING id::int",[username,roleId,employeeId]);
  for(const id of groups) await query('INSERT INTO user_organization_group_access(user_id,group_id) VALUES($1,$2)',[u.id,id]);
  return u.id as number;
 }
 const actor=await make('hr-cmc',hr,null,[cmc]),own=await make('own',emp,cemp,[cmc]),other=await make('other',emp,memp,[mgm]),multi=await make('multi',emp,cemp,[cmc,mgm]),global=await make('global',sa,null,[]),orphan=await make('orphan',emp,null,[]);
 const app=express();app.use(express.json());app.use('/users',userRoutes);app.use('/roles',roleRoutes);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await closeDatabase();process.env.DATABASE_URL=original;await fixture.cleanup();});
 const token=generateToken({userId:actor,roleId:sa,roleName:'SuperAdmin'});
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const api=async(path:string,method='GET',body?:unknown)=>{
  const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'X-Organization-Group-Id':String(cmc),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,body:await response.json() as any};
 };
 const list=await api('/users');assert.equal(list.status,200);assert.deepEqual(list.body.users.map((u:any)=>u.id),[own]);
 for(const target of [other,multi,global,orphan]){
  assert.equal((await api(`/users/${target}/reset-password`,'POST',{})).status,404);
  assert.equal((await api(`/users/${target}/status`,'PATCH',{status:'inactive'})).status,404);
  assert.equal((await api(`/users/${target}`,'DELETE')).status,404);
 }
 const payload={username:'new-own',roleId:emp,employeeId:cemp,status:'active',groupIds:[cmc]};
 assert.equal((await api('/users','POST',{...payload,employeeId:memp})).status,403);
 assert.equal((await api('/users','POST',{...payload,roleId:sa})).status,403);
 assert.equal((await api('/users','POST',{...payload,groupIds:[mgm]})).status,403);
 const created=await api('/users','POST',payload);assert.equal(created.status,201,JSON.stringify(created.body));assert.deepEqual(created.body.user.groupIds,[cmc]);
 assert.equal((await api(`/users/${own}`,'PUT',{...payload,username:'own',groupIds:[mgm]})).status,403);
 assert.equal((await api('/roles','POST',{name:'Escalation',code:'escalation'})).status,403,'scope manager cannot mutate shared role definitions');
 assert.equal((await api(`/users/${own}/reset-password`,'POST',{})).status,200);
 assert.equal((await query('SELECT must_change_password FROM users WHERE id=$1',[own])).rows[0].must_change_password,true);
});
