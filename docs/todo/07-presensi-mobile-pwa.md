# Todo 07: Presensi Mobile PWA Karyawan & Backend Integrasi

Dokumen ini melacak checkpoint progres implementasi Presensi Mobile PWA dan Backend Integrasi.
Rujukan Arsitektur:
- **Design Spec**: [2026-10-22-mobile-attendance-backend-design.md](../superpowers/specs/2026-10-22-mobile-attendance-backend-design.md)
- **Implementation Plan**: [2026-10-22-mobile-attendance-backend.md](../superpowers/plans/2026-10-22-mobile-attendance-backend.md)

---

## Checkpoint Progres

### Phase 1: Database Schema & Migration
- [x] **Task 1.1**: Buat skema Drizzle `attendance_self_logs` di `backend/src/db/schema/attendanceSelfLogs.ts`
- [x] **Task 1.2**: Buat skema Drizzle `attendance_face_profiles` di `backend/src/db/schema/attendanceFaceProfiles.ts`
- [x] **Task 1.3**: Daftarkan skema baru di `backend/src/db/index.ts`
- [x] **Task 1.4**: Jalankan migrasi database Drizzle (`0021_attendance_self_logs.sql`)
- [x] **Task 1.5**: Tulis & jalankan unit test skema `backend/src/db/schema/attendanceSelfLogs.test.ts`

### Phase 2: Domain Logic, Geofencing, Free Maps & Photo Retention (TDD)
- [x] **Task 2.1**: Buat fungsi formula Haversine & generator URL map OpenStreetMap / Google Maps di `backend/src/domain/geofence.ts`
- [x] **Task 2.2**: Tulis unit test untuk `backend/src/domain/geofence.test.ts`
- [x] **Task 2.3**: Buat domain utility `backend/src/domain/attendanceVerificationPolicy.ts` (Office vs Produksi)
- [x] **Task 2.4**: Tulis unit test untuk `backend/src/domain/attendanceVerificationPolicy.test.ts`
- [x] **Task 2.5**: Buat utility retensi foto di `backend/src/services/attendancePhotoStorage.ts` (retensi 7 hari & kompresi WebP)
- [x] **Task 2.6**: Tulis unit test untuk `backend/src/services/attendancePhotoStorage.test.ts`

### Phase 3: Service Layer & Business Logic
- [x] **Task 3.1**: Buat service `backend/src/services/mobileAttendanceService.ts` (Summary, Clock In/Out, History, Verifications)
- [x] **Task 3.2**: Tulis unit test service `backend/src/services/mobileAttendanceService.test.ts`

### Phase 4: Express Controllers & Routes
- [x] **Task 4.1**: Buat controller `backend/src/controllers/mobileAttendanceController.ts`
- [x] **Task 4.2**: Daftarkan routes `backend/src/routes/mobileAttendanceRoutes.ts`
- [x] **Task 4.3**: Daftarkan router di `backend/src/app.ts` pada `/api/v1/attendance/mobile`
- [x] **Task 4.4**: Tulis integration test `backend/src/routes/mobileAttendanceRoutes.test.ts`

### Phase 5: Frontend Integration (Mobile PWA & Map Display)
- [x] **Task 5.1**: Buat helper API klien di `frontend/src/lib/attendance/mobileApi.ts`
- [x] **Task 5.2**: Integrasikan `frontend/src/app/m/beranda/page.tsx`
- [x] **Task 5.3**: Integrasikan `frontend/src/app/m/presensi/page.tsx` & `DayDetailSheet.tsx`
- [x] **Task 5.4**: Integrasikan `frontend/src/app/m/profile/page.tsx`

### Phase 6: Verification & End-to-End Validation
- [x] **Task 6.1**: Jalankan unit & integration test backend (`npm test`)
- [x] **Task 6.2**: Jalankan frontend build & typecheck (`npx tsc --noEmit`)
- [x] **Task 6.3**: Pengujian verifikasi HRD dan flow lengkap
