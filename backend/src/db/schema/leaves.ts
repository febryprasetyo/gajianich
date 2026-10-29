import { pgTable, bigint, varchar, text, date, integer, timestamp, boolean, uniqueIndex, foreignKey, jsonb } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';
import {organizationGroups, organizations} from './organizations';
import type {DocumentProfileSnapshot} from '../../services/documentProfile';

// 0. Konfigurasi Master Cuti Tahunan & Cuti Bersama
export const annualLeaveConfigs = pgTable('annual_leave_configs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  year: integer('year').notNull().unique(), // Satu konfigurasi per tahun kalender
  baseQuota: integer('base_quota').default(12).notNull(), // Kuota hak cuti dasar default (12 hari)
  collectiveLeaveDays: integer('collective_leave_days').default(0).notNull(), // Total hari cuti bersama tahunan
  allowCarryForward: boolean('allow_carry_forward').default(false).notNull(), // Izinkan pengalihan sisa cuti tahun lalu
  maxCarryForwardDays: integer('max_carry_forward_days').default(0).notNull(), // Maksimal hari yang dialihkan
  notes: text('notes'), // Catatan kebijakan / SKB 3 Menteri
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 1. Kalender Cuti Bersama & Libur Perusahaan per Tahun
export const leaveHolidayCalendars = pgTable('leave_holiday_calendars', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  year: integer('year').notNull(),
  holidayDate: date('holiday_date').notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  isCollectiveLeave: boolean('is_collective_leave').default(true).notNull(), // Cuti Bersama pemerintah yang memotong kuota
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Saldo Cuti Karyawan per Tahun
export const leaveBalances = pgTable('leave_balances', {
  groupId: bigint('group_id', {mode:'number'}).references(() => organizationGroups.id,{onDelete:'restrict'}),
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  baseQuota: integer('base_quota').default(12).notNull(), // Hak cuti dasar tahunan (default 12)
  collectiveLeaveDeduction: integer('collective_leave_deduction').default(0).notNull(), // Jumlah cuti bersama tahun berjalan
  usedQuota: integer('used_quota').default(0).notNull(), // Cuti tahunan yang telah disetujui & diambil
  carriedOverQuota: integer('carried_over_quota').default(0).notNull(), // Kuota sisa tahun lalu (jika ada)
  isCustomQuota: boolean('is_custom_quota').default(false).notNull(), // Proteksi override manual kuota dasar
  isCustomCarryForward: boolean('is_custom_carry_forward').default(false).notNull(), // Proteksi override manual carry-over
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('leave_balances_employee_year_unique').on(table.employeeId, table.year),
]);

// 3. Permohonan Cuti Karyawan
export const leaveRequests = pgTable('leave_requests', {
  groupId: bigint('group_id', {mode:'number'}).references(() => organizationGroups.id,{onDelete:'restrict'}),
  organizationId: bigint('organization_id', {mode:'number'}).references(() => organizations.id,{onDelete:'restrict'}),
  documentProfileSnapshot: jsonb('document_profile_snapshot').$type<DocumentProfileSnapshot>(),
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  requestNumber: varchar('request_number', { length: 50 }).notNull().unique(), // Format: LV-YYYYMM-XXXX
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employees.id, { onDelete: 'restrict' }),
  leaveType: varchar('leave_type', { length: 30 }).notNull(), // 'ANNUAL' | 'SPECIAL'
  specialLeaveReason: varchar('special_leave_reason', { length: 100 }), // 'Menikah' | 'Melahirkan' | 'Kematian' | 'Lain-lain'
  reason: text('reason').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  durationDays: integer('duration_days').notNull(), // Jumlah hari kerja efektif
  resumeWorkDate: date('resume_work_date').notNull(), // Kembali Bekerja Tgl
  
  // Serah Terima Tugas (Handover)
  handoverToEmployeeId: bigint('handover_to_employee_id', { mode: 'number' }).references(() => employees.id),
  handoverTask: text('handover_task'),
  emergencyPhone: varchar('emergency_phone', { length: 50 }),
  
  // Status & Catatan HRD
  hrdNotes: text('hrd_notes'),
  status: varchar('status', { length: 30 }).default('PENDING').notNull(), // 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  
  // Snapshot Saldo saat Pengajuan (untuk arsip & cetak form F4)
  balanceYear: integer('balance_year').notNull(),
  snapshotBaseQuota: integer('snapshot_base_quota').notNull(),
  snapshotCollectiveLeave: integer('snapshot_collective_leave').notNull(),
  snapshotAvailableBefore: integer('snapshot_available_before').notNull(),
  snapshotRemainingAfter: integer('snapshot_remaining_after').notNull(),

  createdById: bigint('created_by_id', { mode: 'number' }).references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({name:'leaveRequests_organization_group_fk',columns:[table.organizationId,table.groupId],foreignColumns:[organizations.id,organizations.groupId]}).onDelete('restrict'),
]);

// 4. Persetujuan Bertingkat (4 Kolom Sesuai Form Cetak F4)
export const leaveApprovals = pgTable('leave_approvals', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  leaveRequestId: bigint('leave_request_id', { mode: 'number' }).notNull().references(() => leaveRequests.id, { onDelete: 'cascade' }),
  stage: varchar('stage', { length: 30 }).notNull(), // 'APPLICANT' | 'DIRECT_SUPERVISOR' | 'HRD' | 'HIGHER_SUPERVISOR'
  approverEmployeeId: bigint('approver_employee_id', { mode: 'number' }).references(() => employees.id),
  approverName: varchar('approver_name', { length: 150 }),
  status: varchar('status', { length: 30 }).default('PENDING').notNull(), // 'PENDING' | 'APPROVED' | 'REJECTED'
  signatureDate: date('signature_date'),
  notes: text('notes'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
