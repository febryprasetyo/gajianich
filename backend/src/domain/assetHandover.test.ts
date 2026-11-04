import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatHandoverNumber,
  validateHandoverInput,
  HandoverInputError,
  VALID_ITEM_TYPES,
} from './assetHandover';

test('formatHandoverNumber formats sequence and year-month properly', () => {
  const number1 = formatHandoverNumber('2026-11-04', 1);
  assert.equal(number1, 'TTB-202611-0001');

  const number42 = formatHandoverNumber('2026-12-31', 42);
  assert.equal(number42, 'TTB-202612-0042');
});

test('validateHandoverInput accepts complete valid input', () => {
  const validData = {
    handoverDate: '2026-11-04',
    recipientName: 'Ahmad Fauzi',
    recipientAddress: 'Jl. Sudirman Kav 20, Jakarta',
    recipientPosition: 'IT Support',
    recipientPhone: '08123456789',
    itemTypes: ['laptop', 'mouse'],
    givenByName: 'Budi Santoso',
    givenByTitle: 'IT Manager',
    receivedByName: 'Ahmad Fauzi',
    notes: 'Serah terima laptop inventaris',
    status: 'COMPLETED',
    items: [
      {
        itemOrder: 1,
        itemName: 'ThinkPad T14',
        description: 'S/N: 12345, adaptor 65W',
      },
    ],
  };

  const parsed = validateHandoverInput(validData);
  assert.equal(parsed.recipientName, 'Ahmad Fauzi');
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].itemName, 'ThinkPad T14');
});

test('validateHandoverInput allows optional empty recipientName and receivedByName for manual fill', () => {
  const manualData = {
    handoverDate: '2026-11-04',
    givenByName: 'Budi Santoso',
    items: [{ itemName: 'Laptop Lenovo' }],
  };

  const parsed = validateHandoverInput(manualData);
  assert.equal(parsed.recipientName, '');
  assert.equal(parsed.receivedByName, '');
  assert.equal(parsed.items.length, 1);
});

test('validateHandoverInput rejects missing givenByName and empty items', () => {
  assert.throws(
    () => {
      validateHandoverInput({
        handoverDate: '2026-11-04',
        // givenByName missing
        items: [{ itemName: 'Barang' }],
      });
    },
    (err: any) => err instanceof HandoverInputError && err.message.includes('givenByName')
  );

  assert.throws(
    () => {
      validateHandoverInput({
        handoverDate: '2026-11-04',
        givenByName: 'Budi Santoso',
        items: [], // empty items
      });
    },
    (err: any) => err instanceof HandoverInputError && err.message.includes('rincian barang')
  );
});

test('VALID_ITEM_TYPES contains standard office equipment checklist', () => {
  assert.deepEqual(
    [...VALID_ITEM_TYPES],
    ['laptop', 'monitor', 'printer', 'pc', 'mouse', 'lainnya']
  );
});

