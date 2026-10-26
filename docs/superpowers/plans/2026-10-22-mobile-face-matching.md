# Implementation Plan: Lightweight Mobile Face Matching

- Design Spec: [2026-10-22-mobile-face-matching-design.md](../specs/2026-10-22-mobile-face-matching-design.md)
- Status: Selesai & Terverifikasi

---

## Phase 1: Backend Face Profile Sync & Distance Verification
- [x] **Task 1.1**: Tambahkan endpoint GET /api/v1/attendance/mobile/face-profile di backend untuk mengambil status pendaftaran dan face descriptor karyawan.
- [x] **Task 1.2**: Tulis unit test untuk verifikasi perhitungan Euclidean distance dan threshold match di backend.

## Phase 2: Client-Side Lightweight Face Matching Engine (< 1.5MB)
- [x] **Task 2.1**: Buat frontend/src/lib/attendance/faceMatcher.ts berisi algoritma Euclidean distance, normalisasi vektor 128-D, dan liveness check logic.
- [x] **Task 2.2**: Tulis unit test frontend/src/lib/attendance/faceMatcher.test.mjs untuk menguji akurasi jarak biometrik dan boundary threshold.

## Phase 3: Integrasi UI Kamera FaceAttendanceSheet
- [x] **Task 3.1**: Tambahkan indikator visual real-time pada FaceAttendanceSheet.tsx (Mencari Wajah -> Memverifikasi -> Wajah Cocok [Emerald] / Tidak Cocok [Rose]).
- [x] **Task 3.2**: Sambungkan alur enrollment di frontend/src/app/m/profile/page.tsx untuk mendaftarkan wajah master sekali jalan.

## Phase 4: Verification & Checkpoint Tracking
- [x] **Task 4.2**: Jalankan pengujian backend npm test dan pastikan 100% lolos.
- [x] **Task 4.2**: Jalankan frontend typecheck npx tsc --noEmit.
- [x] **Task 4.2**: Perbarui checkpoint pelacakan di dokumen todo dan lakukan commit Git.
