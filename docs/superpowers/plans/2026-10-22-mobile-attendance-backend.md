# Implementation Plan: Mobile PWA Attendance Backend & Integration

**File:** `docs/superpowers/plans/2026-10-22-mobile-attendance-backend.md`  
**Spec Reference:** `docs/superpowers/specs/2026-10-22-mobile-attendance-backend-design.md`  
**Status:** DRAFT / APPROVED FOR IMPLEMENTATION  
**Theme:** GAJIANICH / Emerald Enterprise  

---

## 1. Overview & Architecture Strategy

Mengimplementasikan backend service dan API endpoints untuk modul presensi mobile karyawan mandiri dengan 4 pilar fitur utama:
1. **Arsitektur Peta Gratis (OpenStreetMap + Leaflet + Nominatim)**:
   - Geocoder gratis: OSM Nominatim (tanpa API key).
   - Visualisasi: OpenStreetMap tile server + Leaflet.
   - Shortcut verifikasi HRD: URL direct pinpoint OpenStreetMap & Google Maps.
2. **Relasi User & Karyawan** (`users.employeeId` -> `employees.id`, proteksi akses akun oleh Admin IT).
3. **Retensi Foto 7 Hari** (Script/utilitas pembersihan otomatis file foto fisik > 7 hari dengan WebP Sharp).
4. **Verifikasi HRD Berdasarkan Shift** (Office: verifikasi masuk saja; Produksi: verifikasi masuk dan pulang).

---

## 2. Phase-by-Phase Task Checklist

### Phase 1: Database Schema & Migration
- [x] **Task 1.1**: Buat skema Drizzle `attendance_self_logs` di `backend/src/db/schema/attendanceSelfLogs.ts` mencakup kolom: `employeeId`, `userId`, `eventType`, `workDate`, `scanTime`, `shiftCode`, `shiftCategory`, `latitude`, `longitude`, `accuracy`, `address`, `mapUrl`, `googleMapsUrl`, `isWithinGeofence`, `distanceMeters`, `photoUrl`, `photoPurgedAt`, `txHash`, `deviceInfo`, `notes`, `requiresVerification`, `approvalStatus`, `approvalNote`, `verifiedById`, `verifiedAt`.
- [x] **Task 1.2**: Buat skema Drizzle `attendance_face_profiles` di `backend/src/db/schema/attendanceFaceProfiles.ts`.
- [x] **Task 1.3**: Daftarkan skema baru di `backend/src/db/index.ts` (atau file ekspor schema yang relevan).
- [x] **Task 1.4**: Jalankan migrasi database Drizzle (`npm run db:migrate`).
- [x] **Task 1.5**: Tulis unit test skema `backend/src/db/schema/attendanceSelfLogs.test.ts`.

### Phase 2: Domain Logic, Geofencing, Free Maps & Photo Retention (TDD)
- [x] **Task 2.1**: Buat fungsi formula Haversine & generator URL map OpenStreetMap / Google Maps di `backend/src/domain/geofence.ts`.
- [x] **Task 2.2**: Tulis unit test untuk `backend/src/domain/geofence.test.ts`.
- [x] **Task 2.3**: Buat domain utility `backend/src/domain/attendanceVerificationPolicy.ts`:
  - `determineShiftCategory(shift)` -> `'OFFICE' | 'PRODUCTION'`.
  - `evaluateAttendanceApproval(shiftCategory, eventType, isWithinGeofence)` -> menentukan status `PENDING` vs `APPROVED` dan keterangan awal.
- [x] **Task 2.4**: Tulis unit test untuk `backend/src/domain/attendanceVerificationPolicy.test.ts`.
- [x] **Task 2.5**: Buat utility retensi foto di `backend/src/services/attendancePhotoStorage.ts`:
  - `saveAttendancePhoto(txHash, photoBase64)`: kompresi WebP via Sharp & simpan ke `data/attendance-selfies/YYYY-MM/`.
  - `purgeExpiredAttendancePhotos(retentionDays = 7)`: menghapus file foto fisik berumur > 7 hari dan memperbarui `photoPurgedAt`.
- [x] **Task 2.6**: Tulis unit test untuk `backend/src/services/attendancePhotoStorage.test.ts`.

### Phase 3: Service Layer & Business Logic
- [x] **Task 3.1**: Buat service `backend/src/services/mobileAttendanceService.ts`:
  - `getMobileTodaySummary(userId)`: validasi relasi karyawan, shift hari ini, rekaman presensi, map preview, dan status pendaftaran wajah.
  - `recordMobileClock(userId, payload)`: validasi `employeeId`, cegah duplikasi Clock In / Clock Out tanpa Clock In, hitung jarak kantor & geofence, simpan swafoto, terapkan aturan verifikasi shift (Office vs Produksi), insert `attendance_self_logs`, dan sync ke `attendance_records`.
  - `getMobileAttendanceHistory(userId, period)`: riwayat presensi bulanan karyawan lengkap dengan link map dan status approval.
  - `updateFaceEnrollment(userId, payload)`: update status biometrik wajah.
  - `listPendingVerifications(filters)`: query absensi pending untuk HRD dengan foto & map verifikasi.
  - `verifyAttendanceRecord(verifierUserId, payload)`: aksi approval/rejection oleh HRD.
- [x] **Task 3.2**: Tulis unit test service `backend/src/services/mobileAttendanceService.test.ts`.

### Phase 4: Express Controllers & Routes
- [x] **Task 4.1**: Buat controller `backend/src/controllers/mobileAttendanceController.ts`.
- [x] **Task 4.2**: Daftarkan routes `backend/src/routes/mobileAttendanceRoutes.ts` dengan middleware `authenticateToken` dan scoping akses.
- [x] **Task 4.3**: Daftarkan router di `backend/src/app.ts` pada `/api/v1/attendance/mobile`.
- [x] **Task 4.4**: Tulis integration test `backend/src/routes/mobileAttendanceRoutes.test.ts`.

### Phase 5: Frontend Integration (Mobile PWA & Map Display)
- [x] **Task 5.1**: Buat helper API klien di `frontend/src/lib/attendance/mobileApi.ts`.
- [x] **Task 5.2**: Integrasikan `frontend/src/app/m/beranda/page.tsx` ke backend (rekap riil, nama karyawan terautentikasi, trigger Clock In/Out dengan koordinat GPS aktual).
- [x] **Task 5.3**: Integrasikan `frontend/src/app/m/presensi/page.tsx` & `DayDetailSheet.tsx` (tampilkan data riil, link & preview peta OpenStreetMap, dan status persetujuan HRD).
- [x] **Task 5.4**: Integrasikan `frontend/src/app/m/profile/page.tsx` (profil karyawan aktual, biometrik wajah, dan session security).
- [x] **Task 5.5**: Next.js 16 Proxy-level dan Client-level Route Protection untuk `/m/:path*` (redirect unauthenticated access ke `/login`).
- [x] **Task 5.6**: Role-based redirection saat login (Employee langsung ke `/m/beranda`, HR ke `/attendance`, Admin ke `/dashboard`).
- [x] **Task 5.7**: Integrasi Create User dengan database karyawan (`users.employee_id` di `/dashboard/access`).

### Phase 6: Verification & End-to-End Validation
- [x] **Task 6.1**: Jalankan unit & integration test backend (`cd backend && npm test`).
- [x] **Task 6.2**: Jalankan frontend build & typecheck (`cd frontend && npx tsc --noEmit`).
- [x] **Task 6.3**: Jalankan test script verifikasi retensi foto 7 hari.

---

## 3. Verification Commands

```bash
# 1. Backend tests
cd backend && npm test

# 2. Frontend typecheck
cd frontend && npx tsc --noEmit
```
