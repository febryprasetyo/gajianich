import {makePool,Store} from './store.mjs';
import {createAdmsServer} from './http.mjs';
const port=Number(process.env.PORT || 8081);
const timezone=Number(process.env.ADMS_TIMEZONE_HOURS || 7);
const maxBodyBytes=Number(process.env.MAX_BODY_BYTES || 1048576);
if(!Number.isInteger(port)||port<1||port>65535||!Number.isFinite(timezone)||timezone< -12||timezone>14||!Number.isInteger(maxBodyBytes)||maxBodyBytes<1||maxBodyBytes>16777216) throw new Error('Invalid listener configuration');
const pool=makePool(process.env.DATABASE_URL);
pool.on('error',error=>console.error(JSON.stringify({event:'database_pool_error',code:error.code || 'DB_ERROR'})));
const server=createAdmsServer({store:new Store(pool),timezone,maxBodyBytes,onError:error=>console.error(JSON.stringify({event:'request_failed',code:error.code || 'DB_ERROR'}))});
server.listen(port,'0.0.0.0',()=>console.log(JSON.stringify({event:'listening',port})));
let stopping=false;
async function stop(){if(stopping)return;stopping=true;const timeout=setTimeout(()=>process.exit(1),10000);timeout.unref();server.closeIdleConnections?.();server.close(async()=>{await pool.end();clearTimeout(timeout);});}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
