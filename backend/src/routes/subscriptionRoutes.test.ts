import assert from 'node:assert/strict';
import test from 'node:test';
import router from './infrastructureRoutes';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
} from '../controllers/subscriptionController';

function registeredMethods(path: string): string[] {
  const stack = (router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack;
  return stack
    .filter((item) => item.route?.path === path)
    .flatMap((item) => Object.keys(item.route!.methods).filter((method) => item.route!.methods[method]));
}

test('subscription routes expose complete CRUD endpoints under /subscriptions', () => {
  assert.deepEqual(registeredMethods('/subscriptions'), ['get', 'post']);
  assert.deepEqual(registeredMethods('/subscriptions/:id'), ['put', 'delete']);
});

test('createSubscriptionSchema validates required fields and valid categories', () => {
  const valid = createSubscriptionSchema.safeParse({
    name: 'Google Workspace Enterprise',
    category: 'EMAIL',
    provider: 'Google Cloud',
    registeredDomain: 'gajianich.co.id',
    startDate: '2026-01-01',
    expiryDate: '2027-01-01',
    renewalCost: 15000000,
    billingCycle: 'Tahunan',
    autoRenew: true,
    loginUrl: 'https://admin.google.com',
    notes: 'Akun email perusahaan',
  });

  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.name, 'Google Workspace Enterprise');
    assert.equal(valid.data.category, 'EMAIL');
    assert.equal(valid.data.renewalCost, 15000000);
    assert.equal(valid.data.billingCycle, 'Tahunan');
  }
});

test('createSubscriptionSchema rejects invalid categories and malformed dates', () => {
  const invalidCategory = createSubscriptionSchema.safeParse({
    name: 'Test Service',
    category: 'INVALID_CAT',
    provider: 'Provider X',
    expiryDate: '2027-01-01',
  });
  assert.equal(invalidCategory.success, false);

  const invalidDateFormat = createSubscriptionSchema.safeParse({
    name: 'Test Service',
    category: 'DOMAIN',
    provider: 'Provider X',
    expiryDate: '01-01-2027', // wrong format
  });
  assert.equal(invalidDateFormat.success, false);
});

test('updateSubscriptionSchema supports partial updates', () => {
  const partial = updateSubscriptionSchema.safeParse({
    renewalCost: 350000,
    autoRenew: false,
  });

  assert.equal(partial.success, true);
  if (partial.success) {
    assert.equal(partial.data.renewalCost, 350000);
    assert.equal(partial.data.autoRenew, false);
    assert.equal(partial.data.name, undefined);
  }
});
