import {organizationGroups} from './organizations';
import {
  pgTable,
  bigint,
  varchar,
  integer,
  timestamp,
  boolean,
  text,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';

export const attendanceSelfLogs = pgTable(
  'attendance_self_logs',
  {
    groupId: bigint('group_id', {mode:'number'}).references(() => organizationGroups.id,{onDelete:'restrict'}),
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    employeeId: bigint('employee_id', { mode: 'number' })
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    userId: bigint('user_id', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
    }),
    eventType: varchar('event_type', { length: 10 }).notNull(), // 'IN' | 'OUT'
    workDate: varchar('work_date', { length: 10 }).notNull(), // 'YYYY-MM-DD'
    scanTime: varchar('scan_time', { length: 10 }).notNull(), // 'HH:mm:ss'
    shiftCode: varchar('shift_code', { length: 50 }).notNull(), // 'OFFICE' | 'PROD_6D'
    shiftCategory: varchar('shift_category', { length: 20 }).notNull(), // 'OFFICE' | 'PRODUCTION'
    timeZone: varchar('time_zone', { length: 50 }).default('Asia/Jakarta').notNull(),
    scanDate: varchar('scan_date', { length: 10 }),
    scheduleIn: varchar('schedule_in', { length: 10 }),
    scheduleOut: varchar('schedule_out', { length: 10 }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    reviewHistory: jsonb('review_history').$type<{ status: string; note: string; actorId: number; at: string }[]>().default([]).notNull(),

    // OpenStreetMap Coordinates & Location Verification for HRD
    latitude: varchar('latitude', { length: 30 }),
    longitude: varchar('longitude', { length: 30 }),
    accuracy: integer('accuracy'), // meters
    address: text('address'),
    mapUrl: text('map_url'),
    googleMapsUrl: text('google_maps_url'),
    isWithinGeofence: boolean('is_within_geofence').default(true).notNull(),
    distanceMeters: integer('distance_meters'),

    // Selfie Photo Storage & 7-Day Retention
    photoUrl: text('photo_url'),
    photoPurgedAt: timestamp('photo_purged_at'),

    // Transaction Ref & Device Audit
    txHash: varchar('tx_hash', { length: 100 }).notNull().unique(),
    deviceInfo: text('device_info'),
    notes: text('notes'),

    // HRD Shift-Based Verification
    requiresVerification: boolean('requires_verification').default(true).notNull(),
    approvalStatus: varchar('approval_status', { length: 20 }).default('PENDING').notNull(), // 'PENDING' | 'APPROVED' | 'REJECTED'
    approvalNote: text('approval_note'),
    verifiedById: bigint('verified_by_id', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
    }),
    verifiedAt: timestamp('verified_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_attendance_self_logs_employee_date').on(table.employeeId, table.workDate),
    index('idx_attendance_self_logs_approval_status').on(table.approvalStatus),
  ]
);
