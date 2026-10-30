import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAdmsServer} from '../src/http.mjs';
async function fixture(t, overrides={}) {
 const calls=[];
 const store={ready:async()=>{}, touch:async(sn,ip)=>{calls.push({sn,ip});return {stamp:'10'};}, receive:async v=>{calls.push(v);return {count:1};}, ...overrides};
 const server=createAdmsServer({store,maxBodyBytes:256});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections?.();}));
 return {calls,url:`http://127.0.0.1:${server.address().port}`};
}
test('registration options and heartbeat use source socket, ignoring forwarded headers',async t=>{
 const {url,calls}=await fixture(t);
 const r=await fetch(url+'/iclock/cdata?SN=TEST&options=all',{headers:{'X-Forwarded-For':'192.168.0.80'}});
 assert.equal(r.status,200);assert.match(await r.text(),/Stamp=10/);assert.equal(calls[0].ip,'127.0.0.1');
 assert.equal(await (await fetch(url+'/iclock/getrequest?SN=TEST')).text(),'OK');
});
test('ACK waits for successful durable store; database failure returns no successful ACK',async t=>{
 let release;const committed=new Promise(r=>release=r);let entered;
 const seen=new Promise(r=>entered=r);
 const {url}=await fixture(t,{receive:async()=>{entered();await committed;return {count:1};}});
 let finished=false;
 const pending=fetch(url+'/iclock/cdata?SN=TEST&table=ATTLOG',{method:'POST',body:'1\t2026-10-30 08:00:00\t0\t15'}).then(r=>{finished=true;return r;});
 await seen;assert.equal(finished,false);release();assert.equal(await (await pending).text(),'OK: 1');
 const fail=await fixture(t,{receive:async()=>{throw new Error('secret DB password');}});
 const r=await fetch(fail.url+'/iclock/cdata?SN=TEST&table=ATTLOG',{method:'POST',body:'x'});
 assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/OK|secret/);
});
test('unknown serial, malformed serial, large body and unsupported endpoint are rejected',async t=>{
 const {url}=await fixture(t,{touch:async()=>{throw Object.assign(new Error('Not registered'),{status:403});}});
 assert.equal((await fetch(url+'/iclock/getrequest?SN=NO')).status,403);
 assert.equal((await fetch(url+'/iclock/getrequest?SN=a%0Ab')).status,400);
 assert.equal((await fetch(url+'/iclock/cdata?SN=TEST&table=ATTLOG',{method:'POST',body:'x'.repeat(300)})).status,413);
 assert.equal((await fetch(url+'/admin')).status,404);
});
test('readiness reflects database availability',async t=>{
 const {url}=await fixture(t,{ready:async()=>{throw new Error('offline');}});
 assert.equal((await fetch(url+'/health/live')).status,200);
 assert.equal((await fetch(url+'/health/ready')).status,503);
});
