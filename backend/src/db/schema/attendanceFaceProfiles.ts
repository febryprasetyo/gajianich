import {
  pgTable,
  bigint,
  varchar,
  timestamp,
  boolean,
  text,
} from 'drizzle-orm/pg-core';
import { employees } from './employees';

export const attendanceFaceProfiles = pgTable(
  'attendance_face_profiles',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    employeeId: bigint('employee_id', { mode: 'number' })
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' })
      .unique(),
    isEnrolled: boolean('is_enrolled').default(true).notNull(),
    faceDescriptorHash: text('face_descriptor_hash'),
    descriptorVersion: varchar('descriptor_version', { length: 50 }),
    samplePhotoUrl: text('sample_photo_url'),
    enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);
