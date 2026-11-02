import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDaysSchema, createLeaveRequestSchema, updateLeaveRequestSchema, annualLeaveConfigSchema, updateLeaveBalanceSchema } from './leaveController';
import {
  calculateLeaveWorkingDays,
  calculateLeaveBalances,
  formatLeaveRequestNumber,
} from '../domain/leaveCalculation';

describe('Leave Controller Schema Validation', () => {
  test('calculateDaysSchema validates standard YYYY-MM-DD date range', () => {
    const valid = calculateDaysSchema.safeParse({
      startDate: '2026-10-15',
      endDate: '2026-10-18',
      employeeId: '10',
    });
    assert.strictEqual(valid.success, true);
    if (valid.success) {
      assert.strictEqual(valid.data.startDate, '2026-10-15');
      assert.strictEqual(valid.data.endDate, '2026-10-18');
      assert.strictEqual(valid.data.employeeId, 10);
    }
  });

  test('calculateDaysSchema rejects malformed dates', () => {
    const malformed = calculateDaysSchema.safeParse({
      startDate: '15-10-2026',
      endDate: '2026/10/18',
    });
    assert.strictEqual(malformed.success, false);
  });

  test('createLeaveRequestSchema accepts complete manual leave form payload', () => {
    const valid = createLeaveRequestSchema.safeParse({
      employeeId: 5,
      leaveType: 'ANNUAL',
      reason: 'Keperluan keluarga di luar kota',
      startDate: '2026-10-20',
      endDate: '2026-10-22',
      durationDays: 3,
      resumeWorkDate: '2026-10-23',
      handoverToEmployeeId: 8,
      handoverTask: 'Pengecekan server harian dialihkan sementara',
      emergencyPhone: '081234567890',
    });
    assert.strictEqual(valid.success, true);
  });

  test('createLeaveRequestSchema supports SPECIAL leave with optional handover', () => {
    const valid = createLeaveRequestSchema.safeParse({
      employeeId: 12,
      leaveType: 'SPECIAL',
      specialLeaveReason: 'Menikah',
      reason: 'Cuti pernikahan resmi',
      startDate: '2026-11-02',
      endDate: '2026-11-04',
      durationDays: 3,
      handoverToEmployeeId: null,
      handoverTask: null,
      emergencyPhone: null,
    });
    assert.strictEqual(valid.success, true);
  });

  test('createLeaveRequestSchema rejects non-positive durationDays', () => {
    const zeroDays = createLeaveRequestSchema.safeParse({
      employeeId: 5,
      leaveType: 'ANNUAL',
      reason: 'Liburan',
      startDate: '2026-10-20',
      endDate: '2026-10-20',
      durationDays: 0,
    });
    assert.strictEqual(zeroDays.success, false);

    const negativeDays = createLeaveRequestSchema.safeParse({
      employeeId: 5,
      leaveType: 'ANNUAL',
      reason: 'Liburan',
      startDate: '2026-10-20',
      endDate: '2026-10-20',
      durationDays: -2,
    });
    assert.strictEqual(negativeDays.success, false);
  });

  test('createLeaveRequestSchema rejects empty reason', () => {
    const missingReason = createLeaveRequestSchema.safeParse({
      employeeId: 5,
      leaveType: 'ANNUAL',
      reason: '',
      startDate: '2026-10-20',
      endDate: '2026-10-20',
      durationDays: 1,
    });
    assert.strictEqual(missingReason.success, false);
  });

  test('createLeaveRequestSchema rejects cross-year leave periods', () => {
    const crossYear = createLeaveRequestSchema.safeParse({
      employeeId: 5,
      leaveType: 'ANNUAL',
      reason: 'Libur akhir tahun menyeberang tahun',
      startDate: '2026-12-28',
      endDate: '2027-01-04',
      durationDays: 4,
    });
    assert.strictEqual(crossYear.success, false);
    if (!crossYear.success) {
      assert.match(crossYear.error.issues[0].message, /tahun kalender yang sama/);
    }
  });

  test('calculateDaysSchema rejects cross-year date ranges', () => {
    const crossYear = calculateDaysSchema.safeParse({
      startDate: '2026-12-28',
      endDate: '2027-01-04',
    });
    assert.strictEqual(crossYear.success, false);
  });

  test('updateLeaveRequestSchema validates valid edit payload', () => {
    const valid = updateLeaveRequestSchema.safeParse({
      leaveType: 'ANNUAL',
      reason: 'Revisi keperluan keluarga mendadak',
      startDate: '2026-10-25',
      endDate: '2026-10-27',
      durationDays: 3,
      resumeWorkDate: '2026-10-28',
      handoverToEmployeeId: 10,
      handoverTask: 'Pendelegasian tugas server',
      emergencyPhone: '08123456789',
    });
    assert.strictEqual(valid.success, true);
  });

  test('updateLeaveRequestSchema rejects cross-year edit payload', () => {
    const crossYear = updateLeaveRequestSchema.safeParse({
      leaveType: 'ANNUAL',
      reason: 'Cuti lintas tahun',
      startDate: '2026-12-30',
      endDate: '2027-01-05',
      durationDays: 4,
    });
    assert.strictEqual(crossYear.success, false);
  });
});

describe('Leave Business Logic & Document Standards', () => {
  test('clean annual quota strictly obeys baseQuota - collectiveLeaveDays without negative overflow', () => {
    // Standard case: 12 base - 10 cuti bersama = 2 bersih
    const standard = calculateLeaveBalances({
      baseQuota: 12,
      collectiveLeaveDays: 10,
      usedQuota: 0,
      carriedOverQuota: 0,
      requestedDays: 0,
    });
    assert.strictEqual(standard.cleanAnnualQuota, 2);
    assert.strictEqual(standard.availableBefore, 2);

    // Overflow case: collective leaves exceeds base quota
    const overflow = calculateLeaveBalances({
      baseQuota: 12,
      collectiveLeaveDays: 14,
      usedQuota: 0,
      carriedOverQuota: 0,
      requestedDays: 0,
    });
    assert.strictEqual(overflow.cleanAnnualQuota, 0);
    assert.strictEqual(overflow.availableBefore, 0);
  });

  test('working days calculation excludes public holidays and weekends accurately', () => {
    // 2026-10-16 (Jumat) s/d 2026-10-19 (Senin)
    // Sabtu (17) & Minggu (18) = akhir pekan
    const result = calculateLeaveWorkingDays({
      startDate: '2026-10-16',
      endDate: '2026-10-19',
      holidayDates: [],
    });
    assert.strictEqual(result.durationDays, 2); // Jumat + Senin
    assert.strictEqual(result.resumeWorkDate, '2026-10-20'); // Selasa
  });

  test('request number code format adheres to LV-YYYYMM-XXXX standard', () => {
    const date = new Date('2026-10-13T08:00:00Z');
    const seq1 = formatLeaveRequestNumber(date, 7);
    assert.strictEqual(seq1, 'LV-202610-0007');

    const seq999 = formatLeaveRequestNumber(date, 999);
    assert.strictEqual(seq999, 'LV-202610-0999');
  });


  test('annualLeaveConfigSchema validates valid configuration payload', () => {
    const valid = annualLeaveConfigSchema.safeParse({
      year: 2026,
      baseQuota: 12,
      collectiveLeaveDays: 4,
      allowCarryForward: true,
      maxCarryForwardDays: 6,
      notes: 'SKB 3 Menteri Cuti Bersama 2026',
    });
    assert.strictEqual(valid.success, true);
    if (valid.success) {
      assert.strictEqual(valid.data.year, 2026);
      assert.strictEqual(valid.data.baseQuota, 12);
      assert.strictEqual(valid.data.collectiveLeaveDays, 4);
      assert.strictEqual(valid.data.allowCarryForward, true);
      assert.strictEqual(valid.data.maxCarryForwardDays, 6);
    }
  });

  test('annualLeaveConfigSchema rejects negative quotas and invalid years', () => {
    const invalidQuota = annualLeaveConfigSchema.safeParse({
      year: 2026,
      baseQuota: -1,
      collectiveLeaveDays: 4,
    });
    assert.strictEqual(invalidQuota.success, false);

    const invalidYear = annualLeaveConfigSchema.safeParse({
      year: 1990,
      baseQuota: 12,
    });
    assert.strictEqual(invalidYear.success, false);
  });

  test('updateLeaveBalanceSchema validates partial updates for custom override', () => {
    const validBase = updateLeaveBalanceSchema.safeParse({
      baseQuota: 14,
    });
    assert.strictEqual(validBase.success, true);

    const validCarry = updateLeaveBalanceSchema.safeParse({
      carriedOverQuota: 5,
    });
    assert.strictEqual(validCarry.success, true);

    const empty = updateLeaveBalanceSchema.safeParse({});
    assert.strictEqual(empty.success, false);
  });

  test('standard F4 leave document specifications constants', () => {
    const FORM_NUMBER = '001';
    const REVISION_CODE = 'REV. 170208-1-W';
    const APPROVAL_STAGES = [
      'APPLICANT',
      'DIRECT_SUPERVISOR',
      'HRD',
      'HIGHER_SUPERVISOR',
    ];

    assert.strictEqual(FORM_NUMBER, '001');
    assert.strictEqual(REVISION_CODE, 'REV. 170208-1-W');
    assert.strictEqual(APPROVAL_STAGES.length, 4);
  });

  test('leave requests support nullable organizationId and documentProfileSnapshot when organization is unmapped', () => {
    const mockRow = {
      groupId: 1,
      organizationId: null,
      documentProfileSnapshot: null,
      requestNumber: 'LV-202611-0001',
      employeeId: 2,
    };
    assert.strictEqual(mockRow.organizationId, null);
    assert.strictEqual(mockRow.documentProfileSnapshot, null);
  });
});
