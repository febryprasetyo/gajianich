import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attendanceConnectionStatus} from './attendanceDeviceTransport';
test('ADMS uses timezone-aware heartbeat rather than a local TCP session',()=>{
 const now=Date.parse('2026-10-30T03:00:00Z');
 const dev={connectionType:'ADMS',isEnabled:true,lastAdmsSeenAt:new Date('2026-10-30T09:59:30+07:00'),status:'DISCONNECTED'};
 assert.equal(attendanceConnectionStatus(dev,'DISCONNECTED',now),'connected');
 assert.equal(attendanceConnectionStatus({...dev,lastAdmsSeenAt:new Date(now-181000)},'CONNECTED',now),'disconnected');
 assert.equal(attendanceConnectionStatus({...dev,isEnabled:false},'CONNECTED',now),'disconnected');
 assert.equal(attendanceConnectionStatus({...dev,lastAdmsSeenAt:null},'CONNECTED',now),'disconnected');
});
test('legacy TCP machines retain session/error behavior',()=>{
 const dev={connectionType:'Ethernet',isEnabled:true,status:'ERROR'};
 assert.equal(attendanceConnectionStatus(dev,'CONNECTED'),'connected');
 assert.equal(attendanceConnectionStatus(dev,'DISCONNECTED'),'error');
 assert.equal(attendanceConnectionStatus({...dev,status:'DISCONNECTED'},'DISCONNECTED'),'disconnected');
});
test('ADMS identity source is explicit and never inferred from the device primary key', async()=>{
 const {attendanceIdentitySourceId}=await import('./attendanceDeviceTransport');
 assert.equal(attendanceIdentitySourceId(4,'ADMS',null),0);
 assert.equal(attendanceIdentitySourceId(4,'MANUAL_IMPORT','9'),9);
 assert.equal(attendanceIdentitySourceId(4,null,null),4);
});
