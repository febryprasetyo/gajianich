import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDaysRemaining,
  formatRupiah,
  calculateSubscriptionStats,
  filterSubscriptions,
} from './subscriptions.ts';

test('getDaysRemaining calculates days difference accurately', () => {
  const baseDate = new Date('2026-11-06T00:00:00Z');

  // Same day
  assert.equal(getDaysRemaining('2026-11-06', baseDate), 0);

  // Future date (10 days ahead)
  assert.equal(getDaysRemaining('2026-11-16', baseDate), 10);

  // Past date (5 days ago)
  assert.equal(getDaysRemaining('2026-11-01', baseDate), -5);
});

test('formatRupiah formats numeric and string values into IDR format', () => {
  assert.equal(formatRupiah(250000), 'Rp\u00a0250.000');
  assert.equal(formatRupiah('1500000'), 'Rp\u00a01.500.000');
  assert.equal(formatRupiah(0), 'Rp\u00a00');
});

test('calculateSubscriptionStats categorizes expired, expiring soon, and safe items', () => {
  const baseDate = new Date('2026-11-06T00:00:00Z');

  const items = [
    { id: 1, name: 'Expired Dom', category: 'DOMAIN', provider: 'PANDI', expiryDate: '2026-10-15', renewalCost: 100000, billingCycle: 'Tahunan', autoRenew: false }, // -22 days -> expired
    { id: 2, name: 'Expiring Hosting', category: 'HOSTING', provider: 'Host', expiryDate: '2026-11-20', renewalCost: 500000, billingCycle: 'Bulanan', autoRenew: true }, // 14 days -> expiring soon
    { id: 3, name: 'Safe SSL', category: 'SSL', provider: 'Sectigo', expiryDate: '2027-05-01', renewalCost: 300000, billingCycle: 'Tahunan', autoRenew: false }, // ~176 days -> safe
  ];

  const stats = calculateSubscriptionStats(items, baseDate);
  assert.equal(stats.total, 3);
  assert.equal(stats.expired, 1);
  assert.equal(stats.expiringSoon, 1);
  assert.equal(stats.safe, 1);
});

test('filterSubscriptions filters by search query without PIC field', () => {
  const items = [
    { id: 1, name: 'Perusahaan Web Domain', category: 'DOMAIN', provider: 'Niagahoster', registeredDomain: 'gajianich.id', expiryDate: '2027-01-01', renewalCost: 200000, billingCycle: 'Tahunan', autoRenew: true },
    { id: 2, name: 'Corporate Email', category: 'EMAIL', provider: 'Google Cloud', registeredDomain: 'gajianich.id', expiryDate: '2026-11-10', renewalCost: 5000000, billingCycle: 'Tahunan', autoRenew: false },
    { id: 3, name: 'Cloud Hosting VPS', category: 'HOSTING', provider: 'IdCloudHost', registeredDomain: null, expiryDate: '2027-06-01', renewalCost: 1200000, billingCycle: 'Tahunan', autoRenew: false },
  ];

  // Search by provider
  const byProvider = filterSubscriptions(items, 'Google', 'ALL', 'ALL');
  assert.equal(byProvider.length, 1);
  assert.equal(byProvider[0].id, 2);

  // Search by domain
  const byDomain = filterSubscriptions(items, 'gajianich.id', 'ALL', 'ALL');
  assert.equal(byDomain.length, 2);

  // Filter by category
  const hostingOnly = filterSubscriptions(items, '', 'HOSTING', 'ALL');
  assert.equal(hostingOnly.length, 1);
  assert.equal(hostingOnly[0].id, 3);
});
