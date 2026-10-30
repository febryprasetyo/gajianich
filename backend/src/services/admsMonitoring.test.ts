import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAdmsMonitorQuery,probeAdmsServer} from './admsMonitoring';
test('monitor query validates bounded pagination and known filters',()=>{
 assert.deepEqual(parseAdmsMonitorQuery({}),{search:'',outcome:'',source:'',page:1,limit:20});
 assert.deepEqual(parseAdmsMonitorQuery({search:' Gudang ',page:'2',limit:'50',outcome:'REJECTED',source:'ADMS'}),{search:'Gudang',outcome:'REJECTED',source:'ADMS',page:2,limit:50});
 for(const q of [{page:'0'},{page:'1.5'},{limit:'101'},{limit:'oops'},{source:'any'},{outcome:'DROP'},{search:['a','b']},{search:'x'.repeat(151)}]) assert.throws(()=>parseAdmsMonitorQuery(q),/Invalid/);
});
test('listener readiness does not expose internal errors or call it ready on non-200',async()=>{
 const ready=await probeAdmsServer('http://adms:8081',async()=>new Response('OK',{status:200}));assert.equal(ready.ready,true);
 const failed=await probeAdmsServer('http://adms:8081',async()=>{throw new Error('internal db secret');});assert.equal(failed.ready,false);assert.doesNotMatch(failed.message,/secret/);
 const unavailable=await probeAdmsServer('http://adms:8081',async()=>new Response('Temporarily unavailable',{status:503}));assert.equal(unavailable.ready,false);
});
