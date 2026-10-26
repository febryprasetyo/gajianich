# Implementation Plan: Smart Clock Selection (Pilihan Masuk vs Pulang)

**Tanggal:** 26 Oktober 2026  
**Status:** COMPLETED (Selesai & Terverifikasi Penuh)  
**Dokumen Terkait:** [Design Spec](../specs/2026-10-23-smart-clock-selection-design.md)

---

## 1. Overview & Architecture

Fitur ini memberikan kecerdasan kontekstual pada presensi mobile PWA:
1. Saat karyawan belum absen masuk dan waktu saat ini telah melewati ambang batas (`currentTime >= scheduleIn + 5 jam`), sistem menampilkan **SmartClockSelectionModal** dengan 2 pilihan:
   - **Absen Masuk (Terlambat)**: Untuk karyawan yang baru tiba.
   - **Langsung Absen Pulang (Lupa Masuk Pagi)**: Mencatat `OUT` tanpa `IN` (`isDirectOut: true`) dengan **keterangan wajib**, status `PENDING` untuk verifikasi HRD.
2. Ketika disetujui HRD, rekam kehadiran diproyeksikan ke `attendanceRecords` dengan `scanIn: null` dan `scanOut: outLog.scanTime`.
3. Mendukung 2 mode pengaturan presensi:
   - **Default Mode (Multi-Clocking):** Karyawan dapat absen berkali-kali (semua tercatat sebagai log `PENDING`). HRD memilih log mana yang disetujui (misal dari 3x absen pulang, dipilih yang ke-3), dan log yang disetujui itulah yang disimpan/diproyeksikan.
   - **Strict Mode:** Tombol presensi langsung non-aktif setelah presensi tercatat.
4. Badge khusus *"Langsung Pulang (Tanpa Masuk)"* ditampilkan pada halaman review HRD (`MobileApprovalsPage.tsx`) dan riwayat presensi (`AttendanceEventDetails.tsx`).

---

## 2. Phase-by-Phase Tasks

### Phase 1: Backend Domain, Schema Setting, & Service Update
- [x] Tambahkan konfigurasi `attendance_mobile_strict_clock` pada pembacaan pengaturan / service.
- [x] Update `backend/src/services/mobileAttendanceService.ts`:
  - Perbarui interface `MobileClockInput` dengan `isDirectOut?: boolean`.
  - Pada `recordMobileClock`:
    - Izinkan `eventType: 'OUT'` tanpa entry `IN` jika `isDirectOut === true`.
    - Validasi bahwa jika `isDirectOut === true`, field `notes` wajib diisi (minimal 3 karakter non-spasi). Jika kosong, lempar error: `"Keterangan wajib diisi untuk absensi pulang tanpa jam masuk."`.
    - Otomatis sematkan tag prefix: `[DIRECT_OUT] ${payload.notes.trim()}`.
    - Paksa `approvalStatus = 'PENDING'` untuk `isDirectOut === true` (mengabaikan `autoApproveOut`).
    - Evaluasi mode strict vs default: jika mode strict aktif dan log dengan eventType sama sudah ada, tolak; jika default mode, izinkan pencatatan log baru.
  - Perbarui `projectApprovedLog`:
    - Izinkan proyeksi rekam jika ada `outLog` meskipun `inLog` bernilai null (`scanIn: null`, `scanOut: outLog.scanTime`, `lateMinutes: 0`).
    - Pastikan jika HRD menyetujui log tertentu (misal log ke-3), jam log tersebut yang disimpan ke `attendanceRecords`.
  - Perbarui `getMobileTodaySummary`:
    - Hitung ambang batas cerdas: `isLateAfternoon` dan `canDirectOut` berdasarkan `currentTime >= scheduleIn + 5 jam`.
    - Sertakan status `strictClock` dan metadata `shiftWindow` pada respons.
- [x] Perbarui controller / Zod schema di `backend/src/controllers/mobileAttendanceController.ts` untuk mengizinkan `isDirectOut: z.boolean().optional()`.
- [x] Automated Unit & Integration Tests:
  - Uji di `backend/src/services/mobileClock.integration.test.ts`:
    - `isDirectOut: true` tanpa `IN` berhasil tersimpan dengan status `PENDING` dan tag `[DIRECT_OUT]`.
    - `isDirectOut: true` tanpa catatan ditolak dengan pesan error yang sesuai.
    - `OUT` tanpa `IN` dan tanpa `isDirectOut` tetap ditolak dengan pesan error `"Belum melakukan presensi masuk."`.
    - Proyeksi `projectApprovedLog` saat log `DIRECT_OUT` disetujui menghasilkan `scanIn: null`, `scanOut` terisi, dan `lateMinutes: 0`.
    - Multi-clocking: absen pulang beberapa kali dapat diapprove oleh HRD dan mengupdate rekam absensi.

### Phase 2: Frontend Smart Selection UI & Modal
- [x] Buat komponen `frontend/src/components/mobile/SmartClockSelectionModal.tsx` menggunakan `ModalShell`:
  - Menampilkan waktu saat ini dan peringatan bahwa belum ada rekam masuk.
  - Pilihan 1: "Absen Masuk (Terlambat)".
  - Pilihan 2: "Langsung Absen Pulang (Lupa Masuk Pagi)" dengan textarea catatan wajib diisi.
- [x] Perbarui `frontend/src/components/mobile/FaceAttendanceSheet.tsx`:
  - Tambahkan prop `isDirectOut?: boolean` dan `notes?: string`.
  - Teruskan ke `postMobileClock({ ...payload, isDirectOut, notes })`.
- [x] Integrasikan ke `frontend/src/app/m/beranda/page.tsx` & `frontend/src/app/m/presensi/page.tsx`:
  - Deteksi apakah waktu saat ini `>= scheduleIn + 5 jam` dan `checkedIn === false`.
  - Jika ya: klik tombol cincin presensi membuka `SmartClockSelectionModal`.
  - Dari modal, lanjutkan ke `FaceAttendanceSheet` dengan parameter yang dipilih.
  - Dukung mode strict vs default untuk status tombol pasca-presensi.

### Phase 3: Reviewer & Detail Display
- [x] Perbarui `frontend/src/components/attendance/MobileApprovalsPage.tsx`:
  - Deteksi tag `[DIRECT_OUT]` atau event `OUT` tanpa masuk.
  - Tampilkan badge khusus: **"Langsung Pulang (Tanpa Masuk)"** (varian Amber/Indigo).
- [x] Perbarui `frontend/src/components/mobile/AttendanceEventDetails.tsx` & `DayDetailSheet.tsx`:
  - Tampilkan label/badge yang jelas saat riwayat merupakan presensi kepulangan langsung.

### Phase 4: Full Verification Loop
- [x] Backend: `cd backend && npx tsx --test src/services/mobileClock.integration.test.ts && npx tsc --noEmit`.
- [x] Frontend: `cd frontend && npx tsc --noEmit && npm run lint && npm test && npm run build`.
- [x] Verifikasi browser Playwright jika diperlukan.
- [x] Perbarui berkas TODO dan lakukan commit Git bertahap.

---

## 3. Verification Commands
```bash
# Backend tests & typecheck
cd backend && npx tsx --test src/services/mobileClock.integration.test.ts
cd backend && npx tsc --noEmit

# Frontend tests & lint
cd frontend && npx tsc --noEmit && npm run lint && npm test
```
