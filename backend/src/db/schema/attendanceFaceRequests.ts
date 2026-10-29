import {organizationGroups} from './organizations';
import { pgTable, bigint, text, varchar, timestamp } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';
export const attendanceFaceRequests = pgTable('attendance_face_requests', {
  groupId: bigint('group_id', {mode:'number'}).references(() => organizationGroups.id,{onDelete:'restrict'}),
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  descriptor: text('descriptor').notNull(),
  photoUrl: text('photo_url').notNull(),
  oldPhotoUrl: text('old_photo_url'),
  status: varchar('status', { length: 20 }).default('PENDING').notNull(),
  note: text('note'),
  verifiedById: bigint('verified_by_id', { mode: 'number' }).references(() => users.id),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
