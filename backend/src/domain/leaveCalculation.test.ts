import { test } from 'node:test';
import assert from 'node:assert';
import {
  calculateLeaveWorkingDays,
  calculateLeaveBalances,
  calculateRolloverCarryForward,
  formatLeaveRequestNumber,
} from './leaveCalculation';

test('calculateLeaveWorkingDays correctly excludes weekends and collective leave holidays', () => {
  const holidays = ['2024-05-01'];
  const result = calculateLeaveWorkingDays({
    startDate: '2024-05-10',
    endDate: '2024-05-11',
    holidayDates: holidays,
  });

  assert.strictEqual(result.durationDays, 1);
  assert.strictEqual(result.resumeWorkDate, '2024-05-13');
  assert.strictEqual(result.isValid, true);
});

test('calculateLeaveWorkingDays handles mid-week collective holidays and finds next working day', () => {
  const holidays = ['2024-04-10', '2024-04-11'];
  const result = calculateLeaveWorkingDays({
    startDate: '2024-04-08',
    endDate: '2024-04-12',
    holidayDates: holidays,
  });

  assert.strictEqual(result.durationDays, 3);
  assert.strictEqual(result.resumeWorkDate, '2024-04-15');
});

test('calculateLeaveBalances correctly calculates clean annual quota, total entitlement, and remaining balance', () => {
  const balance = calculateLeaveBalances({
    baseQuota: 12,
    collectiveLeaveDays: 4,
    usedQuota: 3,
    carriedOverQuota: 2,
    requestedDays: 1,
  });

  // cleanAnnualQuota = 12 - 4 = 8
  // totalEntitlement = 8 + 2 = 10
  // availableBefore = 10 - 3 = 7
  // remainingAfter = 7 - 1 = 6
  assert.strictEqual(balance.cleanAnnualQuota, 8);
  assert.strictEqual(balance.totalEntitlement, 10);
  assert.strictEqual(balance.availableBefore, 7);
  assert.strictEqual(balance.remainingAfter, 6);
  assert.strictEqual(balance.hasSufficientBalance, true);
});

test('calculateLeaveBalances flags insufficient balance when requested days exceed available quota', () => {
  const balance = calculateLeaveBalances({
    baseQuota: 12,
    collectiveLeaveDays: 10,
    usedQuota: 2,
    carriedOverQuota: 0,
    requestedDays: 1,
  });

  assert.strictEqual(balance.cleanAnnualQuota, 2);
  assert.strictEqual(balance.totalEntitlement, 2);
  assert.strictEqual(balance.availableBefore, 0);
  assert.strictEqual(balance.remainingAfter, 0);
  assert.strictEqual(balance.hasSufficientBalance, false);
});

test('calculateRolloverCarryForward calculates auto-rollover capped at maxCarryForwardDays', () => {
  // Sisa tahun lalu = 12 (base) + 2 (carry) - 4 (collective) - 2 (used) = 8 hari
  // maxCarryForwardDays = 6
  // Hasil = 6 hari (capped)
  const carry = calculateRolloverCarryForward({
    prevBaseQuota: 12,
    prevCollectiveLeave: 4,
    prevCarriedOver: 2,
    prevUsedQuota: 2,
    maxCarryForwardDays: 6,
    isCarryForwardEnabled: true,
  });

  assert.strictEqual(carry, 6);
});

test('calculateRolloverCarryForward takes actual remaining when under max cap', () => {
  // Sisa tahun lalu = 12 (base) + 0 (carry) - 5 (collective) - 4 (used) = 3 hari
  // maxCarryForwardDays = 6
  // Hasil = 3 hari
  const carry = calculateRolloverCarryForward({
    prevBaseQuota: 12,
    prevCollectiveLeave: 5,
    prevCarriedOver: 0,
    prevUsedQuota: 4,
    maxCarryForwardDays: 6,
    isCarryForwardEnabled: true,
  });

  assert.strictEqual(carry, 3);
});

test('calculateRolloverCarryForward returns 0 when feature is disabled', () => {
  const carry = calculateRolloverCarryForward({
    prevBaseQuota: 12,
    prevCollectiveLeave: 4,
    prevCarriedOver: 0,
    prevUsedQuota: 2,
    maxCarryForwardDays: 6,
    isCarryForwardEnabled: false,
  });

  assert.strictEqual(carry, 0);
});

test('calculateRolloverCarryForward returns 0 when previous balance is 0 or negative', () => {
  const carry = calculateRolloverCarryForward({
    prevBaseQuota: 12,
    prevCollectiveLeave: 4,
    prevCarriedOver: 0,
    prevUsedQuota: 8,
    maxCarryForwardDays: 6,
    isCarryForwardEnabled: true,
  });

  assert.strictEqual(carry, 0);
});

test('calculateRolloverCarryForward accumulates unlimited remaining days when isUnlimited is true', () => {
  // Sisa tahun lalu = 12 (base) + 10 (carry over dari 2 tahun lalu) - 2 (collective) - 4 (used) = 16 hari
  const carry = calculateRolloverCarryForward({
    prevBaseQuota: 12,
    prevCollectiveLeave: 2,
    prevCarriedOver: 10,
    prevUsedQuota: 4,
    isCarryForwardEnabled: true,
    isUnlimited: true,
  });

  // Karena unlimited, harus utuh 16 hari tanpa pemotongan cap
  assert.strictEqual(carry, 16);
});

test('calculateRolloverCarryForward resets to 0 when department is not enabled for carry forward', () => {
  const carry = calculateRolloverCarryForward({
    prevBaseQuota: 12,
    prevCollectiveLeave: 2,
    prevCarriedOver: 10,
    prevUsedQuota: 4,
    isCarryForwardEnabled: false,
    isUnlimited: false,
  });

  assert.strictEqual(carry, 0);
});

test('formatLeaveRequestNumber formats sequence into LV-YYYYMM-XXXX', () => {
  const code = formatLeaveRequestNumber(new Date('2024-05-10'), 1);
  assert.strictEqual(code, 'LV-202405-0001');

  const code2 = formatLeaveRequestNumber(new Date('2026-10-09'), 42);
  assert.strictEqual(code2, 'LV-202610-0042');
});
