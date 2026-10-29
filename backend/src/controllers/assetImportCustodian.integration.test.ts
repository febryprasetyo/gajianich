import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { eq } from 'drizzle-orm';
import { createApp } from '../app';
import { closeDatabase, db, pool } from '../db';
import { assetCustodians } from '../db/schema/assetCustodians';
import { assetAssignmentHistory, assetCategories, assets } from '../db/schema/assets';
import { auditLogs } from '../db/schema/system';
import { buildAssetImportTemplate } from '../services/assetWorkbook';
import {createTestOperator} from '../testing/testOperator';

test('XLSX preview is read-only and commit creates a manual holder with immutable assignment snapshots', async () => {
  const server = createApp().listen(0);
  const base = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/api/v1/assets/import';
  const operator=await createTestOperator();
  const token = operator.token();
  const suffix = Date.now().toString(36) + process.pid;
  const holderName = 'Import Contractor ' + suffix;
  const assetCode = ('IMP-' + suffix).slice(0, 50);
  let categoryId: number | undefined;
  let ownsCategory = false;
  let assetId: number | undefined;

  async function upload(path: string, buffer: Buffer) {
    const form = new FormData();
    form.append(
      'file',
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'asset-import.xlsx',
    );
    const response = await fetch(base + path, {
      method: 'POST',
      headers: operator.headers(token),
      body: form,
    });
    return { status: response.status, body: await response.json() as any };
  }

  try {
    const [existingCategory] = await db.select().from(assetCategories).where(eq(assetCategories.name, 'Laptop'));
    const category = existingCategory ?? (await db.insert(assetCategories).values({
      name: 'Laptop',
      codePrefix: 'LPT',
    }).returning())[0];
    categoryId = category.id;
    ownsCategory = !existingCategory;

    const template = await buildAssetImportTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(template as any);
    workbook.getWorksheet('Laptop-PC')!.addRow([
      'REF-' + suffix,
      'LAPTOP',
      assetCode,
      'Laptop without HR or specs',
      '',
      '',
      '',
      holderName,
      '',
      'Good',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    workbook.getWorksheet('Laptop-PC')!.getRow(2).getCell(6).value=operator.locationCode;
    const file = Buffer.from(await workbook.xlsx.writeBuffer());

    const before = await pool.query('SELECT count(*)::int AS count FROM asset_custodians WHERE display_name=$1', [holderName]);
    assert.equal(before.rows[0].count, 0);

    const preview = await upload('/preview', file);
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.valid, true);
    assert.equal(preview.body.resolvedData.laptops[0].custodianResolution.action, 'CREATE_MANUAL');
    const afterPreview = await pool.query('SELECT count(*)::int AS count FROM asset_custodians WHERE display_name=$1', [holderName]);
    assert.equal(afterPreview.rows[0].count, 0, 'preview must not create a custodian');

    const committed = await upload('/commit', file);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    assetId = committed.body.createdAssetIds[0];

    const stored = (await pool.query(
      'SELECT current_custodian_id, current_user_id FROM assets WHERE id=$1',
      [assetId],
    )).rows[0];
    assert.ok(stored.current_custodian_id);
    assert.equal(stored.current_user_id, null, 'import must not write the legacy employee assignment');
    const history = (await pool.query(
      'SELECT custodian_id, custodian_name_snapshot, assigned_by_user_id FROM asset_assignment_history WHERE asset_id=$1',
      [assetId],
    )).rows[0];
    assert.equal(Number(history.custodian_id), Number(stored.current_custodian_id));
    assert.equal(history.custodian_name_snapshot, holderName);
    assert.equal(Number(history.assigned_by_user_id), operator.userId);
    assert.equal((await pool.query('SELECT id FROM asset_computer_specs WHERE asset_id=$1', [assetId])).rowCount, 0);
  } finally {
    if (assetId) {
      await db.delete(assetAssignmentHistory).where(eq(assetAssignmentHistory.assetId, assetId));
      await db.delete(auditLogs).where(eq(auditLogs.entityId, assetId));
      await db.delete(assets).where(eq(assets.id, assetId));
    }
    await pool.query(
      "DELETE FROM audit_logs WHERE entity='ASSET_CUSTODIAN' AND entity_id IN (SELECT id FROM asset_custodians WHERE display_name=$1)",
      [holderName],
    );
    await db.delete(assetCustodians).where(eq(assetCustodians.displayName, holderName));
    if (categoryId && ownsCategory) await db.delete(assetCategories).where(eq(assetCategories.id, categoryId));
    await operator.cleanup();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeDatabase();
  }
});

