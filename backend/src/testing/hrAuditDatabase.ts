import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';

/** Only explicitly configured, loopback test databases may provision disposable fixtures. */
export async function createHrAuditTestDatabase() {
  const configured = process.env.HR_AUDIT_TEST_DATABASE_URL;
  if (!configured) throw new Error('HR_AUDIT_TEST_DATABASE_URL is required; use a disposable PostgreSQL test instance');
  const url = new URL(configured);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || !/^\/(gajianich|ams)_(hr_audit_test|ci_db)$/.test(url.pathname)) {
    throw new Error('HR audit tests require a loopback gajianich_hr_audit_test, ams_hr_audit_test, or gajianich_ci_db database');
  }
  const suffix = randomBytes(8).toString('hex');
  const name = `hr_audit_test_${suffix}`;
  const runtimeRole = `hr_audit_runtime_${suffix}`;
  const password = randomBytes(24).toString('hex');
  const administrator = new Pool({ connectionString: configured, connectionTimeoutMillis: 5000 });
  // Identifiers and password contain only fixed prefixes / generated hexadecimal characters.
  const identifier = (value: string) => {
    if (!/^[a-z_][a-z0-9_]+$/.test(value)) throw new Error('Invalid test identifier');
    return `"${value}"`;
  };
  let databaseCreated = false;
  let roleCreated = false;
  let owner: Pool | undefined;
  let runtime: Pool | undefined;
  async function cleanup() {
    await runtime?.end();
    await owner?.end();
    try {
      if (databaseCreated) await administrator.query(`DROP DATABASE ${identifier(name)} WITH (FORCE)`);
      if (roleCreated) await administrator.query(`DROP ROLE ${identifier(runtimeRole)}`);
    } finally {
      await administrator.end();
    }
  }
  try {
    await administrator.query(`CREATE ROLE ${identifier(runtimeRole)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
    roleCreated = true;
    await administrator.query(`CREATE DATABASE ${identifier(name)}`);
    databaseCreated = true;
    url.pathname = `/${name}`;
    const ownerUrl = url.toString();
    owner = new Pool({ connectionString: ownerUrl, connectionTimeoutMillis: 5000 });
    owner.on("error", () => {});
    url.username = runtimeRole;
    url.password = password;
    runtime = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
    runtime.on("error", () => {});
    return { owner, runtime, ownerUrl, runtimeRole, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
