import {RequestError} from './protocol.mjs';

export function renderAttendanceRead(command) {
 const start=command.startText,end=command.endText;
 if(command.kind!=='ATTLOG_QUERY'||!/^\d+$/.test(String(command.id))||![start,end].every(v=>/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v))) throw new Error('Invalid read command');
 return `C:${command.id}:DATA QUERY ATTLOG StartTime=${start}\tEndTime=${end}\n`;
}
export async function pollReadCommand(store,serial,ip) {
 const c=await store.pool.connect();
 try {
  await c.query('BEGIN');const d=await store.device(c,serial,ip,false,true);await store.seen(c,d);
  await c.query("UPDATE adms.read_commands SET status='EXPIRED',completed_at=now() WHERE serial=$1 AND status IN ('PENDING','SENT') AND expires_at<=now()",[serial]);
  const result=await c.query(`UPDATE adms.read_commands SET status='SENT',sent_at=now() WHERE id=(
   SELECT id FROM adms.read_commands WHERE serial=$1 AND group_id=$2 AND status='PENDING' AND expires_at>now() ORDER BY id LIMIT 1
  ) RETURNING id,kind,to_char(start_at,'YYYY-MM-DD HH24:MI:SS') AS "startText",to_char(end_at,'YYYY-MM-DD HH24:MI:SS') AS "endText"`,[serial,d.group_id]);
  const reply=result.rows.length?renderAttendanceRead(result.rows[0]):'OK';
  await c.query('COMMIT');return reply;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function recordReadCommandResult(store,serial,ip,payload,query={}) {
 const values=new URLSearchParams(payload.toString('utf8'));
 const id=values.get('ID') || query.ID || query.CmdID;
 const result=values.get('Return') || query.Return;
 if(id===undefined||id===null||result===undefined||result===null) return;
 if(!/^\d{1,18}$/.test(String(id))||! /^-?\d{1,5}$/.test(String(result)))throw new RequestError(400,'Invalid command result');
 const c=await store.pool.connect();
 try {
  await c.query('BEGIN');const d=await store.device(c,serial,ip,false,true);
  const code=Number(result),status=code===0?'ACKNOWLEDGED':code===-1?'UNSUPPORTED':'FAILED';
  await c.query("UPDATE adms.read_commands SET status=$4,return_code=$5,completed_at=now() WHERE id=$1 AND serial=$2 AND group_id=$3 AND status='SENT'",[id,serial,d.group_id,status,code]);
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
