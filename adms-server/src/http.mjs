import http from 'node:http';
import {RequestError,validateSerial,optionsResponse} from './protocol.mjs';
export function createAdmsServer({store,maxBodyBytes=1048576,timezone=7,onError=()=>{}}) {
 const server=http.createServer(async(req,res)=>{
  const reply=(status,text)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Connection':'close'});res.end(text);};
  try {
   const url=new URL(req.url,'http://adms.local');
   if(req.method==='GET' && url.pathname==='/health/live') return reply(200,'OK');
   if(req.method==='GET' && url.pathname==='/health/ready') {await store.ready();return reply(200,'OK');}
   const path=url.pathname.replace(/\/$/,'');
   const routes={'/iclock/cdata':['GET','POST'],'/iclock/getrequest':['GET'],'/iclock/devicecmd':['GET','POST']};
   if(!routes[path]) throw new RequestError(404,'Not found');
   if(!routes[path].includes(req.method)) throw new RequestError(405,'Method not allowed');
   const serial=validateSerial(url.searchParams.get('SN'));
   const ip=(req.socket.remoteAddress || '').replace(/^::ffff:/,'');
   if(req.method==='GET' && path!=='/iclock/devicecmd') {
    if(path==='/iclock/getrequest' && store.pollReadCommand) return reply(200,await store.pollReadCommand(serial,ip));
    const device=await store.touch(serial,ip);
    return reply(200,path==='/iclock/cdata'?optionsResponse(serial,device.stamp,timezone):'OK');
   }
   if(req.headers['content-encoding'] && req.headers['content-encoding']!=='identity') throw new RequestError(415,'Unsupported content encoding');
   if(Number(req.headers['content-length'] || 0)>maxBodyBytes) throw new RequestError(413,'Payload too large');
   const chunks=[];let size=0;
   for await(const chunk of req) {
    size+=chunk.length;
    if(size>maxBodyBytes) throw new RequestError(413,'Payload too large');
    chunks.push(chunk);
   }
   const table=path==='/iclock/devicecmd'?'DEVICECMD':url.searchParams.get('table');
   if(!/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(table || '')) throw new RequestError(400,'Invalid table');
   const stamp=url.searchParams.get('Stamp');
   if(stamp!==null && !/^[A-Za-z0-9_.:+-]{1,100}$/.test(stamp)) throw new RequestError(400,'Invalid Stamp');
   const payload=Buffer.concat(chunks);
   const result=await store.receive({serial,ip,table,stamp,payload,source:'ADMS',metadata:{query:Object.fromEntries(url.searchParams)}});
   if(path==='/iclock/devicecmd' && store.recordReadCommandResult) await store.recordReadCommandResult(serial,ip,payload,Object.fromEntries(url.searchParams));
   reply(200,table==='ATTLOG'?`OK: ${result.count}`:'OK');
  } catch(error) {
   if(!error.status) onError(error);
   if(!res.headersSent && !res.destroyed) reply(error.status || 503,error.status?error.message:'Temporarily unavailable');
  }
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=1000;
 server.maxHeadersCount=32;
 server.on('clientError',(_err,socket)=>socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
 return server;
}
