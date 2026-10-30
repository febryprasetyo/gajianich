import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderAttendanceRead} from '../src/readCommands.mjs';
test('only a dated attendance read can be serialized to the device wire',()=>{
 const c={id:'12',kind:'ATTLOG_QUERY',startText:'2026-10-01 00:00:00',endText:'2026-10-30 23:59:59'};
 assert.equal(renderAttendanceRead(c),'C:12:DATA QUERY ATTLOG StartTime=2026-10-01 00:00:00\tEndTime=2026-10-30 23:59:59\n');
 for(const bad of [{...c,kind:'REBOOT'},{...c,id:'12\nCLEAR'},{...c,startText:'2026-10-01\nDELETE ATTLOG'}])assert.throws(()=>renderAttendanceRead(bad),/Invalid/);
});
