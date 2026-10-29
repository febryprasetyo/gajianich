import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql as drizzleSql } from 'drizzle-orm';
import { createHrAuditTestDatabase } from '../testing/hrAuditDatabase';
import { runMigrations } from '../db/migrate';
import { applyOrganizationManifest, resolveDepartmentMapping, resolveLocationMapping, type ApprovedManifest } from './organizationMappings';

test('organization migration and manifest preserve legacy records, enforce ownership, and apply atomically once', async () => {
  const fixture = await createHrAuditTestDatabase();
  try {
    await fixture.owner.query(`CREATE TABLE departments (id bigint PRIMARY KEY, code text, name text);
      CREATE TABLE locations (id bigint PRIMARY KEY, code text, name text);
      CREATE TABLE users (id bigint PRIMARY KEY);
      CREATE TABLE employees (id bigint PRIMARY KEY, department_id bigint REFERENCES departments(id), employee_number text, barcode text);
      INSERT INTO departments VALUES (1, 'ENG', 'ENGINEERING'), (2, 'MGM', 'MULTI GAS MEDIKA');
      INSERT INTO locations VALUES (1, 'MGM', 'Facility'); INSERT INTO users VALUES (1);
      INSERT INTO employees VALUES (101, 1, 'LEGACY-001', 'BARCODE-UNCHANGED');`);
    const before = await fixture.owner.query('SELECT * FROM employees');
    const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
    const entry = journal.entries.find((e: {tag: string}) => e.tag.endsWith('_organization_scope'));
    assert.ok(entry, 'organization scope migration registered');
    const sql = readFileSync(`drizzle/${entry.tag}.sql`, 'utf8');
    await fixture.owner.query(sql);
    assert.deepEqual((await fixture.owner.query('SELECT * FROM employees')).rows, before.rows);
    await fixture.owner.query(`INSERT INTO organization_groups (code, name) VALUES ('CMC', 'CMC'), ('MGM', 'MGM')`);
    const groups = (await fixture.owner.query('SELECT id::int, code FROM organization_groups')).rows;
    const cmc = groups.find(g => g.code === 'CMC').id;
    const mgm = groups.find(g => g.code === 'MGM').id;
    await fixture.owner.query(`INSERT INTO organizations (group_id,code,name) VALUES ($1,'MGM-ORG','MGM identity')`, [mgm]);
    const org = (await fixture.owner.query('SELECT id::int FROM organizations')).rows[0].id;
    await assert.rejects(fixture.owner.query(`INSERT INTO department_organization_mappings (department_id,group_id,organization_id,approval_reference) VALUES (1,$1,$2,'fixture')`, [cmc, org]), {code: '23503'});
    await assert.rejects(fixture.owner.query(`INSERT INTO organization_groups (code,name) VALUES ('CMC','Duplicate')`), {code: '23505'});
    await assert.rejects(fixture.owner.query(`INSERT INTO organization_groups (code,name) VALUES ('OTH','Other')`), {code: '23514'});
    await fixture.owner.query(`INSERT INTO user_organization_group_access (user_id,group_id) VALUES (1,$1)`, [cmc]);
    await assert.rejects(fixture.owner.query(`INSERT INTO user_organization_group_access (user_id,group_id) VALUES (1,$1)`, [cmc]), {code: '23505'});
    const database = (await fixture.owner.query('SELECT current_database() AS name')).rows[0].name;
    const manifest: ApprovedManifest = { targetDatabase: database, targetEnvironmentId: 'scope-test-environment', approvalReference: 'test-review-29-october', mappings: [
      {source: 'department', sourceId: 1, sourceCode: 'ENG', groupCode: 'CMC', organizationCode: null},
      {source: 'department', sourceId: 2, sourceCode: 'MGM', groupCode: 'MGM', organizationCode: 'MGM-ORG'},
      {source: 'location', sourceId: 1, sourceCode: 'MGM', groupCode: null, organizationCode: null},
    ] };
    const db = drizzle(fixture.owner);
    await assert.rejects(db.transaction(tx => applyOrganizationManifest(tx, {...manifest,mappings:[]})), /environment/i);
    const apply = (input: ApprovedManifest) => db.transaction(async tx => {
      await tx.execute(drizzleSql`SELECT set_config('gajianich.organization_environment_id','scope-test-environment',true)`);
      return applyOrganizationManifest(tx,input);
    });
    await assert.rejects(apply({...manifest,targetEnvironmentId:'different-environment',mappings:[]}), /environment/i);
    await assert.rejects(apply({...manifest, targetDatabase: 'wrong_database'}));
    await assert.rejects(apply({...manifest, approvalReference: ''}));
    assert.deepEqual(await apply(manifest), {inserted: 2, unchanged: 0, unresolved: 1});
    assert.deepEqual(await apply(manifest), {inserted: 0, unchanged: 2, unresolved: 1});
    await fixture.owner.query(`UPDATE departments SET name='RENAMED' WHERE id=2`);
    assert.deepEqual(await resolveDepartmentMapping(db, 2), {groupId: mgm, groupCode: 'MGM', organizationId: org});
    assert.equal(await resolveDepartmentMapping(db, null), null);
    assert.equal(await resolveDepartmentMapping(db, 999), null);
    assert.equal(await resolveLocationMapping(db, 1), null);
    await assert.rejects(apply({...manifest, mappings: [
      {source: 'location', sourceId: 1, sourceCode: 'MGM', groupCode: 'MGM', organizationCode: null},
      {...manifest.mappings[0], groupCode: 'MGM'},
    ]}), /conflict/i);
    assert.equal(await resolveLocationMapping(db, 1), null, 'conflict rolls back earlier inserts');
    assert.deepEqual((await fixture.owner.query('SELECT * FROM employees')).rows, before.rows);
    await fixture.owner.query('UPDATE organization_groups SET is_active=false WHERE id=$1', [mgm]);
    assert.equal(await resolveDepartmentMapping(db, 2), null, 'inactive groups deny resolution');
  } finally { await fixture.cleanup(); }
});

test('journal upgrade applied twice preserves final employee and attendance records including IDs and foreign keys', async () => {
  const fixture = await createHrAuditTestDatabase();
  const legacy = await mkdtemp(path.join(os.tmpdir(), 'ams-scope-legacy-'));
  try {
    const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
    const scope = journal.entries.find((entry: {tag: string}) => entry.tag.endsWith('_organization_scope'));
    const entries = journal.entries.filter((entry: {idx: number}) => entry.idx < scope.idx);
    await mkdir(path.join(legacy,'meta'));
    await writeFile(path.join(legacy,'meta/_journal.json'), JSON.stringify({...journal,entries}));
    for (const entry of entries) await copyFile(`drizzle/${entry.tag}.sql`, path.join(legacy,`${entry.tag}.sql`));
    await runMigrations(fixture.ownerUrl, legacy, fixture.runtimeRole);
    await fixture.owner.query(`INSERT INTO departments (name,code) VALUES ('Legacy department','LEGACY');
      INSERT INTO employees (employee_number, full_name, department_id, barcode) SELECT 'FINAL-001','Final employee fixture',id,'FINAL-BARCODE' FROM departments;
      INSERT INTO attendance_records (employee_id,work_date,scan_in,scan_out) SELECT id,'2026-10-29','08:00','17:00' FROM employees;`);
    const employees = (await fixture.owner.query('SELECT * FROM employees ORDER BY id')).rows;
    const attendance = (await fixture.owner.query('SELECT * FROM attendance_records ORDER BY id')).rows;
    await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
    await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
    assert.deepEqual((await fixture.owner.query('SELECT * FROM employees ORDER BY id')).rows, employees);
    const upgradedAttendance=(await fixture.owner.query('SELECT * FROM attendance_records ORDER BY id')).rows;
    assert.deepEqual(upgradedAttendance.map(({group_id,organization_id,...legacy})=>legacy),attendance);
    assert.ok(upgradedAttendance.every(row=>row.group_id===null && row.organization_id===null),'historical ownership is never invented by upgrade');
    assert.equal((await fixture.owner.query('SELECT count(*)::int AS count FROM user_organization_group_access')).rows[0].count,0);
  } finally {
    await fixture.cleanup();
    await rm(legacy,{recursive:true,force:true});
  }
});
