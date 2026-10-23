import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { loadEnv } from '../config/env';

import * as goodsRequestsSchema from './schema/goodsRequests';
import * as usersSchema from './schema/users';
import * as masterSchema from './schema/master';
import * as vendorsSchema from './schema/vendors';
import * as employeesSchema from './schema/employees';
import * as assetCustodiansSchema from './schema/assetCustodians';
import * as assetsSchema from './schema/assets';
import * as ticketsSchema from './schema/tickets';
import * as licensesSchema from './schema/licenses';
import * as infrastructureSchema from './schema/infrastructure';
import * as systemSchema from './schema/system';
import * as hardwareAuditsSchema from './schema/hardwareAudits';
import * as leavesSchema from './schema/leaves';
import * as attendanceSchema from './schema/attendance';
import * as hrAuditSchema from './schema/hrAudit';
import * as attendanceWorkspaceSchema from './schema/attendanceWorkspace';
import * as attendanceSelfLogsSchema from './schema/attendanceSelfLogs';
import * as attendanceFaceProfilesSchema from './schema/attendanceFaceProfiles';
import * as attendanceFaceRequestsSchema from './schema/attendanceFaceRequests';

let poolInstance: Pool | null = null;

export function getPool(): Pool {
  if (!poolInstance) {
    const env = loadEnv();
    poolInstance = new Pool({
      connectionString: env.databaseUrl,
    });
  }
  return poolInstance;
}

export const pool = {
  query: (text: string, params?: any[]) => getPool().query(text, params),
  connect: () => getPool().connect(),
  end: () => (poolInstance ? poolInstance.end() : Promise.resolve()),
};

export const db = drizzle(getPool(), {
  schema: {
    ...usersSchema,
    ...goodsRequestsSchema,
    ...masterSchema,
    ...vendorsSchema,
    ...employeesSchema,
    ...assetsSchema,
    ...assetCustodiansSchema,
    ...ticketsSchema,
    ...licensesSchema,
    ...infrastructureSchema,
    ...systemSchema,
    ...hardwareAuditsSchema,
    ...leavesSchema,
    ...attendanceSchema,
    ...hrAuditSchema,
    ...attendanceWorkspaceSchema,
    ...attendanceSelfLogsSchema,
    ...attendanceFaceProfilesSchema,
    ...attendanceFaceRequestsSchema,
  },
});

export async function checkDatabase(): Promise<void> {
  const client = await getPool().connect();
  try {
    // Readiness includes the tables required by the attendance API, not only connectivity.
    await client.query('SELECT key FROM system_settings LIMIT 0');
    await client.query('SELECT id FROM attendance_batches LIMIT 0');
    await client.query('SELECT id FROM attendance_records LIMIT 0');
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

export {
  usersSchema,
  masterSchema,
  vendorsSchema,
  employeesSchema,
  assetsSchema,
  assetCustodiansSchema,
  ticketsSchema,
  licensesSchema,
  infrastructureSchema,
  systemSchema,
  hardwareAuditsSchema,
  leavesSchema,
  attendanceSchema,
  hrAuditSchema,
  attendanceWorkspaceSchema,
  attendanceSelfLogsSchema,
  attendanceFaceProfilesSchema,
  attendanceFaceRequestsSchema,
};
