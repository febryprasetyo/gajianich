import assert from 'node:assert/strict';
import test from 'node:test';
import router from './assetHandoverRoutes';
import { db } from '../db';
import {
  createHandover,
  getHandoverById,
  listHandovers,
  updateHandover,
  deleteHandover,
  getHandoverStats,
} from '../services/assetHandoverService';

function registeredMethods(path: string): string[] {
  const stack = (router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack;
  return stack
    .filter((item) => item.route?.path === path)
    .flatMap((item) => Object.keys(item.route!.methods).filter((method) => item.route!.methods[method]));
}

test('asset handover router registers all CRUD endpoints', () => {
  assert.deepEqual(registeredMethods('/'), ['get', 'post']);
  assert.deepEqual(registeredMethods('/stats'), ['get']);
  assert.deepEqual(registeredMethods('/:id'), ['get', 'put', 'delete']);
});

test('assetHandoverService creates, retrieves, updates, lists, and deletes handovers in DB', async () => {
  // 1. Create Handover
  const created = await createHandover(
    db,
    {
      handoverDate: '2026-11-04',
      recipientName: 'Test Penerima Handover',
      recipientAddress: 'Jl. Testing No. 123',
      recipientPosition: 'Staff IT',
      recipientPhone: '081299998888',
      itemTypes: ['laptop', 'mouse'],
      givenByName: 'Budi Test Giver',
      givenByTitle: 'IT Lead',
      receivedByName: 'Test Penerima Handover',
      notes: 'Testing handover service flow',
      status: 'COMPLETED',
      items: [
        {
          itemOrder: 1,
          itemName: 'ThinkPad T14 Testing Unit',
          description: 'S/N: TP-TEST-001, 16GB RAM',
        },
        {
          itemOrder: 2,
          itemName: 'Mouse Logitech Silent',
          description: 'M331 Black',
        },
      ],
    },
    null
  );

  assert.ok(created.id, 'Handover must have generated ID');
  assert.match(created.handoverNumber, /^TTB-202611-\d{4}$/);
  assert.equal(created.recipientName, 'Test Penerima Handover');
  assert.equal(created.items.length, 2);

  // 2. Get by ID
  const retrieved = await getHandoverById(db, created.id);
  assert.equal(retrieved.id, created.id);
  assert.equal(retrieved.recipientName, 'Test Penerima Handover');
  assert.equal(retrieved.items.length, 2);
  assert.equal(retrieved.items[0].itemName, 'ThinkPad T14 Testing Unit');

  // 3. List & Filter
  const list = await listHandovers(db, { search: 'Test Penerima', page: 1, limit: 10 });
  assert.ok(list.data.length >= 1);
  assert.ok(list.data.some((d) => d.id === created.id));

  // 4. Stats
  const stats = await getHandoverStats(db);
  assert.ok(stats.total >= 1);
  assert.ok(stats.withLaptopsOrPc >= 1);

  // 5. Update Handover
  const updated = await updateHandover(
    db,
    created.id,
    {
      handoverDate: '2026-11-04',
      recipientName: 'Test Penerima Updated',
      recipientAddress: 'Jl. Testing No. 123 Updated',
      recipientPosition: 'Staff IT Senior',
      recipientPhone: '081299998888',
      itemTypes: ['laptop'],
      givenByName: 'Budi Test Giver',
      givenByTitle: 'IT Manager',
      receivedByName: 'Test Penerima Updated',
      status: 'COMPLETED',
      items: [
        {
          itemOrder: 1,
          itemName: 'ThinkPad T14 Testing Unit (Replaced)',
          description: 'S/N: TP-TEST-002, 32GB RAM',
        },
      ],
    },
    null
  );

  assert.equal(updated.recipientName, 'Test Penerima Updated');
  assert.equal(updated.items.length, 1);
  assert.equal(updated.items[0].itemName, 'ThinkPad T14 Testing Unit (Replaced)');

  // 6. Delete Handover
  const deleteResult = await deleteHandover(db, created.id, null);
  assert.equal(deleteResult.success, true);

  // Verify it no longer exists
  await assert.rejects(
    async () => {
      await getHandoverById(db, created.id);
    },
    (err: any) => err.statusCode === 404
  );
});
