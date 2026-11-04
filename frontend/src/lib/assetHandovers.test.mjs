import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatHandoverDate,
  getItemTypeLabel,
  padHandoverItems,
  HANDOVER_ITEM_TYPE_OPTIONS,
} from './assetHandovers.ts';

test('formatHandoverDate converts YYYY-MM-DD into Indonesian format', () => {
  assert.equal(formatHandoverDate('2026-11-04'), '4 November 2026');
  assert.equal(formatHandoverDate('2026-01-15'), '15 Januari 2026');
  assert.equal(formatHandoverDate(''), '');
  assert.equal(formatHandoverDate(null), '');
});

test('getItemTypeLabel maps type IDs to proper Indonesian form labels', () => {
  assert.equal(getItemTypeLabel('laptop'), 'Laptop');
  assert.equal(getItemTypeLabel('monitor'), 'Monitor');
  assert.equal(getItemTypeLabel('printer'), 'Printer');
  assert.equal(getItemTypeLabel('pc'), 'PC');
  assert.equal(getItemTypeLabel('mouse'), 'Mouse');
  assert.equal(getItemTypeLabel('lainnya'), 'Lainya');
  assert.equal(getItemTypeLabel('custom'), 'custom');
});

test('padHandoverItems ensures minimal rows for balanced paper print appearance', () => {
  // Empty items padded to 6 rows
  const emptyPadded = padHandoverItems([], 6);
  assert.equal(emptyPadded.length, 6);
  assert.equal(emptyPadded[0].order, 1);
  assert.equal(emptyPadded[0].itemName, '');

  // 2 items padded to 6 rows
  const twoItemsPadded = padHandoverItems([
    { itemOrder: 1, itemName: 'Laptop Lenovo', description: 'S/N: 123' },
    { itemOrder: 2, itemName: 'Mouse Logitech', description: 'Hitam' },
  ], 6);
  assert.equal(twoItemsPadded.length, 6);
  assert.equal(twoItemsPadded[0].itemName, 'Laptop Lenovo');
  assert.equal(twoItemsPadded[1].itemName, 'Mouse Logitech');
  assert.equal(twoItemsPadded[2].itemName, '');

  // 8 items not reduced
  const eightItems = Array.from({ length: 8 }, (_, i) => ({
    itemOrder: i + 1,
    itemName: `Item ${i + 1}`,
    description: `Desc ${i + 1}`,
  }));
  const notTruncated = padHandoverItems(eightItems, 6);
  assert.equal(notTruncated.length, 8);
});

test('HANDOVER_ITEM_TYPE_OPTIONS defines the 6 checklist options from the physical form', () => {
  const ids = HANDOVER_ITEM_TYPE_OPTIONS.map((o) => o.id);
  assert.deepEqual(ids, ['laptop', 'monitor', 'printer', 'pc', 'mouse', 'lainnya']);
});
