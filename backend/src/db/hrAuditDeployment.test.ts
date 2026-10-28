import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const environment = {
  ...process.env,
  APP_VERSION: 'v0.0.0-test', DATABASE_URL: 'postgresql://runtime:fixture@postgres:5432/gajianich_prod_db',
  MIGRATION_DATABASE_URL: 'postgresql://owner:fixture@postgres:5432/gajianich_prod_db',
  HR_AUDIT_RUNTIME_ROLE: 'runtime', POSTGRES_PASSWORD: 'fixture',
  JWT_SECRET: 'fixture-jwt', JWT_REFRESH_SECRET: 'fixture-refresh', AGENT_API_KEY: 'fixture-agent',
  CORS_ALLOWED_ORIGINS: 'http://localhost', LAN_BIND_ADDRESS: '127.0.0.1',
};

for (const base of ['deploy/compose.prod.yml', 'deploy/compose.lan.yml']) {
  test(`${base} isolates owner credentials to the migration overlay`, () => {
    function config(overlay: boolean) {
      const args = ['compose', '-f', base];
      if (overlay) args.push('-f', 'deploy/compose.migrate.yml');
      args.push('config', '--format', 'json');
      return JSON.parse(execFileSync('docker', args, { cwd: root, env: environment, encoding: 'utf8' }));
    }
    const normal = config(false).services.backend.environment;
    assert.equal(normal.DATABASE_URL, environment.DATABASE_URL);
    assert.equal(normal.MIGRATION_DATABASE_URL, undefined);
    const migration = config(true).services.backend.environment;
    assert.equal(migration.MIGRATION_DATABASE_URL, environment.MIGRATION_DATABASE_URL);
    assert.equal(migration.HR_AUDIT_RUNTIME_ROLE, environment.HR_AUDIT_RUNTIME_ROLE);
  });
}

test('production migration invocations select the migration-only overlay and env file', () => {
  assert.match(read('deploy/scripts/deploy.sh'), /--env-file "\$ENV_FILE"[^\n]+compose\.migrate\.yml[^\n]+run --rm/);
  assert.match(read('deploy/scripts/lan-production.sh'), /-f "\$RELEASE_DIR\/compose\.migrate\.yml"[^\n]+run --rm/);
  assert.match(read('deploy/scripts/lan-production.sh'), /cp "\$REPO_DIR\/deploy\/compose\.migrate\.yml"/);
});

test('fresh smoke test provisions an audit runtime role before applying migrations', () => {
  const smoke = read('scripts/smoke-test.sh');
  assert.ok(smoke.indexOf('CREATE ROLE gajianich_smoke_runtime') >= 0);
  assert.ok(smoke.indexOf('CREATE ROLE gajianich_smoke_runtime') < smoke.indexOf('npm run db:migrate'));
  assert.match(smoke, /HR_AUDIT_RUNTIME_ROLE=gajianich_smoke_runtime/);
});
