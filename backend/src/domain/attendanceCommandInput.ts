import { z } from "zod";
import type { ServerAttendanceCommand } from "./attendanceCommands";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const attendanceStatusSchema = z.enum([
  "PRESENT",
  "IZIN",
  "SAKIT",
  "CUTI",
  "ALPHA",
  "UNSPECIFIED",
  "LATE",
  "EARLY_LEAVE",
]);

const manualAttendanceStatusSchema = z.enum([...attendanceStatusSchema.options, "DINAS_LUAR"]);

export const reviewStatusSchema = z.enum([
  "READY",
  "NEEDS_REVIEW",
  "BLOCKED",
  "SKIPPED",
]);

const timeFormatSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (val === null || val === undefined) return null;
    const trimmed = val.trim();
    if (trimmed === "" || trimmed === "-") return null;
    if (/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(trimmed)) {
      return trimmed.slice(0, 5);
    }
    return trimmed;
  })
  .refine(
    (val) => val === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(val),
    { message: "Jam harus dalam format HH:mm atau HH:mm:ss" }
  );

const reasonSchema = z
  .string()
  .optional()
  .transform((val) => {
    const trimmed = (val || "").trim();
    return trimmed.length > 0 ? trimmed : "Koreksi absensi";
  })
  .pipe(z.string().min(1).max(255));

const correctCommandSchema = z.object({
  type: z.literal("correct"),
  recordId: z.coerce.number().int().positive(),
  expectedRevision: z.coerce.number().int().nonnegative().optional().default(1),
  values: z.object({
    scanIn: timeFormatSchema,
    scanOut: timeFormatSchema,
    lateMinutes: z.coerce.number().int().nonnegative().optional().default(0),
    overtimeMinutes: z.coerce.number().int().nonnegative().optional().default(0),
    attendanceStatus: manualAttendanceStatusSchema,
    isDayOff: z.boolean().optional(),
  }),
  reason: reasonSchema,
});

const identityCommandSchema = z.object({
  type: z.literal("identity"),
  value: z.object({
    id: z.number().int().nonnegative().optional().default(0),
    sourceId: z.number().int().positive(),
    externalNoId: z.string().min(1).max(100),
    employeeId: z.number().int().positive(),
  }),
});

const deleteIdentityCommandSchema = z.object({
  type: z.literal("delete_identity"),
  id: z.number().int().positive(),
});

const lockCommandSchema = z.object({
  type: z.literal("lock"),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  locked: z.boolean(),
  reason: z.string().min(1).max(255),
});

const importRowSchema = z.object({
  id: z.number().int().optional().default(0),
  externalNoId: z.string().min(1).max(100),
  employeeId: z.number().int().positive().nullable().optional(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scanIn: z.string().nullable().optional(),
  scanOut: z.string().nullable().optional(),
  rawScanIn: z.string().nullable().optional(),
  rawScanOut: z.string().nullable().optional(),
  lateMinutes: z.number().int().nonnegative().optional().default(0),
  earlyMinutes: z.number().int().nonnegative().optional().default(0),
  overtimeMinutes: z.number().int().nonnegative().optional().default(0),
  reviewStatus: reviewStatusSchema.optional().default("NEEDS_REVIEW"),
  note: z.string().optional().default(""),
  attendanceStatus: attendanceStatusSchema.optional(),
  normalized: z.boolean().optional().default(false),
  issues: z.array(z.string()).optional(),
});

const importCommandSchema = z.object({
  type: z.literal("import"),
  filename: z.string().min(1).max(255),
  sourceId: z.number().int().positive().optional(),
  fileHash: z.string().max(64).optional(),
  rows: z.array(importRowSchema),
});

const reviewCommandSchema = z.object({
  type: z.literal("review"),
  batchId: z.number().int().positive(),
  rowId: z.number().int().positive(),
  employeeId: z.number().int().positive().nullable().optional(),
  attendanceStatus: attendanceStatusSchema.optional(),
  skipped: z.boolean(),
  reason: z.string().max(255),
  values: z
    .object({
      scanIn: z.string().nullable().optional(),
      scanOut: z.string().nullable().optional(),
      lateMinutes: z.number().int().nonnegative().optional(),
      overtimeMinutes: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

const batchCommandSchema = z.object({
  type: z.literal("batch"),
  batchId: z.number().int().positive(),
  action: z.enum(["commit", "cancel", "reopen", "delete"]),
  strictIntegrity: z.boolean().optional(),
});

const deleteBatchCommandSchema = z.object({
  type: z.literal("delete_batch"),
  batchId: z.number().int().positive(),
});

const toggleStrictIntegrityCommandSchema = z.object({
  type: z.literal("toggle_strict_integrity"),
  batchId: z.number().int().positive(),
  enabled: z.boolean(),
});

const setStrictIntegrityCommandSchema = z.object({
  type: z.literal("set_strict_integrity"),
  enabled: z.boolean(),
});

const recordAttendanceCommandSchema = z.object({
  type: z.literal("record_attendance"),
  employeeId: z.coerce.number().int().positive(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  attendanceStatus: manualAttendanceStatusSchema,
  shiftId: z.coerce.number().int().positive().optional(),
  isDayOff: z.boolean().optional(),
  scanIn: timeFormatSchema,
  scanOut: timeFormatSchema,
  reason: reasonSchema,
});

const shiftCommandSchema = z.object({
  type: z.literal("shift"),
  action: z.enum(["create", "update", "delete"]),
  shift: z.object({
    id: z.number().int().nonnegative().optional().default(0),
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(150),
    mondayWorkHoursId: z.number().int().positive().nullable().optional(),
    tuesdayWorkHoursId: z.number().int().positive().nullable().optional(),
    wednesdayWorkHoursId: z.number().int().positive().nullable().optional(),
    thursdayWorkHoursId: z.number().int().positive().nullable().optional(),
    fridayWorkHoursId: z.number().int().positive().nullable().optional(),
    saturdayWorkHoursId: z.number().int().positive().nullable().optional(),
    sundayWorkHoursId: z.number().int().positive().nullable().optional(),
    description: z.string().nullable().optional(),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
  }),
});

const workHoursCommandSchema = z.object({
  type: z.literal("work_hours"),
  action: z.enum(["create", "update", "delete"]),
  workHours: z.object({
    id: z.number().int().nonnegative().optional().default(0),
    name: z.string().min(1).max(100),
    color: z.string().max(20).nullable().optional(),
    scheduleIn: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    scheduleOut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    scanInStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    scanInEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    scanOutStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    scanOutEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    lateToleranceMinutes: z.number().int().nonnegative().default(5),
    earlyLeaveToleranceMinutes: z.number().int().nonnegative().default(5),
    requireCheckIn: z.boolean().default(true),
    requireCheckOut: z.boolean().default(true),
    isActive: z.boolean().default(true),
  }),
});

const assignShiftCommandSchema = z.object({
  type: z.literal("assign_shift"),
  action: z.enum(["assign", "remove", "set_default"]).optional(),
  assignment: z
    .object({
      id: z.number().int().nonnegative().optional().default(0),
      shiftId: z.number().int().positive(),
      departmentId: z.number().int().positive().nullable().optional(),
      employeeId: z.number().int().positive().nullable().optional(),
      isDefault: z.boolean().optional(),
    })
    .refine((data) => (data.departmentId ? !data.employeeId : !!data.employeeId), {
      message: "Assignment must specify either departmentId or employeeId, not both or neither",
    }),
});

const sourceCommandSchema = z.object({
  type: z.literal("source"),
  action: z.enum(["create", "update", "delete"]),
  source: z.object({
    id: z.number().int().nonnegative().optional().default(0),
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(150),
    isActive: z.boolean().default(true),
  }),
});

const grantCommandSchema = z.object({
  type: z.literal("grant"),
  value: z.object({
    id: z.number().int().nonnegative().optional().default(0),
    principalKey: z.string().min(1).max(150),
    displayName: z.string().min(1).max(150),
    role: z.enum(["HR_ADMIN", "HR_STAFF", "REPORT_VIEWER"]),
    isActive: z.boolean().default(true),
  }),
  action: z.enum(["save", "delete"]).optional().default("save"),
});

const deleteGrantCommandSchema = z.object({
  type: z.literal("delete_grant"),
  id: z.number().int().positive(),
});

export const attendanceCommandSchema = z.discriminatedUnion("type", [
  correctCommandSchema,
  identityCommandSchema,
  deleteIdentityCommandSchema,
  lockCommandSchema,
  importCommandSchema,
  reviewCommandSchema,
  batchCommandSchema,
  deleteBatchCommandSchema,
  toggleStrictIntegrityCommandSchema,
  setStrictIntegrityCommandSchema,
  recordAttendanceCommandSchema,
  shiftCommandSchema,
  workHoursCommandSchema,
  assignShiftCommandSchema,
  sourceCommandSchema,
  grantCommandSchema,
  deleteGrantCommandSchema,
]);

export const postAttendanceCommandBodySchema = z
  .object({
    operationId: z.string().regex(UUID_REGEX, "operationId must be a valid UUID"),
    command: attendanceCommandSchema,
    expectedBatchRevision: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((val: any, ctx) => {
    if ("actor" in val) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Client-supplied actor is not allowed",
      });
    }
    if ("audit" in val) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Client-supplied audit is not allowed",
      });
    }
    if ("outcome" in val) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Client-supplied outcome is not allowed",
      });
    }
  });

export type ValidatedAttendanceCommandBody = z.infer<typeof postAttendanceCommandBodySchema>;

export const COMMAND_PERMISSIONS_MAP: Record<ServerAttendanceCommand["type"], string[]> = {
  import: ["attendance.import", "attendance.manage"],
  review: ["attendance.import", "attendance.manage"],
  batch: ["attendance.import", "attendance.manage"],
  toggle_strict_integrity: ["attendance.import", "attendance.manage"],
  delete_batch: ["attendance.import", "attendance.manage"],
  correct: ["attendance.manage"],
  record_attendance: ["attendance.manage"],
  identity: ["attendance.manage"],
  delete_identity: ["attendance.manage"],
  source: ["attendance.manage"],
  shift: ["attendance.manage"],
  work_hours: ["attendance.manage"],
  assign_shift: ["attendance.manage"],
  lock: ["attendance.manage"],
  grant: ["attendance.manage"],
  delete_grant: ["attendance.manage"],
  set_strict_integrity: ["attendance.manage"],
};
