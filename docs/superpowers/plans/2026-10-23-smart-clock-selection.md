# Implementation Plan: Smart Clock Selection (Pilihan Masuk vs Pulang)

**Tanggal:** 23 Oktober 2026  
**Status:** DRAFT (Menunggu Persetujuan Pengguna)  
**Dokumen Terkait:** [Design Spec](../specs/2026-10-23-smart-clock-selection-design.md)

---

## 1. Overview & Architecture

Fitur ini memberikan kecerdasan kontekstual pada presensi mobile: saat karyawan belum absen masuk dan waktu sudah sore / mendekati jam pulang, aplikasi menyediakan pilihan untuk **Absen Masuk (Terlambat)** atau **Langsung Absen Pulang (Lupa Masuk Pagi)** tanpa memaksa alur sekuensial yang kaku.

---

## 2. Phase-by-Phase Tasks

### Phase 1: Backend Domain & Service Update
- [ ] Update `backend/src/services/mobileAttendanceService.ts`:
  - Tambahkan parameter `isDirectOut?: boolean` pada `MobileClockInput`.
  - Izinkan `eventType: 'OUT'` tanpa entry `IN` jika `isDirectOut === true`.
  - Tetapkan `approvalStatus = 'PENDING'` untuk `DIRECT_OUT` (abaikan autoApprove shift).
  - Berikan flag `isLateAfternoon` atau kalkulasi window pada respons `getMobileTodaySummary`.
- [ ] Automated Unit & Integration Tests:
  - Buat tes unit/integrasi di `backend/src/services/mobileClock.integration.test.ts` untuk memverifikasi `isDirectOut` berhasil tersimpan sebagai PENDING dan ditandai tanpa entry IN.
  - Verifikasi bahwa `OUT` tanpa `IN` yang tidak menyertakan `isDirectOut` tetap ditolak dengan pesan error yang ada.

### Phase 2: Frontend Smart Selection Modal
- [ ] Buat komponen `frontend/src/components/mobile/SmartClockSelectionModal.tsx` menggunakan `ModalShell`:
  - Menampilkan waktu saat ini dan peringatan bahwa belum ada jam masuk.
  - Menyediakan 2 opsi: "Absen Masuk (Terlambat)" dan "Langsung Absen Pulang (Lupa Masuk)".
  - Menyediakan input keterangan opsional jika memilih langsung pulang.
- [ ] Integrasikan ke `frontend/src/app/m/beranda/page.tsx` dan `frontend/src/app/m/presensi/page.tsx`:
  - Hitung apakah waktu saat ini berada di ambang batas sore (misal `>= 13:00` atau `>= scheduleIn + 4 jam`).
  - Jika tombol presensi diklik di window sore dan `checkedIn === false`: buka `SmartClockSelectionModal`.
  - Lanjutkan ke `FaceAttendanceSheet` dengan `eventType` dan `isDirectOut` sesuai pilihan pengguna.

### Phase 3: Reviewer & Detail Display
- [ ] Pastikan tampilan pada `AttendanceEventDetails.tsx` dan `MobileApprovalsPage.tsx` menampilkan badge/keterangan jelas: *"Langsung Absen Pulang (Tanpa Absen Masuk)"*.

### Phase 4: Verification Loop
- [ ] Typecheck frontend & backend (`npx tsc --noEmit`).
- [ ] Linter check (`npm run lint`).
- [ ] Automated test suite (`npm test`).
- [ ] Browser Playwright verification.
- [ ] Update TODO dan checkpoint Git.

---

## 3. Verification Commands
```bash
# Backend tests
cd backend && npx tsx --test src/services/mobileClock.integration.test.ts
cd backend && npx tsc --noEmit

# Frontend tests & lint
cd frontend && npx tsc --noEmit && npm run lint && npm test
```
