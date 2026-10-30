export class RequestError extends Error {
 constructor(status, message) { super(message); this.status = status; }
}
export const DEFAULT_COLUMNS = ['pin','timestamp','status','verify','workcode'];
export function validateSerial(value) {
 if (!/^[A-Za-z0-9_-]{1,100}$/.test(value || '')) throw new RequestError(400,'Invalid SN');
 return value;
}
export function parseAttendance(text, columns = DEFAULT_COLUMNS, maxRecords=10000) {
 if (!['pin','timestamp','status','verify'].every(c=>columns.includes(c)) || new Set(columns).size !== columns.length) throw new RequestError(400,'Invalid columns: pin,timestamp,status,verify required');
 if (text.includes('\ufffd')) throw new RequestError(422,'Invalid UTF-8 payload');
 const records=[];
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
 for (let i=0;i<lines.length;i++) {
  if (!lines[i].trim()) continue;
  const values=lines[i].split('\t').map(v=>v.trim());
  const fields=Object.fromEntries(columns.map((c,n)=>[c,values[n]]));
  const pin=(fields.pin || '').replace(/^PIN=/,'');
  const timestamp=fields.timestamp || '';
  const parts=/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(timestamp);
  const date=parts ? new Date(timestamp.replace(' ','T')+'Z') : null;
  const validDate=date && Number.isFinite(date.valueOf()) && date.toISOString().slice(0,19).replace('T',' ')===timestamp && +parts[1]>=2000 && +parts[1]<=2099;
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(pin) || !validDate || !/^\d{1,3}$/.test(fields.status || '') || !/^\d{1,3}$/.test(fields.verify || '') || +fields.status>255 || +fields.verify>255 || (fields.workcode && !/^\d{1,10}$/.test(fields.workcode))) {
   throw new RequestError(422,`Invalid attendance at line ${i+1}`);
  }
  const rawStatus=+fields.status, rawVerify=+fields.verify;
  const verifyMode=({0:'Password',1:'Fingerprint',2:'Card',15:'Face',20:'Face'})[rawVerify] || `ZK:${rawVerify}`;
  const inOutState=[0,4].includes(rawStatus)?'Masuk':[1,5].includes(rawStatus)?'Pulang':'Scan Antara';
  records.push({pin,timestamp,workDate:timestamp.slice(0,10),rawStatus,rawVerify,verifyMode,inOutState,workCode:fields.workcode || '0',rawLine:lines[i]});
  if (records.length>maxRecords) throw new RequestError(413,`Batch exceeds ${maxRecords} records`);
 }
 return records;
}
export function resolveEmployee(pin, employees, identities=[]) {
 const norm=v=>String(v??'').trim().toLowerCase();
 const unique=rows=>{const ids=[...new Set(rows.map(e=>String(e.id)))];return ids.length===1?rows[0].id:null;};
 const external=norm(pin), mapped=identities.filter(i=>norm(i.externalNoId)===external);
 if(mapped.length) return unique(mapped.filter(i=>employees.some(e=>String(e.id)===String(i.employeeId))).map(i=>({id:i.employeeId})));
 const exact=employees.filter(e=>norm(e.employeeCode)===external || (e.barcode && norm(e.barcode)===external));
 if(exact.length) return unique(exact);
 if(!/^\d+$/.test(external)) return null;
 const num=v=>v.replace(/^0+(?=\d)/,'');
 return unique(employees.filter(e=>/^\d+$/.test(norm(e.employeeCode)) && num(norm(e.employeeCode))===num(external)));
}
export function optionsResponse(serial, stamp='0', timezone=7) {
 return `GET OPTION FROM: ${serial}\nStamp=${stamp}\nATTLOGStamp=${stamp}\nOpStamp=0\nPhotoStamp=0\nErrorDelay=60\nDelay=30\nTransTimes=00:00;14:05\nTransInterval=1\nTransFlag=TransData AttLog\nRealtime=1\nEncrypt=0\nTimeZone=${timezone}\n`;
}
