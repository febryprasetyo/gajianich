import { test } from "node:test";
import assert from "node:assert";
import { attendanceDailyNotes } from "./attendanceDailyNotes";

test("attendanceDailyNotes schema defines required columns for daily persistence and HR highlights", () => {
  assert.ok(attendanceDailyNotes.id, "id column must exist");
  assert.ok(attendanceDailyNotes.groupId, "groupId column must exist");
  assert.ok(attendanceDailyNotes.organizationId, "organizationId column must exist");
  assert.ok(attendanceDailyNotes.workDate, "workDate column must exist");
  assert.ok(attendanceDailyNotes.employeeId, "employeeId column must exist");
  assert.ok(attendanceDailyNotes.isHighlighted, "isHighlighted column must exist");
  assert.ok(attendanceDailyNotes.manualNote, "manualNote column must exist");
  assert.ok(attendanceDailyNotes.updatedById, "updatedById column must exist");
  assert.ok(attendanceDailyNotes.createdAt, "createdAt column must exist");
  assert.ok(attendanceDailyNotes.updatedAt, "updatedAt column must exist");
});
