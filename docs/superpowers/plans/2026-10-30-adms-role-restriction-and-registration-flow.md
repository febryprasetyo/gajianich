# Task Plan: Pembatasan Role ADMS & Alur Registrasi Mesin

## Phase 1: Backend Security & Service Layer
- [x] 1.1 Perbarui `backend/src/services/admsRegistration.ts`:
  - Perkaya query `getAdmsCandidates` dengan `og.name AS "groupName"` dan `d.group_id AS "groupId"`.
  - Tambahkan dukungan pendaftaran mesin baru pada `parseRegisterInput` dan `registerAdmsDevice` (transaksi insert ke `attendance_devices` + `adms.devices`).
- [x] 1.2 Perbarui `backend/src/routes/attendanceDeviceRoutes.ts`:
  - Pasang middleware `requireRoles('SuperAdmin', 'ITAdmin')` pada endpoint registrasi ADMS dan CRUD mesin absensi.
- [x] 1.3 Perbarui unit test `backend/src/services/admsRegistration.test.ts` untuk memverifikasi pendaftaran mesin baru dan filter kandidat.

## Phase 2: Frontend Client & Modal Enhancement
- [x] 2.1 Perbarui `frontend/src/lib/attendance/admsMonitor.ts`:
  - Perluas antarmuka `AdmsCandidateDevice` dengan `groupId?: number`, `groupName?: string`.
  - Tambahkan fungsi validasi registrasi mesin baru `validateNewAdmsDevice`.
- [x] 2.2 Tambahkan unit test di `frontend/src/lib/attendance/admsMonitor.test.mjs`.
- [x] 2.3 Rombak `frontend/src/components/attendance/AdmsRegistrationModal.tsx`:
  - Tambahkan Tab / Mode: "Pilih Mesin Terdaftar" & "Daftarkan Mesin Baru".
  - Tambahkan direct fetching saat modal dibuka jika candidates belum tersedia.
  - Sediakan dropdown pemilihan kelompok unit perusahaan jika mode mesin baru dipilih.
- [x] 2.4 Perbarui `frontend/src/app/dashboard/attendance/adms/page.tsx`:
  - Batasi akses tombol registrasi dan aksi toggle ADMS hanya untuk `SuperAdmin` dan `ITAdmin`.

## Phase 3: Verification & Build
- [x] 3.1 Jalankan automated tests backend & frontend.
- [x] 3.2 Jalankan typecheck TypeScript frontend (`tsc --noEmit`).
- [x] 3.3 Verifikasi live API endpoint di dalam container Docker dev.
- [x] 3.4 Git commit atomic dengan conventional commit.
