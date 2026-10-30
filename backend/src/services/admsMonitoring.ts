import type {RequestScope} from '../domain/organizationAccess';

export interface AdmsMonitorQuery {search:string;outcome:string;source:string;page:number;limit:number}
interface SqlRunner {query(text:string,params?:unknown[]):Promise<{rows:Record<string,any>[]}>}
const invalid=()=>Object.assign(new Error('Invalid ADMS monitoring query'),{statusCode:400});
export function parseAdmsMonitorQuery(input:Record<string,unknown>):AdmsMonitorQuery {
 const text=(key:string,max:number)=>{const value=input[key]??'';if(typeof value!=='string'||value.length>max)throw invalid();return value.trim();};
 const integer=(key:string,fallback:number,max:number)=>{const v=input[key];if(v===undefined||v==='')return fallback;if(typeof v!=='string'||!/^\d+$/.test(v))throw invalid();const n=Number(v);if(!Number.isSafeInteger(n)||n<1||n>max)throw invalid();return n;};
 const search=text('search',150),outcome=text('outcome',20),source=text('source',20);
 if(!['','ACCEPTED','REJECTED','ARCHIVED'].includes(outcome)||!['','ADMS','MANUAL_IMPORT'].includes(source))throw invalid();
 return {search,outcome,source,page:integer('page',1,100000),limit:integer('limit',20,100)};
}
export async function probeAdmsServer(baseUrl=process.env.ADMS_INTERNAL_URL || 'http://adms:8081',fetcher:typeof fetch=fetch) {
 let ready=false;
 try {
  const url=new URL('/health/ready',baseUrl);
  if(!['http:','https:'].includes(url.protocol))throw new Error('Invalid listener URL');
  const response=await fetcher(url,{signal:AbortSignal.timeout(2500),redirect:'error'});
  ready=response.status===200;
  await response.body?.cancel();
 } catch {ready=false;}
 return {ready,checkedAt:new Date().toISOString(),message:ready?'Server ADMS siap menerima data.':'Server ADMS belum dapat dijangkau atau belum siap.'};
}
const onlineSql=`a.enabled AND d.is_enabled AND d.serial_number=a.serial AND a.last_seen_at >= now()-interval '180 seconds'`;
const permittedSql=`SELECT a.serial,a.device_id,a.group_id,a.last_seen_at,a.enabled,d.is_enabled,d.serial_number
 FROM adms.devices a JOIN public.attendance_devices d ON d.id=a.device_id AND d.group_id=a.group_id
 WHERE ($1::boolean OR a.group_id=ANY($2::bigint[]))`;

export async function getAdmsMonitoring(runner:SqlRunner,scope:RequestScope,query:AdmsMonitorQuery,probe=probeAdmsServer) {
 if(scope.module!=='hr')throw Object.assign(new Error('HR organization scope required'),{statusCode:403});
 const access=[scope.includeUnmapped && scope.groupIds.length===0,scope.groupIds];
 const search=query.search?`%${query.search}%`:'';
 const [server,summaryResult,devicesResult,receiptResult]=await Promise.all([
  probe(),
  runner.query(`WITH permitted AS (${permittedSql})
   SELECT (SELECT count(*) FROM permitted) AS devices,
    (SELECT count(*) FROM permitted a WHERE a.enabled AND a.is_enabled AND a.serial_number=a.serial AND a.last_seen_at >= now()-interval '180 seconds') AS online,
    (SELECT coalesce(sum(r.total_received),0) FROM adms.receipts r JOIN permitted a ON a.serial=r.serial WHERE r.table_name='ATTLOG') AS received,
    (SELECT count(*) FROM adms.review_logs r JOIN permitted a ON a.serial=r.serial AND a.group_id=r.group_id) AS inserted,
    (SELECT count(*) FROM adms.receipts r JOIN permitted a ON a.serial=r.serial WHERE r.table_name='ATTLOG' AND r.outcome='REJECTED') AS rejected,
    (SELECT count(*) FROM adms.review_logs r JOIN permitted a ON a.serial=r.serial AND a.group_id=r.group_id WHERE r.employee_id IS NULL) AS unmapped`,access),
  runner.query(`SELECT d.id,d.name,a.serial,a.group_id AS "groupId",coalesce(${onlineSql},false) AS online,(a.enabled AND d.is_enabled) AS enabled,
    a.last_seen_at AS "lastSeenAt",a.last_data_at AS "lastSyncAt",
    (SELECT count(*) FROM adms.review_logs r WHERE r.serial=a.serial AND r.group_id=a.group_id) AS "totalLogs",
    (SELECT count(*) FROM adms.review_logs r WHERE r.serial=a.serial AND r.group_id=a.group_id AND r.employee_id IS NULL) AS "unmappedLogs",
    (SELECT count(*) FROM adms.receipts r WHERE r.serial=a.serial AND r.outcome='REJECTED') AS "rejectedBatches"
   FROM adms.devices a JOIN public.attendance_devices d ON d.id=a.device_id AND d.group_id=a.group_id
   WHERE ($1::boolean OR a.group_id=ANY($2::bigint[])) AND ($3::text='' OR d.name ILIKE $3 OR a.serial ILIKE $3)
   ORDER BY d.name,d.id`,[...access,search]),
  runner.query(`WITH matching AS (
    SELECT r.id::text AS id,a.device_id AS "deviceId",d.name AS "deviceName",r.serial,r.source,r.table_name AS "tableName",
     r.storage_target AS "storageTarget",r.outcome,r.error_message AS "errorMessage",r.total_received AS "totalReceived",r.total_inserted AS "totalInserted",
     r.total_unmapped AS "totalUnmapped",r.received_at AS "receivedAt"
    FROM adms.receipts r JOIN adms.devices a ON a.serial=r.serial
    JOIN public.attendance_devices d ON d.id=a.device_id AND d.group_id=a.group_id
    WHERE ($1::boolean OR a.group_id=ANY($2::bigint[]))
     AND ($3::text='' OR d.name ILIKE $3 OR a.serial ILIKE $3)
     AND ($4::text='' OR r.outcome=$4) AND ($5::text='' OR r.source=$5)
   ) SELECT (SELECT count(*) FROM matching)::text AS total,
    coalesce((SELECT jsonb_agg(row_to_json(p)) FROM (
      SELECT * FROM matching ORDER BY "receivedAt" DESC,id::bigint DESC LIMIT $6 OFFSET $7
    ) p),'[]'::jsonb) AS items`,[...access,search,query.outcome,query.source,query.limit,(query.page-1)*query.limit]),
 ]);
 const summary=Object.fromEntries(Object.entries(summaryResult.rows[0]).map(([key,value])=>[key,Number(value)]));
 const devices=devicesResult.rows.map(d=>({...d,id:Number(d.id),groupId:Number(d.groupId),totalLogs:Number(d.totalLogs),unmappedLogs:Number(d.unmappedLogs),rejectedBatches:Number(d.rejectedBatches)}));
 const receipts=(receiptResult.rows[0].items as Record<string,unknown>[]).map(r=>({...r,deviceId:Number(r.deviceId)}));
 return {server,summary,devices,receipts,pagination:{page:query.page,limit:query.limit,total:Number(receiptResult.rows[0].total)}};
}
