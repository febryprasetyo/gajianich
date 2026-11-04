import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { assetHandovers, assetHandoverItems } from './assetHandovers';

test('assetHandovers schema exposes required handover metadata columns', () => {
  const columns = getTableColumns(assetHandovers);

  assert.ok(columns.id, 'id column must exist');
  assert.ok(columns.handoverNumber, 'handoverNumber column must exist');
  assert.ok(columns.handoverDate, 'handoverDate column must exist');
  assert.ok(columns.recipientName, 'recipientName column must exist');
  assert.ok(columns.recipientAddress, 'recipientAddress column must exist');
  assert.ok(columns.recipientPosition, 'recipientPosition column must exist');
  assert.ok(columns.recipientPhone, 'recipientPhone column must exist');
  assert.ok(columns.itemTypes, 'itemTypes column must exist');
  assert.ok(columns.itemTypesCustom, 'itemTypesCustom column must exist');
  assert.ok(columns.givenByName, 'givenByName column must exist');
  assert.ok(columns.givenByTitle, 'givenByTitle column must exist');
  assert.ok(columns.receivedByName, 'receivedByName column must exist');
  assert.ok(columns.status, 'status column must exist');
  assert.ok(columns.createdAt, 'createdAt column must exist');
  assert.ok(columns.updatedAt, 'updatedAt column must exist');
});

test('assetHandoverItems schema exposes required item columns with cascade foreign key structure', () => {
  const columns = getTableColumns(assetHandoverItems);

  assert.ok(columns.id, 'id column must exist');
  assert.ok(columns.handoverId, 'handoverId column must exist');
  assert.ok(columns.itemOrder, 'itemOrder column must exist');
  assert.ok(columns.assetId, 'assetId column must exist');
  assert.ok(columns.itemName, 'itemName column must exist');
  assert.ok(columns.description, 'description column must exist');
  assert.ok(columns.createdAt, 'createdAt column must exist');
});
