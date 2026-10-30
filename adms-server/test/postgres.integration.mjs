import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {makePool,migrate,Store} from '../src/store.mjs';
import {createAdmsServer} from '../src/http.mjs';
const url=process.env.TEST_DATABASE_URL;
if(!url || new URL(url).pathname!=='/gajianich_adms_test') throw new Error('TEST_DATABASE_URL must point to disposable gajianich_adms_test');
test('PostgreSQL durable ingest, deduplication, scope and HTTP integration',async t=>{
 const pool=makePool(url);t.after(()=>pool.end());
 await pool.query(`DROP SCHEMA IF EXISTS adms CASCADE;
 DROP TABLE IF EXISTS attendance_device_raw_logs,attendance_device_sync_logs,attendance_identities,department_organization_mappings,employees,attendance_devices,attendance_sources,organization_groups CASCADE;
 CREATE TABLE organization_groups(id bigint PRIMARY KEY);
 CREATE TABLE attendance_sources(id bigint PRIMARY KEY);
 CREATE TABLE attendance_devices(id bigint PRIMARY KEY,group_id bigint,serial_number text,name text,is_enabled boolean DEFAULT true,connection_type text DEFAULT 'Ethernet',status text,last_connected_at timestamp,last_sync_at timestamp,last_error text,updated_at timestamp,total_logs integer DEFAULT 0);
 CREATE TABLE employees(id bigint PRIMARY KEY,employee_number text,barcode text,department_id bigint);
 CREATE TABLE department_organization_mappings(department_id bigint PRIMARY KEY,group_id bigint);
 CREATE TABLE attendance_identities(source_id bigint,external_no_id text,employee_id bigint);
 CREATE TABLE attendance_device_sync_logs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,group_id bigint,device_id bigint,sync_type text,status text,total_fetched integer,total_parsed integer,total_processed integer,completed_at timestamp);
 CREATE TABLE attendance_device_raw_logs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,group_id bigint,device_id bigint,sync_log_id bigint,pin text,employee_id bigint,timestamp timestamp,work_date text,verify_mode text,in_out_state text,raw_payload jsonb);
 INSERT INTO organization_groups VALUES(1),(2);
 INSERT INTO attendance_sources VALUES(9);
 INSERT INTO attendance_devices(id,group_id,name,serial_number) VALUES(1,1,'Gudang 2','GSY1254900014'),(2,2,'Other','OTHER');
 INSERT INTO employees VALUES(27,'122',null,10),(122,'50219',null,10),(88,'other','122',20);
 INSERT INTO department_organization_mappings VALUES(10,1),(20,2);
 INSERT INTO attendance_identities VALUES(9,'999',27);
 INSERT INTO attendance_device_raw_logs(group_id,device_id,pin,timestamp,work_date,verify_mode,in_out_state) VALUES(1,1,'122','2026-10-20 08:00:00','2026-10-20','Face','Masuk');`);
 await pool.query(await readFile(new URL('../migrations/001_adms.sql',import.meta.url),'utf8'));
 await pool.query("INSERT INTO adms.devices(serial,device_id,group_id,allowed_network) VALUES('OTHER',2,2,'127.0.0.1/32')");
 await pool.query("INSERT INTO adms.receipts(serial,source,table_name,payload,outcome,total_received,total_inserted) VALUES('OTHER','ADMS','ATTLOG',$1,'ACCEPTED',1,1)",[Buffer.from('122\t2026-10-20 08:00:00\t0\t15')]);
 await pool.query("CREATE ROLE adms_test_runtime LOGIN PASSWORD 'adms-review-test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS");
 await migrate(pool,'adms_test_runtime');await migrate(pool,'adms_test_runtime');
 const runtimeUrl=new URL(url);runtimeUrl.username='adms_test_runtime';runtimeUrl.password='adms-review-test-only';
 const runtime=makePool(runtimeUrl.toString());t.after(()=>runtime.end());
 const store=new Store(runtime);await store.ready();
 const publicSnapshot=async()=>JSON.stringify((await pool.query(`SELECT (SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM attendance_devices d) AS devices,(SELECT count(*) FROM attendance_device_raw_logs) AS raw_count,(SELECT count(*) FROM attendance_device_sync_logs) AS sync_count`)).rows);
 const baseline=await publicSnapshot();
 await store.register({serial:'GSY1254900014',deviceId:1,network:'127.0.0.1/32',sourceId:9});
 await store.register({serial:'OTHER',deviceId:2,network:'127.0.0.1/32'});
 assert.equal(await publicSnapshot(),baseline,'registration must not change public device rows');
 const send=(body,overrides={})=>store.receive({serial:'GSY1254900014',ip:'127.0.0.1',table:'ATTLOG',stamp:'100',payload:Buffer.from(body),...overrides});
 await t.test('upgrade labels existing receipts MAIN_LEGACY without changing their counters',async()=>{
  const legacy=(await pool.query("SELECT storage_target,total_received,total_inserted FROM adms.receipts WHERE serial='OTHER'")).rows[0];
  assert.deepEqual(legacy,{storage_target:'MAIN_LEGACY',total_received:1,total_inserted:1});
 });
 await t.test('runtime role cannot write to main attendance or public device metadata',async()=>{
  await assert.rejects(runtime.query("UPDATE attendance_devices SET status='CONNECTED' WHERE id=1"),/permission denied/);
  await assert.rejects(runtime.query("INSERT INTO attendance_device_raw_logs(pin) VALUES('forbidden')"),/permission denied/);
  await assert.rejects(runtime.query("INSERT INTO attendance_device_sync_logs(status) VALUES('forbidden')"),/permission denied/);
 });
 await t.test('atomic receipt, wall time, padded PIN and group-scoped employee mapping',async()=>{
  const r=await send('00122\t2026-10-30 08:00:00\t0\t15\n999\t2026-10-30 08:01:00\t0\t15\nunknown\t2026-10-30 08:02:00\t0\t15');
  assert.equal(r.inserted,3);assert.equal(r.unmapped,1);
  const rows=(await pool.query(`SELECT pin,employee_id,to_char(punched_at,'YYYY-MM-DD HH24:MI:SS') AS time FROM adms.review_logs WHERE punched_at::date='2026-10-30' ORDER BY punched_at`)).rows;
  assert.equal(rows[0].pin,'00122');assert.equal(rows[0].employee_id,'27');assert.equal(rows[0].time,'2026-10-30 08:00:00');
  assert.equal(rows[1].employee_id,'27');assert.equal(rows[2].employee_id,null);
 });
 await t.test('concurrent retries and overlapping manual import create one canonical scan',async()=>{
  const body='00122\t2026-10-29 08:00:00\t0\t15';
  const results=await Promise.all(Array.from({length:8},(_,i)=>send(body,i%2?{source:'MANUAL_IMPORT',stamp:null}:{})));
  assert.equal(results.reduce((n,r)=>n+r.inserted,0),1);
  assert.equal((await send('122\t2026-10-29 08:00:00\t0\t15',{source:'MANUAL_IMPORT'})).inserted,0);
  assert.equal((await send('122\t2026-10-29 08:00:00\t4\t15')).inserted,1);
  assert.equal((await pool.query('SELECT attlog_stamp FROM adms.devices WHERE device_id=1')).rows[0].attlog_stamp,'100');
 });
 await t.test('review storage stays independent from pre-existing main history',async()=>{
  assert.equal((await send('00122\t2026-10-20 08:00:00\t0\t15')).inserted,1);
  assert.equal((await pool.query("SELECT count(*) FROM attendance_device_raw_logs WHERE work_date='2026-10-20'")).rows[0].count,'1');
 });
 await t.test('TCP device remains Ethernet while ADMS review is active',async()=>{
  await store.touch('GSY1254900014','127.0.0.1');
  assert.equal(await publicSnapshot(),baseline);
  assert.equal((await pool.query('SELECT connection_type FROM attendance_devices WHERE id=1')).rows[0].connection_type,'Ethernet');
 });
 await t.test('malformed batch quarantined without moving stamp or partial insertion',async()=>{
  await assert.rejects(send('122\t2026-10-28 08:00:00\t0\t15\n122\t2026-02-30 08:00:00\t0\t15',{stamp:'200'}),/line 2/);
  assert.equal((await pool.query("SELECT count(*) FROM adms.review_logs WHERE punched_at::date='2026-10-28'")).rows[0].count,'0');
  assert.equal((await pool.query('SELECT outcome FROM adms.receipts ORDER BY id DESC LIMIT 1')).rows[0].outcome,'REJECTED');
  assert.equal((await pool.query('SELECT attlog_stamp FROM adms.devices WHERE device_id=1')).rows[0].attlog_stamp,'100');
 });
 await t.test('database error mid-write rolls back receipt and stamp',async()=>{
  await pool.query(`CREATE OR REPLACE FUNCTION public.test_adms_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.pin='FAIL' THEN RAISE EXCEPTION 'test write failure'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER zz_test_failure BEFORE INSERT ON adms.review_logs FOR EACH ROW EXECUTE FUNCTION test_adms_failure();`);
  const before=(await pool.query('SELECT count(*) FROM adms.receipts')).rows[0].count;
  const beforeReview=(await pool.query('SELECT count(*) FROM adms.review_logs')).rows[0].count;
  await assert.rejects(send('FAIL\t2026-10-30 09:00:00\t0\t15',{stamp:'999'}),/test write failure/);
  assert.equal((await pool.query('SELECT count(*) FROM adms.receipts')).rows[0].count,before);
  assert.equal((await pool.query('SELECT count(*) FROM adms.review_logs')).rows[0].count,beforeReview);
  assert.equal((await pool.query('SELECT attlog_stamp FROM adms.devices WHERE device_id=1')).rows[0].attlog_stamp,'100');
 });
 await t.test('source network, disabled and moved devices rejected; identity cannot be reassigned',async()=>{
  await assert.rejects(store.touch('GSY1254900014','192.0.2.1'),/not registered/);
  await assert.rejects(store.touch('UNKNOWN','127.0.0.1'),/not registered/);
  await assert.rejects(store.register({serial:'DIFFERENT',deviceId:1,network:'127.0.0.1/32'}),/serial differs/);
  await pool.query('UPDATE adms.devices SET enabled=false WHERE device_id=1');
  await assert.rejects(store.touch('GSY1254900014','127.0.0.1'),/disabled/);
  await pool.query('UPDATE adms.devices SET enabled=true WHERE device_id=1');
  await pool.query('UPDATE attendance_devices SET is_enabled=false WHERE id=1');
  await assert.rejects(send('122\t2026-10-30 08:00:00\t0\t15'),/disabled/);
  await pool.query('UPDATE attendance_devices SET is_enabled=true,group_id=2 WHERE id=1');
  await assert.rejects(send('122\t2026-10-30 08:00:00\t0\t15'),/moved/);
  await pool.query('UPDATE attendance_devices SET group_id=1 WHERE id=1');
 });
 await t.test('other table payload archived without changing attendance watermark',async()=>{
  await send('vendor metadata',{table:'OPERLOG',stamp:'500'});
  const r=(await pool.query('SELECT payload,outcome FROM adms.receipts ORDER BY id DESC LIMIT 1')).rows[0];
  assert.equal(r.outcome,'ARCHIVED');assert.equal(r.payload.toString(),'vendor metadata');
  assert.equal((await pool.query('SELECT attlog_stamp FROM adms.devices WHERE device_id=1')).rows[0].attlog_stamp,'100');
 });
 await t.test('HTTP -> PostgreSQL review ledger and heartbeat without public writes',async()=>{
  const server=createAdmsServer({store});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {
   const origin=`http://127.0.0.1:${server.address().port}`;
   assert.equal((await fetch(origin+'/health/ready')).status,200);
   assert.match(await (await fetch(origin+'/iclock/cdata?SN=GSY1254900014&options=all')).text(),/Stamp=100/);
   const r=await fetch(origin+'/iclock/cdata?SN=GSY1254900014&table=ATTLOG&Stamp=101',{method:'POST',body:'122\t2026-10-30 17:00:00\t1\t15'});
   assert.equal(await r.text(),'OK: 1');
   assert.equal((await pool.query("SELECT raw_status FROM adms.review_logs WHERE punched_at='2026-10-30 17:00:00'")).rows[0].raw_status,1);
   assert.equal((await store.status())[0].online,true);
  }finally{await new Promise(r=>{server.close(r);server.closeAllConnections?.();});}
 });
 await t.test('legacy receipt replay is idempotent and preserves original receipt metadata',async()=>{
  const legacy=(await pool.query(`INSERT INTO adms.receipts(serial,source,table_name,payload,outcome,total_received,total_inserted,storage_target)
   VALUES('GSY1254900014','ADMS','ATTLOG',$1,'ACCEPTED',1,1,'MAIN_LEGACY') RETURNING id`,[Buffer.from('122\t2026-10-21 08:00:00\t0\t15')])).rows[0];
  const ledger=JSON.stringify((await pool.query('SELECT * FROM adms.receipts ORDER BY id')).rows);
  const first=await store.backfillReview({serial:'GSY1254900014'});
  assert.equal(first.inserted,1);
  assert.equal((await store.backfillReview({serial:'GSY1254900014'})).inserted,0);
  assert.equal(JSON.stringify((await pool.query('SELECT * FROM adms.receipts ORDER BY id')).rows),ledger);
  assert.equal((await pool.query('SELECT receipt_id FROM adms.review_logs WHERE receipt_id=$1',[legacy.id])).rowCount,1);
 });

 await t.test('historical read command polling, acknowledgements and expiry stay scoped and read-only',async()=>{
  const enqueue=async(expires=false)=>(await pool.query(`INSERT INTO adms.read_commands(serial,group_id,start_at,end_at,expires_at)
   VALUES('GSY1254900014',1,'2026-10-01 00:00:00','2026-10-02 23:59:59',now()+$1::interval) RETURNING id`,[expires?'-1 minute':'15 minutes'])).rows[0].id;
  const state=async(id)=>(await pool.query('SELECT status,return_code FROM adms.read_commands WHERE id=$1',[id])).rows[0];
  const id=await enqueue();
  const server=createAdmsServer({store});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {
   const origin=`http://127.0.0.1:${server.address().port}`;
   const poll=()=>fetch(origin+'/iclock/getrequest?SN=GSY1254900014').then(r=>r.text());
   assert.equal(await poll(),`C:${id}:DATA QUERY ATTLOG StartTime=2026-10-01 00:00:00\tEndTime=2026-10-02 23:59:59\n`);
   assert.equal(await poll(),'OK');
   const wrong=await fetch(origin+'/iclock/devicecmd?SN=OTHER',{method:'POST',body:`ID=${id}&Return=0`});
   assert.equal(wrong.status,200);assert.equal((await state(id)).status,'SENT');
   const ack=await fetch(origin+'/iclock/devicecmd?SN=GSY1254900014',{method:'POST',body:`ID=${id}&Return=0`});
   assert.equal(ack.status,200);assert.deepEqual(await state(id),{status:'ACKNOWLEDGED',return_code:0});
   const unsupported=await enqueue();await poll();
   const getAck=await fetch(origin+`/iclock/devicecmd?SN=GSY1254900014&ID=${unsupported}&Return=-1`);
   assert.equal(getAck.status,200);assert.equal((await state(unsupported)).status,'UNSUPPORTED');
   const expired=await enqueue(true);
   assert.equal(await poll(),'OK');assert.equal((await state(expired)).status,'EXPIRED');
   assert.equal(await publicSnapshot(),baseline);
  }finally{await new Promise(r=>{server.close(r);server.closeAllConnections?.();});}
 });
 await t.test('all receiver and replay operations leave every public device and main log count unchanged',async()=>{
  assert.equal(await publicSnapshot(),baseline);
  assert.equal((await pool.query("SELECT count(*) FROM adms.receipts WHERE storage_target NOT IN ('REVIEW','MAIN_LEGACY')")).rows[0].count,'0');
 });

});
