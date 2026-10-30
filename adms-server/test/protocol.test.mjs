import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAttendance, resolveEmployee, optionsResponse} from '../src/protocol.mjs';

test('preserves padded PIN, wall time, status and extended payload', () => {
 const [p] = parseAttendance('PIN=00122\t2026-10-30 08:01:02\t4\t15\t7\t0\t0\r\n');
 assert.equal(p.pin,'00122'); assert.equal(p.timestamp,'2026-10-30 08:01:02');
 assert.equal(p.rawStatus,4); assert.equal(p.rawVerify,15); assert.equal(p.inOutState,'Masuk');
 assert.equal(p.verifyMode,'Face'); assert.equal(p.workCode,'7');
});
test('rejects entire malformed batch, calendar rollover, invalid codes and binary text', () => {
 for(const line of ['1\t2026-02-30 08:00:00\t0\t15', '1\t2026-10-30 24:00:00\t0\t15', '1\t2026-10-30 08:00:00\twrong\t15', '1\t2026-10-30 08:00:00\t0', '1\u0000\t2026-10-30 08:00:00\t0\t15']) {
  assert.throws(()=>parseAttendance('1\t2026-10-30 08:00:00\t0\t15\n'+line),/line 2/);
 }
});
test('manual column mapping supports explicit USB field order and refuses missing columns',()=>{
 const [p]=parseAttendance('00122\t2026-10-29 07:00:00\t1\t15\t0\t9', ['pin','timestamp','device','verify','status','workcode']);
 assert.equal(p.rawStatus,0); assert.equal(p.rawVerify,15); assert.equal(p.workCode,'9');
 assert.throws(()=>parseAttendance('1\t2026-10-30 08:00:00', ['pin','timestamp']),/columns/);
});
test('employee mapping never falls back to primary key or resolves ambiguous PIN',()=>{
 const employees=[{id:27,employeeCode:'122',barcode:null},{id:122,employeeCode:'50219',barcode:null}];
 assert.equal(resolveEmployee('00122',employees),27);
 assert.equal(resolveEmployee('27',employees),null);
 assert.equal(resolveEmployee('122',[...employees,{id:99,employeeCode:'other',barcode:'122'}]),null);
 assert.equal(resolveEmployee('122',employees,[{externalNoId:'122',employeeId:122}]),122);
 assert.equal(resolveEmployee('122',employees,[{externalNoId:'122',employeeId:999}]),null);
});
test('options advertise attendance only and resume committed stamp without time-setting commands',()=>{
 const s=optionsResponse('GSY1254900014','123');
 assert.match(s,/GET OPTION FROM: GSY1254900014/); assert.match(s,/Stamp=123/);
 assert.match(s,/TransFlag=TransData AttLog/); assert.doesNotMatch(s,/REBOOT|CLEAR|SyncTime=/);
});
