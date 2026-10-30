import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {drizzle} from 'drizzle-orm/node-postgres';
import {eq} from 'drizzle-orm';
import {createHrAuditTestDatabase} from '../testing/hrAuditDatabase';
import {runMigrations} from '../db/migrate';
import {organizationGroups,departmentOrganizationMappings} from '../db/schema/organizations';
import {employees} from '../db/schema/employees';
import {departments} from '../db/schema/master';
import {users} from '../db/schema/users';
import {attendanceRecords} from '../db/schema/attendance';
import {attendanceSelfLogs} from '../db/schema/attendanceSelfLogs';
import {loadAttendanceWorkspace,executeAttendanceCommand} from './attendanceWorkspace';
import {requireScopedEmployee} from './hrOrganizationScope';
import {listPendingVerifications,verifyAttendanceRecord} from './mobileAttendanceService';
import {appendHrAudit} from './hrAudit';
import {getHrActivity,listHrActivityTargets} from './hrActivityQuery';
import {randomUUID} from 'node:crypto';

test('HR database boundaries preserve historical owners and deny direct foreign IDs',async t=>{
 const fixture=await createHrAuditTestDatabase();t.after(()=>fixture.cleanup());
 await runMigrations(fixture.ownerUrl,path.resolve(__dirname,'../../drizzle'),fixture.runtimeRole);
 const database=drizzle(fixture.owner);
 await database.insert(organizationGroups).values([{code:'CMC',name:'CMC'},{code:'MGM',name:'MGM'}]).onConflictDoNothing();
 const allGroups = await database.select().from(organizationGroups);
 const cmc = allGroups.find(g => g.code === 'CMC')!;
 const mgm = allGroups.find(g => g.code === 'MGM')!;
 const [deptA,deptB]=await database.insert(departments).values([{code:'C',name:'CMC Dept'},{code:'M',name:'MGM Dept'}]).returning();
 await database.insert(departmentOrganizationMappings).values([{departmentId:deptA.id,groupId:cmc.id,approvalReference:'fixture'},{departmentId:deptB.id,groupId:mgm.id,approvalReference:'fixture'}]);
 const [alice,bob,unknown]=await database.insert(employees).values([{employeeCode:'A',fullName:'Alice',departmentId:deptA.id},{employeeCode:'B',fullName:'Bob',departmentId:deptB.id},{employeeCode:'U',fullName:'Unknown'}]).returning();
 const [user]=await database.insert(users).values({username:'reviewer',email:'reviewer@test.local',passwordHash:'fixture',role:'employee'}).returning();
 const [oldRecord,foreignRecord,legacy]=await database.insert(attendanceRecords).values([{employeeId:alice.id,workDate:'2026-10-01',groupId:cmc.id},{employeeId:bob.id,workDate:'2026-10-01',groupId:mgm.id},{employeeId:unknown.id,workDate:'2026-10-01'}]).returning();
 const scope={module:'hr' as const,groupIds:[cmc.id],includeUnmapped:false,selectedGroupId:cmc.id};
 const context={actor:{id:String(user.id),username:user.username,name:'Reviewer'},operationId:randomUUID()};
 await t.test('directory and workspace filter mapped employees and history snapshots',async()=>{
  await assert.rejects(()=>requireScopedEmployee(scope,bob.id,database),/unavailable/);
  await assert.rejects(()=>requireScopedEmployee(scope,unknown.id,database),/unavailable/);
  const workspace=await loadAttendanceWorkspace(database as any,context,scope);
  assert.deepEqual(workspace.employees.map(e=>e.id),[alice.id]);
  assert.deepEqual(workspace.records.map(e=>e.id),[oldRecord.id]);
 });
 await t.test('employee move does not reclassify history',async()=>{
  await assert.rejects(fixture.owner.query('UPDATE attendance_records SET group_id=$1 WHERE id=$2',[mgm.id,oldRecord.id]),/immutable/i);
  await database.update(employees).set({departmentId:deptB.id}).where(eq(employees.id,alice.id));
  const workspace=await loadAttendanceWorkspace(database as any,context,scope);
  assert.equal(workspace.employees.length,0);assert.deepEqual(workspace.records.map(e=>e.id),[oldRecord.id]);
 });
 await t.test('foreign correction and unresolved record are denied before mutation',async()=>{
  for(const recordId of [foreignRecord.id,legacy.id]) await assert.rejects(()=>database.transaction(tx=>executeAttendanceCommand(tx as any,context,{type:'correct',recordId,expectedRevision:1,values:{scanIn:'08:00',scanOut:'17:00',lateMinutes:0,overtimeMinutes:0,attendanceStatus:'PRESENT'},reason:'unauthorized'},undefined,scope)),/unavailable/);
 });
 await t.test('mobile review filters historical group and rejects foreign approval',async()=>{
  const [log]=await database.insert(attendanceSelfLogs).values({employeeId:bob.id,userId:user.id,groupId:mgm.id,eventType:'IN',workDate:'2026-10-01',scanTime:'08:00',shiftCode:'OFFICE',shiftCategory:'OFFICE',txHash:randomUUID(),approvalStatus:'PENDING'} as any).returning();
  assert.equal((await listPendingVerifications(database as any,scope)).length,0);
  await assert.rejects(()=>verifyAttendanceRecord(user.id,{logId:log.id,status:'REJECTED',note:'foreign'},database as any,scope),/tidak ditemukan/);
 });
 await t.test('audit details and target pagination inherit event owner',async()=>{
  const eventId=await database.transaction(tx=>appendHrAudit(tx as any,{operationId:randomUUID(),actor:context.actor,action:'UPDATE',entityType:'attendance_record',entityId:String(foreignRecord.id),entityLabel:'MGM',outcome:'SUCCESS',summary:'Foreign event'}));
  assert.equal(await getHrActivity(eventId,database,scope),null);
  assert.deepEqual(await listHrActivityTargets(eventId,undefined,50,database,scope),{targets:[],nextCursor:null});
 });
});
