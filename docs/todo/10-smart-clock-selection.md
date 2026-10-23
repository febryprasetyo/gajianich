# Fitur 10: Smart Clock Selection (Pilihan Masuk vs Pulang)

**Status:** Rencana (Dijadwalkan untuk pengerjaan besok hari)  
**Dokumen Desain:** [Spec](../superpowers/specs/2026-10-23-smart-clock-selection-design.md)  
**Dokumen Rencana:** [Plan](../superpowers/plans/2026-10-23-smart-clock-selection.md)

---

## Deskripsi Singkat
Menyediakan pemilihan cerdas (Smart Clock Selection) ketika karyawan belum melakukan absen masuk dan waktu saat ini telah melewati ambang batas siang/sore (misal >= 13:00 / mendekati jam pulang 16:00). Aplikasi tidak memaksakan alur sekuensial "Absen Masuk", melainkan memberikan dialog pilihan:
1. **Absen Masuk (Terlambat)**: Untuk karyawan yang memang baru tiba di lokasi.
2. **Langsung Absen Pulang (Lupa Masuk Pagi)**: Untuk karyawan yang hadir sejak pagi namun lupa absen masuk, mencatat event `OUT` dengan penanda `[DIRECT_OUT]`, berstatus wajib review HRD (`PENDING`).

---

## Checklist Implementasi

### Phase 1: Backend Domain & Service Update
- [ ] Tambahkan parameter `isDirectOut?: boolean` pada `MobileClockInput` di `backend/src/services/mobileAttendanceService.ts`.
- [ ] Izinkan event `OUT` tanpa rekaman `IN` jika `isDirectOut === true`.
- [ ] Paksa status approval `PENDING` untuk rekam `DIRECT_OUT` (abaikan autoApprove shift) dan sertakan penanda `[DIRECT_OUT]` pada catatan log.
- [ ] Tambahkan kalkulasi/helper jendela waktu sore pada respons `getMobileTodaySummary`.
- [ ] Buat automated test di `backend/src/services/mobileClock.integration.test.ts` untuk memverifikasi log `isDirectOut` berhasil tersimpan sebagai `PENDING` dan penolakan `OUT` tanpa `isDirectOut` tetap konsisten.

### Phase 2: Frontend Smart Selection UI & Modal
- [ ] Buat komponen `frontend/src/components/mobile/SmartClockSelectionModal.tsx` berbasis `ModalShell`.
- [ ] Tampilkan ringkasan waktu, peringatan belum ada jam masuk, serta 2 pilihan aksi: "Absen Masuk" atau "Langsung Absen Pulang".
- [ ] Sediakan field catatan opsional saat memilih langsung pulang.
- [ ] Integrasikan ke `frontend/src/app/m/beranda/page.tsx` dan `frontend/src/app/m/presensi/page.tsx` pada trigger tombol presensi.
- [ ] Hubungkan ke `FaceAttendanceSheet` dengan meneruskan payload `isDirectOut`.

### Phase 3: Reviewer & Detail Display
- [ ] Tampilkan penanda khusus *"Langsung Absen Pulang (Tanpa Absen Masuk)"* pada `AttendanceEventDetails.tsx` dan antrean review `MobileApprovalsPage.tsx`.

### Phase 4: Full Verification Loop
- [ ] Jalankan verifikasi backend: unit/integration tests dan `npx tsc --noEmit`.
- [ ] Jalankan verifikasi frontend: unit tests, `npm run lint`, `npx tsc --noEmit`, dan `npm run build`.
- [ ] Uji skenario browser Playwright.
- [ ] Update checkpoint TODO dan commit Git.
