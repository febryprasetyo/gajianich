# Implementation Plan: Guard Double Scan Presensi & FI - FO Resolution

**Tanggal:** 27 Oktober 2026  
**Status:** COMPLETED (Terverifikasi)  
**Dokumen Terkait:**  
- [Spesifikasi Desain](../specs/2026-10-27-attendance-double-scan-fi-fo-guard-design.md)  
- [Panduan Desain Master](../../UI_DESIGN_SYSTEM_GUIDE.md)

---

## 1. Shared Types & Contracts

Tidak ada perubahan skema tabel baru yang memutus database. Aturan tipe yang diperkuat:
```ts
// Status tombol presensi
export type AttendanceRingState = 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'COMPLETED';

// Kontrak error API saat mencoba absen masuk ulang setelah selesai
interface AttendanceErrorResponse {
  success: false;
  error: string;
}
```

---

## 2. Phase-by-Phase Tasks

### Phase 1: Koreksi Data Kasus 50181 (2026-10-26)
- [x] Buat dan jalankan script SQL/Node untuk memperbaiki data presensi karyawan 50181 (Adam Putra Jaya) tanggal 2026-10-26:
  - Tandai self log id 10 (IN 17:06) sebagai `REJECTED`.
  - Setujui self log id 8 (IN 10:14) sebagai `APPROVED`.
  - Perbarui `attendance_records` id 36 dengan `scan_in: '10:14'`, `scan_out: '17:05'`, dan kalkulasi keterlambatan yang tepat.
- [x] Verifikasi database record karyawan 50181 sudah bersih dan valid.

### Phase 2: Backend Service & TDD (`mobileAttendanceService.ts`)
- [x] Tambahkan unit/integration test baru di `backend/src/services/mobileClock.integration.test.ts`:
  - Test 1: Penolakan clock `IN` jika hari tersebut sudah memiliki log `IN` dan `OUT`.
  - Test 2: Logika resolusi FI - FO (First In - Last Out) saat memproyeksikan data ke `attendance_records` sehingga jam masuk mengambil scan pertama dan jam keluar mengambil scan terakhir.
- [x] Implementasikan backend guard di `recordMobileClock`:
  - Periksa apakah hari ini sudah memiliki log `IN` dan `OUT`. Jika ada, tolak request `IN` baru dengan pesan informatif: *"Presensi hari ini sudah lengkap (sudah absen masuk dan pulang)."*
- [x] Implementasikan FI - FO resolution di `projectApprovedLog` dan `getMobileTodaySummary`:
  - `inLog`: Ambil log `IN` paling awal (*sort ascending by occurredAt*).
  - `outLog`: Ambil log `OUT` paling akhir (*sort descending by occurredAt*).

### Phase 3: Frontend Mobile UI (`frontend/src/app/m/presensi/page.tsx` & `PresensiRingButton.tsx`)
- [x] Perbarui penentuan status tombol di `PresensiRingButton`:
  - Jika `isCheckedIn && isCheckedOut`, status wajib selalu `"COMPLETED"` (mengabaikan strictClock default).
  - Tombol dalam kondisi `"COMPLETED"` menampilkan label "Selesai", sublabel "Presensi Lengkap", dan dinonaktifkan (`disabled = true`).
- [x] Perbarui `handleClockButtonClick`:
  - Jika `isCheckedIn && isCheckedOut`, batalkan klik dan jangan membuka sheet `FaceAttendanceSheet`.
- [x] Perbaiki fallback `isCheckOut`:
  - Pastikan tidak pernah jatuh ke `isCheckOut = false` jika karyawan sudah pernah absen masuk dan keluar.

### Phase 4: Verification Loop & Quality Assurance
- [x] Jalankan automated test backend: `cd backend && npm test`
- [x] Jalankan typecheck frontend: `cd frontend && npx tsc --noEmit`
- [x] Verifikasi query database kembali untuk memastikan tidak ada anomali `scan_in > scan_out`.

---

## 3. Verification Commands

```bash
# Backend test
docker exec gajianich_backend_dev npm test src/services/mobileClock.integration.test.ts

# Backend build check
docker exec gajianich_backend_dev npm run build

# Frontend typecheck
docker exec gajianich_frontend_dev npx tsc --noEmit
```

### Phase 5: Aturan Cooldown 30 Menit & Resolusi Double Scan
- [x] TDD Unit Test di `mobileAttendanceService.test.ts`:
  - Test: Scan dalam rentang < 30 menit setelah scan masuk otomatis diperlakukan sebagai duplikat scan masuk (bukan scan pulang).
  - Test: Scan pulang < 30 menit dari scan masuk ditolak / dialihkan ke duplikat masuk.
  - Test: Scan pulang kedua (Last Out) memperbarui jam pulang ke waktu terbaru.
- [x] Backend Implementation (`mobileAttendanceService.ts`):
  - Validasi selisih waktu: Jika `inLog` berjarak < 30 menit dan payload mencoba `OUT`, cegah menjadi `OUT` (atau jika reclock, catat sebagai duplikat `IN`).
  - Izinkan re-clock `OUT` untuk memperbarui waktu kepulangan (*Last Out*).
- [x] Frontend Implementation (`page.tsx`, `beranda/page.tsx`, `PresensiRingButton.tsx`):
  - Dalam rentang 30 menit dari `checkInTime`, tombol presensi tidak menampilkan "Absen Pulang" melainkan "Sudah Masuk" atau tetap mengunci checkout selama 30 menit.
  - Jika karyawan sudah absen pulang, izinkan tap ulang untuk "Perbarui Pulang" (*Last Out*).
- [x] Verification Loop (Unit test, typecheck, lint).
