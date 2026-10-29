import assert from 'node:assert/strict';
import test from 'node:test';
import type { Server } from 'node:http';
import { createApp } from '../app';
import { closeDatabase } from '../db';
import { createTestOperator } from '../testing/testOperator';

type ApiResult = {
  status: number;
  body: Record<string, any>;
};

test('IT equipment type API enforces roles, validation, uniqueness, and referenced-delete safety', async () => {
  const app = createApp({ databaseCheck: async () => {} });
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const uniqueSuffix = `${process.pid}${Date.now().toString(36)}`.toUpperCase();
  const originalName = `Integration Equipment ${uniqueSuffix}`;
  const updatedName = `Updated Equipment ${uniqueSuffix}`;
  const originalPrefix = `T${uniqueSuffix}`.slice(0, 20);
  const updatedPrefix = `U${uniqueSuffix}`.slice(0, 20);
  const operator = await createTestOperator();
  const adminToken = operator.token();
  const employeeToken = operator.token('Employee');
  let equipmentTypeId: number | null = null;
  let assetId: number | null = null;
  let raceTypeId: number | null = null;
  const patternTypeIds: number[] = [];

  async function api(path: string, method = 'GET', body?: unknown, token?: string): Promise<ApiResult> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? operator.headers(token) : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(path==='/assets'&&method==='POST'?{locationId:operator.locationId,...body as object}:body),
    });
    return {
      status: response.status,
      body: await response.json() as Record<string, any>,
    };
  }

  try {
    assert.equal((await api('/assets/categories')).status, 401);
    assert.equal((await api('/assets/categories', 'POST', { name: originalName, codePrefix: originalPrefix }, employeeToken)).status, 403);
    const blankName = await api('/assets/categories', 'POST', { name: '   ', codePrefix: 'BAD' }, adminToken);
    if (blankName.status === 201) {
      await api(`/assets/categories/${blankName.body.id}`, 'DELETE', undefined, adminToken);
    }
    assert.equal(blankName.status, 400);

    const unsafePrefix = await api('/assets/categories', 'POST', { name: originalName, codePrefix: 'A|B' }, adminToken);
    if (unsafePrefix.status === 201) {
      await api(`/assets/categories/${unsafePrefix.body.id}`, 'DELETE', undefined, adminToken);
    }
    assert.equal(unsafePrefix.status, 400);

    const created = await api('/assets/categories', 'POST', { name: `  ${originalName}  `, codePrefix: originalPrefix.toLowerCase() }, adminToken);
    assert.equal(created.status, 201);
    assert.equal(created.body.name, originalName);
    assert.equal(created.body.codePrefix, originalPrefix);
    equipmentTypeId = created.body.id as number;

    const duplicate = await api('/assets/categories', 'POST', { name: originalName.toLowerCase(), codePrefix: `${originalPrefix}X`.slice(0, 20) }, adminToken);
    assert.equal(duplicate.status, 409);

    const literalName = `Literal Laptop ${uniqueSuffix}`;
    const wildcardName = `% Laptop ${uniqueSuffix}`;
    const literalType = await api('/assets/categories', 'POST', { name: literalName, codePrefix: `P${uniqueSuffix}`.slice(0, 20) }, adminToken);
    assert.equal(literalType.status, 201);
    patternTypeIds.push(literalType.body.id as number);
    const wildcardType = await api('/assets/categories', 'POST', { name: wildcardName, codePrefix: `Q${uniqueSuffix}`.slice(0, 20) }, adminToken);
    assert.equal(wildcardType.status, 201);
    patternTypeIds.push(wildcardType.body.id as number);

    const raceName = `Race Equipment ${uniqueSuffix}`;
    const [raceA, raceB] = await Promise.all([
      api('/assets/categories', 'POST', { name: raceName, codePrefix: `R${uniqueSuffix}`.slice(0, 20) }, adminToken),
      api('/assets/categories', 'POST', { name: raceName.toLowerCase(), codePrefix: `S${uniqueSuffix}`.slice(0, 20) }, adminToken),
    ]);
    assert.deepEqual([raceA.status, raceB.status].sort(), [201, 409]);
    raceTypeId = (raceA.status === 201 ? raceA.body.id : raceB.body.id) as number;
    assert.equal((await api(`/assets/categories/${raceTypeId}`, 'DELETE', undefined, adminToken)).status, 200);
    raceTypeId = null;

    const asset = await api('/assets', 'POST', { name: `Asset ${uniqueSuffix}`, categoryId: equipmentTypeId }, adminToken);
    assert.equal(asset.status, 201);
    assetId = asset.body.id as number;
    const originalAssetCode = asset.body.assetCode;

    const updated = await api(`/assets/categories/${equipmentTypeId}`, 'PUT', { name: updatedName, codePrefix: updatedPrefix.toLowerCase() }, adminToken);
    assert.equal(updated.status, 200);
    assert.equal(updated.body.codePrefix, updatedPrefix);

    const unchangedAsset = await api(`/assets/${assetId}`, 'GET', undefined, adminToken);
    assert.equal(unchangedAsset.status, 200);
    assert.equal(unchangedAsset.body.assetCode, originalAssetCode);

    const blockedDelete = await api(`/assets/categories/${equipmentTypeId}`, 'DELETE', undefined, adminToken);
    assert.equal(blockedDelete.status, 409);

    assert.equal((await api(`/assets/${assetId}`, 'DELETE', undefined, adminToken)).status, 200);
    assetId = null;
    assert.equal((await api(`/assets/categories/${equipmentTypeId}`, 'DELETE', undefined, adminToken)).status, 200);
    equipmentTypeId = null;
  } finally {
    if (assetId !== null) await api(`/assets/${assetId}`, 'DELETE', undefined, adminToken).catch(() => undefined);
    if (equipmentTypeId !== null) await api(`/assets/categories/${equipmentTypeId}`, 'DELETE', undefined, adminToken).catch(() => undefined);
    if (raceTypeId !== null) await api(`/assets/categories/${raceTypeId}`, 'DELETE', undefined, adminToken).catch(() => undefined);
    for (const id of patternTypeIds) await api(`/assets/categories/${id}`, 'DELETE', undefined, adminToken).catch(() => undefined);
    await new Promise<void>((resolve) => (server as Server).close(() => resolve()));
    await operator.cleanup();
    await closeDatabase();
  }
});
