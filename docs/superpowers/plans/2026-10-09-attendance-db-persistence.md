# Implementation Plan: Persistensi Data Absensi & Impor ke PostgreSQL

- **Tanggal**: 2026-10-09
- **Fitur**: Attendance Database Persistence & Multi-device Sync
- **Design Spec**: docs/superpowers/specs/2026-10-09-attendance-db-persistence-design.md

---

## 1. Shared Types & Interfaces

- Shared types antara backend dan frontend:
  - AttendanceRecord (id, employeeId, workDate, shift, scheduleIn, scheduleOut, scanIn, scanOut, rawScanIn, rawScanOut, lateMinutes, earlyMinutes, overtimeMinutes, attendanceStatus, isDayOff, normalized, revision, sourceBatchId).
  - AttendanceBatch (id, filename, sourceId, fileHash, status, totalRows, validRows, skippedRows, createdAt, committedAt).

---

## 2. Phase-by-Phase Checklist

### Phase 1: Database Schema & Migration
- [x] Buat file skema Drizzle di backend/src/db/schema/attendance.ts (attendanceBatches & attendanceRecords dengan unique constraint).
- [x] Export skema di backend/src/db/schema/index.ts.
- [x] Generate / buat migration SQL (0015_attendance_records.sql) dan aplikasikan ke PostgreSQL dev DB.

### Phase 2: Backend Routes, Controller, & Automated Tests (TDD)
- [x] Tulis unit test untuk attendance controller & service di backend/src/controllers/attendanceController.test.ts.
- [x] Buat controller backend/src/controllers/attendanceController.ts:
  - getAttendanceRecords(req, res): filter startDate, endDate, employeeId, departmentId.
  - commitAttendanceBatch(req, res): transaksi atomik insert batch dan upsert attendance_records.
  - getAttendanceBatches(req, res): list riwayat batch.
- [x] Buat routes backend/src/routes/attendanceRoutes.ts dan daftarkan di backend/src/app.ts dengan proteksi RBAC.
- [x] Jalankan test backend hingga 100% lulus.

### Phase 3: Frontend Repository & Multi-device Sync
- [x] Update frontend/src/lib/attendance/repository.ts:
  - load(): fetch data dari /api/v1/attendance/records dan /api/v1/attendance/batches, merge dengan state.
  - execute(command): saat batch commit, kirim data records ke /api/v1/attendance/commit-batch.
- [x] Tulis/update unit test frontend di frontend/src/lib/attendance/attendanceDbSync.test.mjs.
- [x] Jalankan test frontend hingga 100% lulus.

### Phase 4: Verification Loop & Quality Gate
- [x] Jalankan npm test --prefix backend.
- [x] Jalankan npm test --prefix frontend.
- [x] Jalankan npm run build --prefix frontend.
- [x] Commit atomic ke git history.
