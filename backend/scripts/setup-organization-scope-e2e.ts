import 'dotenv/config';
import {writeFileSync} from 'node:fs';
import {Pool} from 'pg';
import bcrypt from 'bcrypt';

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost','127.0.0.1'].includes(url.hostname) || url.pathname !== '/ams_scope_e2e_test') {
    throw new Error('Use a disposable loopback ams_scope_e2e_test database');
  }
  const pool = new Pool({connectionString:url.toString()});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const role = await client.query("SELECT id FROM roles WHERE code='hr_attendance'");
    if (role.rowCount !== 1) throw new Error('Migrate and seed the disposable database first');
    const existing = await client.query('SELECT id FROM organization_groups LIMIT 1');
    if (existing.rowCount) throw new Error('Fixture requires an empty organization catalog');
    await client.query(`INSERT INTO organization_groups(code,name) VALUES('CMC','CMC'),('MGM','MGM');
      INSERT INTO departments(code,name) VALUES('E2E-CMC','E2E CMC'),('E2E-MGM','E2E MGM');
      INSERT INTO department_organization_mappings(department_id,group_id,approval_reference)
        SELECT d.id,g.id,'E2E fixture' FROM departments d JOIN organization_groups g ON d.code='E2E-'||g.code;
      INSERT INTO employees(employee_number,full_name,department_id)
        SELECT d.code,'SCOPE_'||g.code||'_VISIBLE',d.id FROM departments d JOIN organization_groups g ON d.code='E2E-'||g.code;
      INSERT INTO attendance_records(employee_id,work_date,group_id)
        SELECT e.id,'2026-10-29',m.group_id FROM employees e JOIN department_organization_mappings m ON m.department_id=e.department_id;`);
    const username = 'scope-browser', password = 'ScopeFixture123!';
    await client.query(`INSERT INTO users(username,password_hash,role_id,role)
      SELECT $1,$2,id,name FROM roles WHERE code='hr_attendance'`,[username,await bcrypt.hash(password,10)]);
    await client.query(`INSERT INTO user_organization_group_access(user_id,group_id)
      SELECT u.id,g.id FROM users u CROSS JOIN organization_groups g WHERE u.username=$1`,[username]);
    const groups = (await client.query('SELECT id::int,code FROM organization_groups ORDER BY id')).rows;
    const employees = Object.fromEntries((await client.query(`SELECT g.code,e.id::int FROM employees e
      JOIN department_organization_mappings m ON m.department_id=e.department_id
      JOIN organization_groups g ON g.id=m.group_id`)).rows.map(row=>[row.code,row.id]));
    const output = process.env.SCOPE_E2E_FIXTURE || '/tmp/ams-scope-e2e-fixture.json';
    writeFileSync(output,JSON.stringify({groups,employees,username,password}),{mode:0o600});
    await client.query('COMMIT');
    console.log(`Organization E2E fixture: ${output}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
