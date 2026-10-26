# Fitur 10: Smart Clock Selection (Pilihan Masuk vs Pulang)

**Status:** Selesai  
**Dokumen Desain:** [Spec](../superpowers/specs/2026-10-23-smart-clock-selection-design.md)  
**Dokumen Rencana:** [Plan](../superpowers/plans/2026-10-23-smart-clock-selection.md)

---

## Deskripsi Singkat
Menyediakan pemilihan cerdas (Smart Clock Selection) ketika karyawan belum melakukan absen masuk dan waktu saat ini telah melewati ambang batas siang/sore (`currentTime >= scheduleIn + 5 jam`). Aplikasi tidak memaksakan alur sekuensial "Absen Masuk", melainkan memberikan dialog pilihan:
1. **Absen Masuk (Terlambat)**: Untuk karyawan yang memang baru tiba di lokasi.
2. **Langsung Absen Pulang (Lupa Masuk Pagi)**: Untuk karyawan yang hadir sejak pagi namun lupa absen masuk, mencatat event `OUT` dengan penanda `[DIRECT_OUT]`, keterangan wajib diisi, dan berstatus wajib review HRD (`PENDING`).
3. **Fleksibilitas Kebijakan Presensi**:
   - *Default Mode:* Multi-clocking diizinkan (misal absen pulang beberapa kali), seluruhnya masuk antrean log `PENDING`, HRD memilih jam mana yang disetujui untuk disimpan ke rekam kehadiran (`attendanceRecords`).
   - *Strict Mode:* Tombol presensi dinonaktifkan setelah presensi berhasil.

---

## Checklist Implementasi

### Phase 1: Backend Domain & Service Update
- [x] Tambahkan konfigurasi `attendance_mobile_strict_clock` pada pembacaan pengaturan sistem.
- [x] Tambahkan parameter `isDirectOut?: boolean` pada `MobileClockInput` di `backend/src/services/mobileAttendanceService.ts`.
- [x] Izinkan event `OUT` tanpa rekaman `IN` jika `isDirectOut === true`.
- [x] Validasi keterangan wajib diisi untuk `isDirectOut === true`.
- [x] Paksa status approval `PENDING` untuk rekam `DIRECT_OUT` (abaikan autoApprove shift) dan sertakan penanda `[DIRECT_OUT]` pada catatan log.
- [x] Perbarui `projectApprovedLog` agar saat `DIRECT_OUT` disetujui HRD, rekam kehadiran disimpan dengan `scanIn: null`, `scanOut` sesuai log yang disetujui, dan `lateMinutes: 0`.
- [x] Tambahkan kalkulasi/helper jendela waktu sore (`currentTime >= scheduleIn + 5 jam`) pada respons `getMobileTodaySummary`.
- [x] Buat automated test di `backend/src/services/mobileClock.integration.test.ts` untuk memverifikasi log `isDirectOut`, penolakan tanpa catatan, multi-clocking, dan proyeksi approval.

### Phase 2: Frontend Smart Selection UI & Modal
- [x] Buat komponen `frontend/src/components/mobile/SmartClockSelectionModal.tsx` berbasis `ModalShell`.
- [x] Tampilkan ringkasan waktu, peringatan belum ada jam masuk, serta 2 pilihan aksi: "Absen Masuk" atau "Langsung Absen Pulang".
- [x] Sediakan field catatan wajib saat memilih langsung pulang.
- [x] Integrasikan ke `frontend/src/app/m/beranda/page.tsx` dan `frontend/src/app/m/presensi/page.tsx` pada trigger tombol presensi.
- [x] Hubungkan ke `FaceAttendanceSheet` dengan meneruskan payload `isDirectOut` dan `notes`.

### Phase 3: Reviewer & Detail Display
- [x] Tampilkan penanda khusus *"Langsung Pulang (Tanpa Masuk)"* pada `AttendanceEventDetails.tsx` dan antrean review `MobileApprovalsPage.tsx`.

### Phase 4: Full Verification Loop
- [x] Jalankan verifikasi backend: unit/integration tests dan `npx tsc --noEmit`.
- [x] Jalankan verifikasi frontend: unit tests, `npm run lint`, `npx tsc --noEmit`, dan `npm run build`.
- [x] Uji skenario browser Playwright jika diperlukan.
- [x] Update checkpoint TODO dan commit Git per milestone.
