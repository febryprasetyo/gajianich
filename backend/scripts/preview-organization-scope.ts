import 'dotenv/config';
import { Client } from 'pg';
import { buildDepartmentCandidates, buildLocationCandidates, type MasterRow } from '../src/domain/organizationScope';

async function main() {
  const target = process.env.DATABASE_URL;
  if (!target) throw new Error('DATABASE_URL is required');
  const client = new Client({ connectionString: target, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '10s'");
    const environment = await client.query("SELECT current_database() AS database, inet_server_addr() AS server, inet_server_port() AS port, current_setting('gajianich.organization_environment_id', true) AS environment_id");
    const departments = await client.query<MasterRow>('SELECT id::float8 AS id, code, name FROM departments ORDER BY id');
    const locations = await client.query<MasterRow>('SELECT id::float8 AS id, code, name FROM locations ORDER BY id');
    const employeeCounts = await client.query(`SELECT department_id::float8 AS "sourceId", count(*)::int AS count FROM employees GROUP BY department_id ORDER BY department_id NULLS LAST`);
    const assetCounts = await client.query(`SELECT location_id::float8 AS "sourceId", count(*)::int AS count FROM assets GROUP BY location_id ORDER BY location_id NULLS LAST`);
    const candidates = [...buildDepartmentCandidates(departments.rows), ...buildLocationCandidates(locations.rows)];
    const summarize = (rows: {sourceId: number | null; count: number}[], source: 'department' | 'location') => {
      let total = 0, proposed = 0;
      for (const row of rows) {
        total += row.count;
        if (candidates.some(c => c.source === source && c.sourceId === row.sourceId && c.groupCode !== null)) proposed += row.count;
      }
      return { total, proposed, unresolved: total - proposed, applied: 0 };
    };
    await client.query('ROLLBACK');
    process.stdout.write(JSON.stringify({ status: 'PREVIEW_NOT_APPROVED_NOT_APPLIED', capturedAt: new Date().toISOString(),
      environment: environment.rows[0], candidates, counts: {
        employees: summarize(employeeCounts.rows, 'department'), assets: summarize(assetCounts.rows, 'location'),
      } }, null, 2) + '\n');
  } finally { await client.end(); }
}
main().catch(() => { process.stderr.write('Organization preview failed; verify target database, schema and connectivity. No changes applied.\n'); process.exitCode = 1; });
