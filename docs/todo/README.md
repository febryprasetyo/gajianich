# Roadmap & Todo Pengembangan Fitur GAJIANICH

Dokumen ini adalah **indeks utama roadmap**. Setiap item prioritas dipecah ke berkas terpisah untuk efisiensi konteks dan token. Rincian arsitektur teknis merujuk langsung ke dokumen [Design Spec](../superpowers/specs/) dan [Implementation Plan](../superpowers/plans/).

---

## Ringkasan Prioritas & Status

| No | Inisiatif / Fitur | Status | File Detail | Spec / Plan |
|---|---|---|---|---|
| **01** | Asset Management Dashboard & Role Landing | **Selesai** | [01-asset-management-dashboard.md](./01-asset-management-dashboard.md) | [Spec](../superpowers/specs/2026-10-08-asset-dashboard-role-landing-design.md) \| [Plan](../superpowers/plans/2026-10-08-asset-dashboard-role-landing.md) |
| **02** | HR Reconciliation Manual Employee Filter | **Selesai** | [02-hr-reconciliation-filter.md](./02-hr-reconciliation-filter.md) | [Spec](../superpowers/specs/2026-10-08-hr-reconciliation-manual-user-filter-design.md) \| [Plan](../superpowers/plans/2026-10-08-hr-reconciliation-manual-user-filter.md) |
| **03** | Perhitungan, Form Cuti F4, Master Saldo & Edit Cuti | **Selesai** | [03-pengajuan-cuti-tahunan.md](./03-pengajuan-cuti-tahunan.md) | [Spec](../superpowers/specs/2026-10-19-edit-leave-request-design.md) \| [Plan](../superpowers/plans/2026-10-19-edit-leave-request.md) |
| **04** | Attendance Engine Hardening, DB Sync & Strict Toggle | **Selesai** | [04-attendance-engine-hardening.md](./04-attendance-engine-hardening.md) | [Spec](../superpowers/specs/2026-10-09-attendance-db-persistence-design.md) \| [Plan](../superpowers/plans/2026-10-09-attendance-db-persistence.md) |
| **05** | Perombakan Aktivitas Absensi untuk Audit HR | **Selesai** | [05-audit-aktivitas-hr.md](./05-audit-aktivitas-hr.md) | [Spec](../superpowers/specs/2026-10-12-hr-activity-audit-design.md) \| [Plan](../superpowers/plans/2026-10-12-hr-activity-audit.md) |
| **06** | Sistem Tiket Helpdesk IT | **Selesai** | [06-helpdesk-tiket-it.md](./06-helpdesk-tiket-it.md) | [Spec](../superpowers/specs/2026-10-12-helpdesk-ticket-design.md) \| [Plan](../superpowers/plans/2026-10-12-helpdesk-ticket.md) |
| **07** | Presensi Mobile PWA Karyawan & Backend Integrasi | **Selesai** | [07-presensi-mobile-pwa.md](./07-presensi-mobile-pwa.md) | [Spec](../superpowers/specs/2026-10-22-mobile-attendance-backend-design.md) \| [Plan](../superpowers/plans/2026-10-22-mobile-attendance-backend.md) |
| **08** | Arsitektur Modular Package-by-Feature (Screaming Architecture) & Drizzle | **Rencana** | [08-arsitektur-modular-package-by-feature.md](./08-arsitektur-modular-package-by-feature.md) | [Spec](../superpowers/specs/2026-10-23-modular-architecture-migration-design.md) \| [Plan](../superpowers/plans/2026-10-23-modular-architecture-migration.md) |
| **09** | Perbaikan Hasil Audit Presensi Mobile | **Selesai** | [Checklist](#perbaikan-hasil-audit-presensi-mobile) | [Spec](../superpowers/specs/2026-10-23-mobile-attendance-audit-fixes-design.md) \| [Plan](../superpowers/plans/2026-10-23-mobile-attendance-audit-fixes.md) |
| **10** | Smart Clock Selection (Pilihan Masuk vs Pulang) | **Selesai** | [10-smart-clock-selection.md](./10-smart-clock-selection.md) | [Spec](../superpowers/specs/2026-10-23-smart-clock-selection-design.md) \| [Plan](../superpowers/plans/2026-10-23-smart-clock-selection.md) |
| **11** | Notifikasi HRD & Pemisahan Halaman Approval (Absensi, Foto & Pengaturan) | **Selesai** | [11-notifikasi-hrd-dan-pemisahan-halaman-approval.md](./11-notifikasi-hrd-dan-pemisahan-halaman-approval.md) | [Spec](../superpowers/specs/2026-10-26-hrd-approval-notifications-and-page-split-design.md) \| [Plan](../superpowers/plans/2026-10-26-hrd-approval-notifications-and-page-split.md) |
| **12** | Download Presensi Mesin Absensi & Kalkulasi Shift (Solution Pattern) | **Dalam Proses** | [12-download-presensi-mesin-dan-kalkulasi-shift.md](./12-download-presensi-mesin-dan-kalkulasi-shift.md) | [Spec](../superpowers/specs/2026-10-27-attendance-machine-sync-design.md) \| [Plan](../superpowers/plans/2026-10-27-attendance-machine-sync.md) |
| **13** | Master Desain Standar Global (Desktop & Future Pages) | **Selesai** | [13-master-desain-standar-global.md](./13-master-desain-standar-global.md) | [Spec](../superpowers/specs/2026-10-27-master-design-standard-design.md) \| [Plan](../superpowers/plans/2026-10-27-master-design-standard.md) |
| **14** | Rebranding Total: Penggantian Kata ams & ams-app ke gajianich | **Selesai** | [14-rebrand-ams-ke-gajianich.md](./14-rebrand-ams-ke-gajianich.md) | [Spec](../superpowers/specs/2026-10-28-replace-ams-with-gajianich-design.md) \| [Plan](../superpowers/plans/2026-10-28-replace-ams-with-gajianich.md) |
| **15** | Pemisahan CMC/MGM, Cakupan Akses & Identitas Dokumen | **Implementasi terverifikasi; menunggu aktivasi** | [15-cmc-mgm-organization-scope.md](./15-cmc-mgm-organization-scope.md) | [Spec](../superpowers/specs/2026-10-29-cmc-mgm-organization-scope-design.md) \| [Plan](../superpowers/plans/2026-10-29-cmc-mgm-organization-scope.md) |
| **16** | Kalkulasi Toleransi Keterlambatan Presensi (Late Tolerance) | **Selesai** | [16-kalkulasi-toleransi-keterlambatan.md](./16-kalkulasi-toleransi-keterlambatan.md) | [Spec](../superpowers/specs/2026-11-03-late-tolerance-calculation-design.md) \| [Plan](../superpowers/plans/2026-11-03-late-tolerance-calculation.md) |
| **17** | Performance Caching (Redis + Frontend SWR) | **Selesai** | [17-performance-caching.md](./17-performance-caching.md) | [Spec](../superpowers/specs/2026-11-04-performance-caching-design.md) \| [Plan](../superpowers/plans/2026-11-04-performance-caching.md) |
| **18** | Pilihan Organisasi pada Form Cuti + Manajemen Logo Organisasi | **Selesai** | [18-pilihan-organisasi-form-cuti.md](./18-pilihan-organisasi-form-cuti.md) | [Spec](../superpowers/specs/2026-11-04-leave-form-organization-select-design.md) \| [Plan](../superpowers/plans/2026-11-04-leave-form-organization-select.md) |

---

Catatan desain 05 November 2026: konsep Figma presensi mobile empat layar telah diperiksa secara visual dan melalui audit overflow. [Checkpoint desain](../plan/2026-11-05-mobile-attendance-figma-checkpoint.md).

Catatan desain 06 November 2026: revisi Figma menggabungkan alur GAJIANICH, status HRD dan kamera fullscreen; delapan layar utama sudah diperiksa. Validasi akhir tambahan state tertunda karena limit Figma Starter. [Checkpoint revisi](../plan/2026-11-06-mobile-attendance-figma-revision-checkpoint.md).

Catatan implementasi mobile 06 November 2026: desain baru terintegrasi pada beranda, riwayat, profil dan kamera fullscreen; sapaan personal tanpa judul berulang. Verifikasi lokal: typecheck, lint terarah, 254 unit test dan 8 browser test lulus. Belum deploy produksi. [Checkpoint integrasi](../plan/2026-11-06-mobile-attendance-design-integration.md).

Perbaikan mobile 06 November 2026: periode riwayat mengikuti siklus rekap 21–20 dan nama bulan awal; indikator Next.js yang menutupi tap Beranda dinonaktifkan. Verifikasi: 26 tes backend, 255 unit test frontend, 3 browser test, typecheck dan lint terkait lulus. [Checkpoint periode & Beranda](../plan/2026-11-06-mobile-payroll-period-home-checkpoint.md).

Koreksi konteks mobile 06 November 2026: presensi mesin kantor tampil Tercatat; review HRD hanya untuk pengajuan luar kantor. Tidak ada lagi badge Belum diajukan untuk kehadiran kantor. Verifikasi 256 unit test frontend, 17 tes backend, 8 tes browser, typecheck dan lint terkait lulus. [Checkpoint makna presensi](../plan/2026-11-06-mobile-office-attendance-meaning-checkpoint.md).

PWA 06 November 2026: konfigurasi fullscreen/standalone, scope autentikasi, safe-area dan ikon instalasi diperbaiki. Verifikasi 258 unit test, 4 simulasi browser, typecheck dan lint lulus. Masih perlu deploy HTTPS dan validasi instalasi fisik. [Checkpoint PWA fullscreen](../plan/2026-11-06-installed-pwa-fullscreen-checkpoint.md).

## Aturan Sesi & Tracking Fitur (WAJIB)

1. **Awal setiap sesi**: agen WAJIB membaca README ini (tabel status) sebelum melakukan pekerjaan apa pun, lalu membuka file detail inisiatif yang relevan.
2. **Fitur baru**: sebelum menulis kode, agen WAJIB:
   - Membuat file detail `NN-<nama-fitur>.md` memakai template bagian D, berisi ringkasan fitur, lingkup, dan checkpoint.
   - Menambahkan satu baris baru pada tabel Ringkasan Prioritas & Status dengan status **Rencana** (nomor berurutan, tautan File Detail serta Spec/Plan).
3. **Selama pengerjaan**: ubah status menjadi **Dalam Proses** saat checkpoint pertama dimulai, dan centang `[x]` per checkpoint sesuai aturan bukti.
4. **Selesai**: setelah Definition of Done terpenuhi, tandai checkpoint `[x]` dan ubah status di tabel menjadi **Selesai** pada sesi yang sama. Dilarang menutup sesi dengan status tabel yang tidak sesuai kondisi aktual.
5. **Perubahan kecil/perbaikan bug** tanpa fitur baru: cukup centang checkpoint terkait, atau catat satu baris di file detail inisiatif induknya.

---

## Aturan Baku Kerja Hemat Token (WAJIB)

### A. Membaca
1. Status global: baca HANYA tabel di atas. Jangan buka file lain.
2. Mengerjakan fitur: buka HANYA file detail fitur aktif (kolom "File Detail"). Spec/Plan dibuka hanya bila checklist merujuk bagian tertentu.
3. Jangan membaca ulang file yang sudah dibaca dalam sesi yang sama. Gunakan `grep -n` / rentang baris (`StartLine`/`EndLine`) untuk file >200 baris.
4. Jangan memuat seluruh log/output tes. Gunakan `| tail -n 30` atau `grep -E "FAIL|Error|✗"`.
5. Satu sesi = satu inisiatif. Jangan menyentuh inisiatif lain kecuali ada ketergantungan eksplisit.

### B. Mengerjakan
1. Ambil HANYA satu checkpoint `[ ]` paling atas yang belum selesai. Selesaikan, verifikasi, commit, baru lanjut.
2. Tiap checkpoint wajib spesifik: file target, perilaku yang diharapkan, perintah verifikasi. Contoh format:
   `- [ ] CP-xx: <aksi> di `path/file.ts` → hasil: <perilaku> → verifikasi: `<perintah>``
3. Tulis tes gagal dulu (TDD), jalankan hanya tes terkait (`npx vitest run <path>`), bukan seluruh suite, sampai checkpoint akhir.
4. Suite penuh (`tsc --noEmit`, lint, `npm test`) dijalankan sekali di akhir fase/inisiatif, bukan per edit.
5. Gunakan edit terarah; jangan menulis ulang file penuh untuk perubahan kecil.
6. Jangan merombak halaman/modul lain di luar lingkup checkpoint.

### C. Melapor & Mencatat
1. Laporan akhir maksimal: apa berubah, bukti verifikasi (1 baris per perintah), sisa pekerjaan. Tanpa mengulang isi dokumen.
2. Update status HANYA di dua tempat: file detail (centang `[x]` + hash commit) dan sel Status pada tabel. Jangan menyalin ulang isi ke dokumen lain.
3. Centang `[x]` hanya setelah tes relevan lulus dan commit lokal terverifikasi; format bukti: `[x] CP-xx — <hash> — <perintah> lulus`.
4. Status **Selesai** hanya bila seluruh kriteria selesai teruji.

### D. Template File Detail Inisiatif Baru
```md
# NN – <Judul>
Status: Rencana | Dalam Proses | Selesai
Spec: <link> | Plan: <link>
Lingkup: <file/modul yang boleh diubah>  |  Di luar lingkup: <...>

## Checkpoint
- [ ] CP-01: <aksi> di `path` → <hasil> → verifikasi: `<perintah>`
## Kriteria Selesai
- [ ] <kriteria terukur>
```

---

### Aturan Penyelesaian (Definition of Done)

Inisiatif atau checkpoint dinyatakan selesai hanya bila SEMUA terpenuhi:

1. Perubahan kode sudah diterapkan sesuai lingkup checkpoint.
2. Tes relevan lulus, ditambah `tsc --noEmit` dan lint tanpa error pada akhir fase.
3. Bukti dicatat di file detail: `[x] CP-xx — <hash commit> — <perintah> lulus`.
4. Commit atomik dengan conventional commits sudah dibuat dan terverifikasi lokal.
5. Sel Status pada tabel di atas dan file detail sudah diperbarui.

Ketentuan tambahan:
- Pengujian integrasi memakai database disposable, bukan database utama.
- Migrasi database utama dan deployment bukan bagian dari checkpoint kode. Keduanya butuh persetujuan eksplisit dan dicatat sebagai checkpoint terpisah.
- Hasil tes hijau saja bukan bukti selesai. Setiap kriteria di file detail harus dicentang dengan bukti.
- Status "menunggu aktivasi" dipakai bila implementasi sudah terverifikasi tetapi migrasi atau deployment belum dijalankan.

Catatan penyimpanan: direktori `docs` diabaikan Git (`/docs/`). Untuk commit atau PR, tambahkan berkas dokumentasi secara eksplisit (`git add -f <file>`) tanpa mengubah aturan ignore global.
