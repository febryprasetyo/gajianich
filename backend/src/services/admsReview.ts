import type {RequestScope} from '../domain/organizationAccess';
interface SqlRunner {query(text:string,params?:any[]):Promise<{rows:Record<string,any>[]}>}
const fail=(message:string,statusCode=400)=>Object.assign(new Error(message),{statusCode});
export function parseReviewLogQuery(input:Record<string,unknown>) {
 const number=(key:string,fallback:number,max:number)=>{const v=input[key];if(v===undefined||v==='')return fallback;if(typeof v!=='string'||!/^\d+$/.test(v)||!Number.isSafeInteger(+v)||+v<1||+v>max)throw fail('Invalid review query');return +v;};
 const text=(key:string,max:number)=>{const v=input[key]??'';if(typeof v!=='string'||v.length>max)throw fail('Invalid review query');return v.trim();};
 const startDate=text('startDate',10),endDate=text('endDate',10),pin=text('pin',50);
 for(const v of [startDate,endDate])if(v&&!validDate(v))throw fail('Invalid review date');
 if(startDate&&endDate&&endDate<startDate)throw fail('Invalid review date range');
 return {deviceId:number('deviceId',0,Number.MAX_SAFE_INTEGER),startDate,endDate,pin,page:number('page',1,100000),limit:number('limit',20,100)};
}
function validDate(v:unknown):v is string {return typeof v==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;}
export function parseHistoryRequest(input:Record<string,unknown>) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw fail('Pilih rentang tanggal valid, maksimal 31 hari.');
 const {startDate,endDate}=input;
 if(!validDate(startDate)||!validDate(endDate)||endDate<startDate||(Date.parse(endDate)-Date.parse(startDate))>30*86400000)throw fail('Pilih rentang tanggal valid, maksimal 31 hari.');
 return {startDate,endDate};
}
export async function getReviewLogs(runner:SqlRunner,scope:RequestScope,q:ReturnType<typeof parseReviewLogQuery>) {
 if(scope.module!=='hr')throw fail('HR scope required',403);
 const result=await runner.query(`WITH matching AS (
  SELECT r.id::text AS id,a.device_id AS "deviceId",d.name AS "deviceName",r.serial,r.pin,r.raw_status AS "rawStatus",r.raw_verify AS "rawVerify",
   to_char(r.punched_at,'YYYY-MM-DD HH24:MI:SS') AS timestamp,
   CASE r.raw_verify WHEN 0 THEN 'Password' WHEN 1 THEN 'Fingerprint' WHEN 2 THEN 'Card' WHEN 15 THEN 'Face' WHEN 20 THEN 'Face' ELSE 'ZK:'||r.raw_verify END AS "verifyMode",
   CASE WHEN r.raw_status IN (0,4) THEN 'Masuk' WHEN r.raw_status IN (1,5) THEN 'Pulang' ELSE 'Scan Antara' END AS "inOutState",
   p.source,CASE WHEN EXISTS(SELECT 1 FROM public.department_organization_mappings m WHERE m.department_id=e.department_id AND m.group_id=r.group_id) THEN e.full_name ELSE NULL END AS "employeeName"
  FROM adms.review_logs r JOIN adms.devices a ON a.serial=r.serial AND a.group_id=r.group_id
   JOIN public.attendance_devices d ON d.id=a.device_id AND d.group_id=a.group_id
   JOIN adms.receipts p ON p.id=r.receipt_id AND p.serial=r.serial
   LEFT JOIN public.employees e ON e.id=r.employee_id
  WHERE ($1::boolean OR r.group_id=ANY($2::bigint[])) AND ($3::bigint=0 OR a.device_id=$3)
   AND ($4::text='' OR r.punched_at >= NULLIF($4::text,'')::date)
   AND ($5::text='' OR r.punched_at < NULLIF($5::text,'')::date+interval '1 day')
   AND ($6::text='' OR r.pin=$6)
 ) SELECT (SELECT count(*) FROM matching)::text AS total,
 coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM matching ORDER BY timestamp DESC,id::bigint DESC LIMIT $7 OFFSET $8) x),'[]'::jsonb) AS logs`,[scope.includeUnmapped&&!scope.groupIds.length,scope.groupIds,q.deviceId,q.startDate,q.endDate,q.pin,q.limit,(q.page-1)*q.limit]);
 return {logs:result.rows[0].logs.map((r:Record<string,unknown>)=>({...r,deviceId:Number(r.deviceId)})),pagination:{page:q.page,limit:q.limit,total:Number(result.rows[0].total)}};
}
export async function queueAttendanceRead(pool:{connect():Promise<any>},scope:RequestScope,deviceId:number,range:ReturnType<typeof parseHistoryRequest>,actorId:number) {
 if(scope.module!=='hr'||scope.selectedGroupId===null||!scope.groupIds.includes(scope.selectedGroupId))throw fail('Pilih kelompok organisasi mesin terlebih dahulu.',403);
 const c=await pool.connect();
 try {
  await c.query('BEGIN');
  const {rows}=await c.query(`SELECT a.serial,a.group_id FROM adms.devices a JOIN public.attendance_devices d ON d.id=a.device_id
   WHERE a.device_id=$1 AND a.group_id=$2 AND d.group_id=a.group_id AND d.serial_number=a.serial AND a.enabled AND d.is_enabled FOR UPDATE OF a`,[deviceId,scope.selectedGroupId]);
  if(rows.length!==1)throw fail('Mesin review ADMS tidak tersedia pada kelompok ini.',404);
  const d=rows[0];
  await c.query("UPDATE adms.read_commands SET status='EXPIRED',completed_at=now() WHERE serial=$1 AND status IN ('PENDING','SENT') AND expires_at<=now()",[d.serial]);
  const command=await c.query(`INSERT INTO adms.read_commands(serial,group_id,start_at,end_at,requested_by) VALUES($1,$2,$3::timestamp,$4::timestamp,$5)
   RETURNING id::text,status,created_at AS "createdAt",expires_at AS "expiresAt"`,[d.serial,d.group_id,range.startDate+' 00:00:00',range.endDate+' 23:59:59',actorId]);
  await c.query('COMMIT');return {...command.rows[0],message:'Permintaan baca diantrikan. Hasil hanya disimpan sebagai review ADMS; dukungan bergantung firmware.'};
 }catch(e:any){await c.query('ROLLBACK');if(e.code==='23505')throw fail('Masih ada permintaan baca yang menunggu atau sedang diproses.',409);throw e;}finally{c.release();}
}
export async function getReadCommands(runner:SqlRunner,scope:RequestScope) {
 if(scope.module!=='hr')throw fail('HR scope required',403);
 return (await runner.query(`SELECT c.id::text,d.name AS "deviceName",a.device_id AS "deviceId",c.serial,CASE WHEN c.status IN ('PENDING','SENT') AND c.expires_at<=now() THEN 'EXPIRED' ELSE c.status END AS status,
  to_char(c.start_at,'YYYY-MM-DD HH24:MI:SS') AS "startAt",to_char(c.end_at,'YYYY-MM-DD HH24:MI:SS') AS "endAt",
  c.created_at AS "createdAt",c.sent_at AS "sentAt",c.completed_at AS "completedAt",c.expires_at AS "expiresAt",c.return_code AS "returnCode"
  FROM adms.read_commands c JOIN adms.devices a ON a.serial=c.serial AND a.group_id=c.group_id
   JOIN public.attendance_devices d ON d.id=a.device_id AND d.group_id=a.group_id
  WHERE ($1::boolean OR c.group_id=ANY($2::bigint[])) ORDER BY c.id DESC LIMIT 50`,[scope.includeUnmapped&&!scope.groupIds.length,scope.groupIds])).rows.map(r=>({...r,deviceId:Number(r.deviceId)}));
}
