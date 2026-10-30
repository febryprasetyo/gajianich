# Implementation Plan: Alur Sinkronisasi Hybrid ADMS ke Presensi & Pembersihan Data

## Phase 1: Core Cleansing & Ingestion Service (Backend)
- [x] 1.1 Buat service cleansing & ingestion di `backend/src/services/admsAttendanceSync.ts`:
  - Fungsi `cleanseAndIngestAdmsLogs(pool, groupId, logs)`:
    - Normalisasi PIN dan pencocokan ke karyawan aktif.
    - Debounce filter (mengabaikan ketukan ganda < 60 detik dari PIN yang sama).
    - Insert bersih ke `attendance_device_raw_logs` dengan `ingestion_key` (`ON CONFLICT DO NOTHING`).
    - Jalankan kalkulasi FIFO otomatis (`calculateAttendanceFromPunches` + `mergeAttendanceScans`) untuk meng-update `attendance_records`.
- [x] 1.2 Buat endpoint API di `backend/src/controllers/admsMonitoringController.ts` & `backend/src/routes/attendanceDeviceRoutes.ts`:
  - `POST /adms/sync-to-attendance`: Sinkronkan log bersih ADMS ke daftar absensi.
  - `POST /adms/resolve-unmapped`: Petakan PIN tidak terdaftar ke karyawan tertentu dan proses lognya ke presensi utama.
- [x] 1.3 Integrasikan background automatic ingestion di receiver ADMS (`adms-server/src/store.mjs` atau hook sinkronisasi).

## Phase 2: Unit Testing (Backend TDD)
- [x] 2.1 Buat unit test `backend/src/services/admsAttendanceSync.test.ts`:
  - Menguji filtering scan berulang < 60 detik.
  - Menguji penentuan jam masuk pertama dan jam pulang terakhir (FIFO).
  - Menguji pemetaan PIN unmapped ke karyawan aktif.
  - Menguji pencegahan duplikasi data masuk ke `attendance_records`.

## Phase 3: Frontend UI Enhancements
- [x] 3.1 Perbarui halaman Review ADMS (`frontend/src/app/dashboard/attendance/adms/page.tsx`):
  - Tambahkan tombol aksi **"Sinkronkan Log Bersih ke Presensi"** di header / toolbar review.
  - Tambahkan tombol aksi baris **"Petakan Karyawan"** pada log yang berstatus "Belum dipetakan".
- [x] 3.2 Buat modal `AdmsResolvePinModal.tsx`:
  - Memilih karyawan dari dropdown (dengan pencarian NIK/Nama).
  - Checkbox *"Langsung proses log absensi tanggal terkait ke daftar absensi"*.
  - Feedback konfirmasi berhasil.
- [x] 3.3 Tambahkan unit test frontend di `frontend/src/lib/attendance/admsMonitor.test.mjs`.

## Phase 4: Verification Loop & Quality Gate
- [x] 4.1 Jalankan `npx tsx --test backend/src/services/admsAttendanceSync.test.ts`.
- [x] 4.2 Jalankan unit test frontend `npx tsx frontend/src/lib/attendance/admsMonitor.test.mjs`.
- [x] 4.3 Jalankan backend `tsc` dan frontend `tsc --noEmit`.
- [x] 4.4 Uji coba live API di container backend.
- [x] 4.5 Git commit atomic milestone.

