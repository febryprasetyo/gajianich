import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {RequestError,parseAttendance,resolveEmployee,validateSerial} from './protocol.mjs';
import {pollReadCommand,recordReadCommandResult} from './readCommands.mjs';
export function makePool(databaseUrl) {
 if(!databaseUrl) throw new Error('DATABASE_URL required');
 return new pg.Pool({connectionString:databaseUrl,max:5,connectionTimeoutMillis:5000,statement_timeout:30000,idle_in_transaction_session_timeout:35000});
}
export async function migrate(pool, runtimeRole=process.env.ADMS_RUNTIME_ROLE) {
 const migrations=await Promise.all(['001_adms.sql','002_review.sql','003_read_commands.sql'].map(file=>readFile(new URL('../migrations/'+file,import.meta.url),'utf8')));
 const c=await pool.connect();
 try {await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('gajianich-adms-migrate'))");if(runtimeRole)await c.query("SELECT set_config('gajianich.adms_runtime_role',$1,true)",[runtimeRole]);for(const sql of migrations)await c.query(sql);await c.query('COMMIT');}
 catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export class Store {
 constructor(pool){this.pool=pool;}
 async ready(){await this.pool.query('SELECT version FROM adms.schema_version WHERE version=3').then(r=>{if(!r.rowCount)throw new Error('Migration required');});}
 async pollReadCommand(...args){return pollReadCommand(this,...args);}
 async recordReadCommandResult(...args){return recordReadCommandResult(this,...args);}
 async device(c,serial,ip,manual=false,lock=false) {
  const r=await c.query(`SELECT a.*, d.name FROM adms.devices a JOIN public.attendance_devices d ON d.id=a.device_id
   WHERE a.serial=$1 AND a.enabled=true AND d.is_enabled=true AND d.group_id=a.group_id AND d.serial_number=a.serial
   AND ($3::boolean OR $2::inet <<= a.allowed_network) ${lock?'FOR UPDATE OF a':''}`,[serial,ip,manual]);
  if(r.rowCount!==1) throw new RequestError(403,'Device not registered, disabled, moved or source not allowed');
  return r.rows[0];
 }
 async touch(serial,ip) {
  const c=await this.pool.connect();
  try {
   await c.query('BEGIN');const d=await this.device(c,serial,ip,false,true);
   await this.seen(c,d);await c.query('COMMIT');return {stamp:d.attlog_stamp};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async seen(c,d) {await c.query('UPDATE adms.devices SET last_seen_at=now() WHERE serial=$1',[d.serial]);}
 async register({serial,deviceId,network,sourceId=null}) {
  validateSerial(serial);
  if(!/^\d+$/.test(String(deviceId)) || (sourceId!==null && !/^\d+$/.test(String(sourceId)))) throw new Error('Positive device/source ID required');
  const c=await this.pool.connect();
  try {
   await c.query('BEGIN');
   const r=await c.query('SELECT * FROM public.attendance_devices WHERE id=$1',[deviceId]);const d=r.rows[0];
   if(!d || !d.group_id || !d.is_enabled) throw new Error('Register an enabled Gajianich device with a group first');
   if(d.serial_number!==serial) throw new Error('Device serial differs; correct Gajianich device identity before registration');
   await c.query(`INSERT INTO adms.devices(serial,device_id,group_id,source_id,allowed_network) VALUES($1,$2,$3,$4,$5::cidr)
    ON CONFLICT(serial) DO UPDATE SET allowed_network=excluded.allowed_network,source_id=excluded.source_id
    WHERE adms.devices.device_id=excluded.device_id AND adms.devices.group_id=excluded.group_id RETURNING serial`,[serial,deviceId,d.group_id,sourceId,network]).then(r=>{if(r.rowCount!==1)throw new Error('Serial already assigned to another device/group');});
   await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async insertReview(c,d,receiptId,records) {
  const emps=(await c.query(`SELECT e.id,e.employee_number AS "employeeCode",e.barcode FROM public.employees e
   WHERE EXISTS(SELECT 1 FROM public.department_organization_mappings m WHERE m.department_id=e.department_id AND m.group_id=$1)`,[d.group_id])).rows;
  const identities=d.source_id?(await c.query('SELECT external_no_id AS "externalNoId",employee_id AS "employeeId" FROM public.attendance_identities WHERE source_id=$1',[d.source_id])).rows:[];
  let unmapped=0;
  const rows=records.map(p=>{
   const employeeId=resolveEmployee(p.pin,emps,identities);if(!employeeId)unmapped++;
   const normalizedPin=/^\d+$/.test(p.pin)?p.pin.replace(/^0+(?=\d)/,''):p.pin;
   const fingerprint=createHash('sha256').update(JSON.stringify([d.serial,normalizedPin,p.timestamp,p.rawStatus,p.rawVerify])).digest('hex');
   return {...p,employeeId,fingerprint};
  });
  let inserted=0;
  if(rows.length) {
   const result=await c.query(`INSERT INTO adms.review_logs(serial,group_id,receipt_id,pin,punched_at,raw_status,raw_verify,work_code,employee_id,fingerprint)
    SELECT $1,$2,$3,x.pin,x.timestamp::timestamp,x."rawStatus",x."rawVerify",x."workCode",x."employeeId",x.fingerprint
    FROM jsonb_to_recordset($4::jsonb) AS x(pin text,timestamp text,"rawStatus" integer,"rawVerify" integer,"workCode" text,"employeeId" bigint,fingerprint text)
    ON CONFLICT(fingerprint) DO NOTHING RETURNING id`,[d.serial,d.group_id,receiptId,JSON.stringify(rows)]);
   inserted=result.rowCount;
  }
  return {inserted,unmapped};
 }
 async receive({serial,ip='127.0.0.1',table='ATTLOG',stamp=null,payload,source='ADMS',metadata={},columns}) {
  const manual=source==='MANUAL_IMPORT';
  let records=[],parseError;
  if(table==='ATTLOG') {try{records=parseAttendance(payload.toString('utf8'),columns);}catch(e){parseError=e;}}
  const c=await this.pool.connect();
  let committed=false;
  try {
   await c.query('BEGIN');const d=await this.device(c,serial,ip,manual,true);
   const receipt=await c.query(`INSERT INTO adms.receipts(serial,source,table_name,stamp,payload,metadata,outcome,error_message,total_received,storage_target)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'REVIEW') RETURNING id`,[serial,source,table,stamp,payload,JSON.stringify({...metadata,...(columns?{columns}:{})}),parseError?'REJECTED':table==='ATTLOG'?'ACCEPTED':'ARCHIVED',parseError?.message || null,records.length]);
   const receiptId=receipt.rows[0].id;
   let inserted=0,unmapped=0;
   if(!parseError && table==='ATTLOG') {
    ({inserted,unmapped}=await this.insertReview(c,d,receiptId,records));
    await c.query('UPDATE adms.receipts SET total_inserted=$2,total_unmapped=$3 WHERE id=$1',[receiptId,inserted,unmapped]);
    if(!manual) {
     if(stamp!==null)await c.query('UPDATE adms.devices SET attlog_stamp=$2 WHERE serial=$1',[serial,stamp]);
     await c.query('UPDATE adms.devices SET last_data_at=now() WHERE serial=$1',[serial]);
    }
   }
   if(!manual) await this.seen(c,d);
   await c.query('COMMIT');committed=true;
   if(parseError) throw parseError;
   return {receiptId,count:records.length,inserted,duplicates:records.length-inserted,unmapped};
  } catch(e) {if(!committed)await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async backfillReview({serial=null}={}) {
  if(serial)validateSerial(serial);
  let after='0';const totals={receipts:0,inserted:0,duplicates:0,unmapped:0};
  for(;;) {
   const page=(await this.pool.query(`SELECT id FROM adms.receipts WHERE id>$1 AND storage_target='MAIN_LEGACY'
    AND outcome='ACCEPTED' AND table_name='ATTLOG' AND ($2::text IS NULL OR serial=$2) ORDER BY id LIMIT 100`,[after,serial])).rows;
   if(!page.length)break;
   for(const row of page) {
    const c=await this.pool.connect();
    try {
     await c.query('BEGIN');
     const r=(await c.query('SELECT * FROM adms.receipts WHERE id=$1 FOR UPDATE',[row.id])).rows[0];
     const d=(await c.query(`SELECT a.* FROM adms.devices a JOIN public.attendance_devices d ON d.id=a.device_id
      WHERE a.serial=$1 AND a.group_id=d.group_id AND a.serial=d.serial_number FOR SHARE OF a`,[r.serial])).rows[0];
     if(!d)throw new Error('Legacy receipt device identity/group no longer matches');
     const records=parseAttendance(r.payload.toString('utf8'),r.metadata?.columns);
     const result=await this.insertReview(c,d,r.id,records);
     await c.query('COMMIT');
     totals.receipts++;totals.inserted+=result.inserted;totals.duplicates+=records.length-result.inserted;totals.unmapped+=result.unmapped;
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
    after=row.id;
   }
  }
  return totals;
 }
 async status() {
  return (await this.pool.query(`SELECT a.serial,a.device_id,a.group_id,d.name,a.enabled,a.allowed_network,a.attlog_stamp,a.last_seen_at,a.last_data_at,
   coalesce(a.last_seen_at>now()-interval '180 seconds',false) AS online,
   (SELECT count(*) FROM adms.receipts r WHERE r.serial=a.serial AND r.outcome='REJECTED') AS rejected_batches,
   (SELECT count(*) FROM adms.review_logs r WHERE r.serial=a.serial) AS review_logs,
   (SELECT count(*) FROM adms.review_logs r WHERE r.serial=a.serial AND r.employee_id IS NULL) AS unmapped_logs
   FROM adms.devices a JOIN public.attendance_devices d ON d.id=a.device_id ORDER BY a.device_id`)).rows;
 }
}
