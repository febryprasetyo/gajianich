import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {getAdmsMonitoring,parseAdmsMonitorQuery} from './admsMonitoring';
import type {RequestScope} from '../domain/organizationAccess';
const url=process.env.ADMS_MONITOR_TEST_DATABASE_URL;
test('monitoring queries isolate all metrics, devices and paginated receipts by group', {skip:!url},async t=>{
 if(new URL(url!).pathname!=='/gajianich_adms_monitor_test')throw new Error('Use disposable gajianich_adms_monitor_test only');
 const pool=new Pool({connectionString:url});t.after(()=>pool.end());
 await pool.query(`DROP SCHEMA IF EXISTS adms CASCADE;DROP TABLE IF EXISTS public.attendance_device_raw_logs,public.attendance_devices CASCADE;
 CREATE SCHEMA adms;
 CREATE TABLE public.attendance_devices(id bigint PRIMARY KEY,name text,group_id bigint,is_enabled boolean,connection_type text,serial_number text,last_sync_at timestamp);
 CREATE TABLE public.attendance_device_raw_logs(id bigint PRIMARY KEY,device_id bigint,group_id bigint,employee_id bigint);
 CREATE TABLE adms.devices(serial text PRIMARY KEY,device_id bigint,group_id bigint,last_seen_at timestamptz,last_data_at timestamptz,enabled boolean DEFAULT true);
 CREATE TABLE adms.receipts(id bigint PRIMARY KEY,serial text,source text,table_name text,outcome text,error_message text,total_received integer,total_inserted integer,total_unmapped integer,received_at timestamptz,payload text,storage_target text DEFAULT 'REVIEW');
 CREATE TABLE adms.review_logs(id bigint PRIMARY KEY,serial text,group_id bigint,receipt_id bigint,pin text,punched_at timestamp,raw_status int,raw_verify int,employee_id bigint);
 CREATE TABLE public.employees(id bigint PRIMARY KEY,full_name text,department_id bigint);
 CREATE TABLE public.department_organization_mappings(department_id bigint,group_id bigint);
 INSERT INTO attendance_devices VALUES(1,'Gudang 2',1,true,'Ethernet','SERIAL_CMC',now()),(2,'MGM hidden',2,true,'ADMS','SERIAL_MGM',now()),(3,'CMC disabled',1,false,'ADMS','SERIAL_DISABLED',now());
 INSERT INTO adms.devices(serial,device_id,group_id,last_seen_at) VALUES('SERIAL_CMC',1,1,now()),('SERIAL_MGM',2,2,now()),('SERIAL_DISABLED',3,1,now());
 INSERT INTO attendance_device_raw_logs VALUES(1,1,1,NULL),(2,1,1,27),(3,2,2,NULL),(4,2,2,NULL),(5,1,2,NULL);
 INSERT INTO adms.receipts(id,serial,source,table_name,outcome,error_message,total_received,total_inserted,total_unmapped,received_at,payload) VALUES
 (1,'SERIAL_CMC','ADMS','ATTLOG','ACCEPTED',NULL,10,8,1,now()-interval '10 seconds','private raw payload'),
 (2,'SERIAL_CMC','ADMS','ATTLOG','REJECTED','Invalid attendance at line 2',0,0,0,now()-interval '5 seconds','private rejected payload'),
 (3,'SERIAL_CMC','MANUAL_IMPORT','ATTLOG','ACCEPTED',NULL,20,12,0,now(),'private historical payload'),
 (4,'SERIAL_MGM','ADMS','ATTLOG','ACCEPTED',NULL,999,999,50,now(),'must not leak'),
 (5,'SERIAL_CMC','ADMS','OPERLOG','ARCHIVED',NULL,0,0,0,now(),'biometric data');
 INSERT INTO adms.review_logs VALUES(1,'SERIAL_CMC',1,1,'00122','2026-10-30 08:00:00',0,15,NULL),(2,'SERIAL_CMC',1,3,'123','2026-10-30 17:00:00',1,15,27),(3,'SERIAL_MGM',2,4,'private','2026-10-30 08:00:00',0,15,NULL),(4,'SERIAL_MGM',2,4,'other','2026-10-30 08:01:00',0,15,NULL),(5,'SERIAL_CMC',2,1,'badgroup','2026-10-30 09:00:00',0,15,NULL);
 INSERT INTO employees VALUES(27,'CMC Employee',10);INSERT INTO department_organization_mappings VALUES(10,1);`);
 const scope:RequestScope={module:'hr',groupIds:[1],selectedGroupId:1,includeUnmapped:false};
 const health=async()=>({ready:true,checkedAt:new Date().toISOString(),message:'Ready'});
 const data=await getAdmsMonitoring(pool,scope,parseAdmsMonitorQuery({limit:'2'}),health);
 assert.deepEqual(data.summary,{devices:2,online:1,received:30,inserted:2,rejected:1,unmapped:1});
 assert.deepEqual(data.devices.map(d=>d.id).sort(),[1,3]);assert.equal(data.devices.find(d=>d.id===3)?.online,false);
 assert.equal(data.pagination.total,4);assert.equal(data.receipts.length,2);
 assert.doesNotMatch(JSON.stringify(data),/private|must not leak|SERIAL_MGM|biometric data/);
 const {getReviewLogs,parseReviewLogQuery}=await import('./admsReview');
 const logs=await getReviewLogs(pool,scope,parseReviewLogQuery({}));
 assert.equal(logs.pagination.total,2);assert.equal(logs.logs[1].pin,'00122');
 assert.equal(logs.logs[0].employeeName,'CMC Employee');
 assert.doesNotMatch(JSON.stringify(logs),/private|badgroup/);
 const pin=await getReviewLogs(pool,scope,parseReviewLogQuery({pin:'00122',startDate:'2026-10-30',endDate:'2026-10-30'}));
 assert.equal(pin.pagination.total,1);assert.equal(pin.logs[0].timestamp,'2026-10-30 08:00:00');
 const filtered=await getAdmsMonitoring(pool,scope,parseAdmsMonitorQuery({search:'Gudang',outcome:'ACCEPTED',source:'MANUAL_IMPORT'}),health);
 assert.equal(filtered.pagination.total,1);assert.equal(filtered.receipts[0].id,'3');assert.equal(filtered.devices.length,1);
 const beyond=await getAdmsMonitoring(pool,scope,parseAdmsMonitorQuery({page:'100'}),health);
 assert.equal(beyond.receipts.length,0);assert.equal(beyond.pagination.total,4);
 const none=await getAdmsMonitoring(pool,{...scope,groupIds:[],selectedGroupId:null},parseAdmsMonitorQuery({}),health);
 assert.equal(none.summary.devices,0);assert.equal(none.pagination.total,0);
 const global=await getAdmsMonitoring(pool,{...scope,groupIds:[],selectedGroupId:null,includeUnmapped:true},parseAdmsMonitorQuery({}),health);
 assert.equal(global.summary.devices,3);assert.equal(global.pagination.total,5);
 const failed=await getAdmsMonitoring(pool,scope,parseAdmsMonitorQuery({}),async()=>({...await health(),ready:false,message:'Not ready'}));
 assert.equal(failed.server.ready,false);assert.equal(failed.summary.inserted,2);
 await assert.rejects(getAdmsMonitoring(pool,{...scope,module:'ga'},parseAdmsMonitorQuery({}),health),/HR organization/);
});
