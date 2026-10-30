import {readFile,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {makePool,migrate,Store} from './store.mjs';
import {parseAttendance,validateSerial,DEFAULT_COLUMNS} from './protocol.mjs';
const [command,...args]=process.argv.slice(2);
const values={};
function argError(message){throw new Error(message);}
for(let i=0;i<args.length;i++) {
 const key=args[i];if(!key.startsWith('--')||key in values)argError(`Invalid argument ${key}`);
 values[key]=['--commit','--skip-header'].includes(key)?true:args[++i] || argError(`Value required: ${key}`);
}
let pool;
try {
 if(!['migrate','register','status','receipts','export-receipt','import','backfill-review'].includes(command)) throw new Error('Usage: cli.mjs backfill-review [--serial SN] | migrate | register --device-id ID --serial SN --source-cidr IP/32 [--source-id ID] | status | receipts --serial SN | export-receipt --id ID --output FILE | import --serial SN --file FILE [--columns pin,timestamp,status,verify,workcode] [--skip-header] [--commit]');
 const allowed={'backfill-review':['--serial'],migrate:[],register:['--device-id','--serial','--source-cidr','--source-id'],status:[],receipts:['--serial'], 'export-receipt':['--id','--output'],import:['--serial','--file','--columns','--skip-header','--commit']}[command];
 for(const key of Object.keys(values)) if(!allowed.includes(key))throw new Error(`Unknown argument ${key}`);
 if(values['--serial'])validateSerial(values['--serial']);
 let payload,records,columns;
 if(command==='import') {
  validateSerial(values['--serial']);
  if(!values['--file'])throw new Error('--file required');
  if((await stat(values['--file'])).size>33554432)throw new Error('Import file exceeds 32 MiB; split the file');
  payload=await readFile(values['--file']);
  columns=values['--columns']?values['--columns'].split(','):DEFAULT_COLUMNS;
  const text=payload.toString('utf8');
  records=parseAttendance(values['--skip-header']?text.split(/\r?\n/).slice(1).join('\n'):text,columns,500000);
  const dates=records.map(r=>r.workDate).sort();
  console.log(JSON.stringify({dryRun:!values['--commit'],serial:values['--serial'],records:records.length,startDate:dates[0]||null,endDate:dates.at(-1)||null,columns}));
  if(!values['--commit'])process.exit(0);
 }
 pool=makePool(process.env.DATABASE_URL);const store=new Store(pool);
 if(command==='migrate'){await migrate(pool);console.log('ADMS migration applied');}
 if(command==='register'){
  if(!values['--source-cidr'])throw new Error('--source-cidr required (actual socket source; do not use an untrusted broad network)');
  await store.register({deviceId:values['--device-id'],serial:values['--serial'],network:values['--source-cidr'],sourceId:values['--source-id']||null});console.log('ADMS device registered');
 }
 if(command==='backfill-review')console.log(JSON.stringify(await store.backfillReview({serial:values['--serial']||null})));
 if(command==='status')console.log(JSON.stringify(await store.status(),null,2));
 if(command==='receipts'){
  validateSerial(values['--serial']);
  console.log(JSON.stringify((await pool.query('SELECT id,source,table_name,stamp,outcome,error_message,total_received,total_inserted,total_unmapped,storage_target,received_at FROM adms.receipts WHERE serial=$1 ORDER BY id DESC LIMIT 50',[values['--serial']])).rows,null,2));
 }
 if(command==='export-receipt'){
  if(!/^\d+$/.test(values['--id']||'')||!values['--output'])throw new Error('--id and --output required');
  const {rows}=await pool.query('SELECT payload FROM adms.receipts WHERE id=$1',[values['--id']]);
  if(!rows.length)throw new Error('Receipt not found');
  await writeFile(values['--output'],rows[0].payload,{flag:'wx',mode:0o600});console.log('Receipt exported');
 }
 if(command==='import'){
  const fileHash=createHash('sha256').update(payload).digest('hex');
  const totals={inserted:0,duplicates:0,unmapped:0};
  for(let i=0;i<records.length;i+=5000){
   const result=await store.receive({serial:values['--serial'],source:'MANUAL_IMPORT',payload:Buffer.from(records.slice(i,i+5000).map(r=>r.rawLine).join('\n')),columns,
    metadata:{filename:basename(values['--file']),sha256:fileHash,batch:Math.floor(i/5000)+1,batches:Math.ceil(records.length/5000)}});
   for(const key of Object.keys(totals))totals[key]+=result[key];console.log(JSON.stringify(result));
  }
  console.log(JSON.stringify({complete:true,...totals}));
 }
}catch(error){console.error(error.message);process.exitCode=1;}finally{await pool?.end();}
