# Roadmap & Todo Pengembangan Fitur AMS

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

---

## Petunjuk Penggunaan (Token-Efficient Workflow)

1. **Melihat status global**: Cukup buka file indeks ini ([README.md](./README.md)).
2. **Mengerjakan fitur tertentu**: Buka HANYA file detail fitur tersebut (misal [08-arsitektur-modular-package-by-feature.md](./08-arsitektur-modular-package-by-feature.md)) untuk menghemat token dan fokus pada checklist & checkpoint yang sedang aktif.
3. **Aturan Checkpoint Git**:
   - Beri tanda `[x]` pada checkpoint hanya setelah commit Git terverifikasi secara lokal.
   - Status berubah menjadi **Selesai** bila semua kriteria selesai telah diuji.

---

## Perbaikan Hasil Audit Presensi Mobile

Tindak lanjut audit presensi mobile tanggal 23 Oktober 2026 berstatus **selesai dan terverifikasi**. Seluruh item perbaikan telah diimplementasikan dan diuji melalui verifikasi menyeluruh (backend unit/integration tests 309 pass, frontend unit tests 192 pass, frontend lint, typecheck tsc --noEmit, build nextjs, dan Playwright E2E browser tests).

- [Spesifikasi dan kriteria penerimaan](../superpowers/specs/2026-10-23-mobile-attendance-audit-fixes-design.md).
- [Rencana implementasi dan pengujian](../superpowers/plans/2026-10-23-mobile-attendance-audit-fixes.md).
- [Laporan verifikasi awal](../mobile-attendance-approval-verification.md), sebagai catatan historis.

### TODO

- [x] **FIX-01 / P1:** Cegah mobile IN dan proyeksi approval menimpa record mesin, impor atau manual; lindungi konflik yang muncul sebelum HRD menyetujui. Plan Task 1.
- [x] **FIX-02 / P2:** Samakan resolusi shift aktif untuk jadwal dan approval; individual nonaktif harus dapat mengikuti divisi aktif, tanpa penugasan tetap review HRD. Plan Task 2.
- [x] **FIX-03 / P2:** Pulihkan durasi riwayat mesin, termasuk shift malam; durasi mobile pending/ditolak tetap tidak dihitung. Plan Task 3.
- [x] **FIX-04 / P2:** Tampilkan error/retry terpisah untuk summary dan riwayat; cegah data periode lama tampil pada pilihan baru dan respons usang menimpa daftar. Plan Task 5.
- [x] **FIX-05 / P2:** Benarkan status beranda: tanpa pengajuan bukan Disetujui, COMPLETED bukan Belum Absen, CHECKED_IN bukan otomatis tepat waktu. Plan Task 4.
- [x] **FIX-06 / P2:** Gunakan ModalShell pada detail/koreksi; uji fokus, Escape, Tab, pencegahan penutupan saat mengirim dan isi keterangan saat gagal. Plan Task 6.
- [x] **FIX-07 / P3:** Selaraskan keterangan antrean dengan seluruh pending dan 500 keputusan terbaru. Koordinasikan pemilik MobileApprovalsPage.tsx. Plan Task 7.
- [x] **VERIFY:** Jalankan tes regresi backend/frontend, TypeScript, lint, build dan browser pada 360/390/768/1280 px; catat hasil serta batas verifikasi. Plan Task 8.

### Aturan Penyelesaian

Centang setiap item hanya setelah perubahan diterapkan, tes relevan lulus dan bukti dicatat. Pengujian integrasi memakai database disposable. Penyusunan dokumentasi ini tidak menjalankan implementasi, migrasi utama, atau deployment.

Baseline audit: 25 tes backend terkait dan 192 tes frontend lulus; tiga regresi backend tetap berhasil direproduksi pada fixture terisolasi. Baseline hijau bukan bukti TODO di atas sudah selesai.

Catatan penyimpanan: direktori `docs` saat ini diabaikan Git melalui aturan `/docs/`. Dokumen ini tersedia lokal di checkout; pengiriman melalui commit/PR perlu menyertakan berkas dokumentasi secara eksplisit tanpa mengubah aturan ignore global.

## Checkpoint Tooling — 27 Oktober 2026

Instalasi lokal REA 6.7.0 untuk Codex selesai; doctor integrasi dan handshake MCP lulus (207 tools). Restart Codex untuk memuat integrasi. Analisis native memerlukan provider tambahan. [Rincian verifikasi](../plan/2026-10-27-rea-installation-checkpoint.md). Belum dibuat commit.

## Checkpoint Presensi FI - FO Guard & Double Scan — 27 Oktober 2026

- Perbaikan database kasus 50181 (Adam Putra Jaya) tanggal 2026-10-26 selesai: `scan_in` dipulihkan ke `10:14`, `scan_out` `17:05`, dan log duplikat `17:06` ditandai `REJECTED`.
- Backend service `mobileAttendanceService.ts` mengimplementasikan resolusi FI - FO (First In - Last Out) dan guard `validateClockAllowed` untuk menolak scan masuk baru jika shift sudah lengkap.
- Frontend mobile (`/m/presensi`, `/m/beranda`, dan `PresensiRingButton`) mengunci tombol menjadi "Selesai" (disabled) ketika kehadiran hari ini sudah lengkap (`isCheckedIn && isCheckedOut`).
- Unit test `mobileAttendanceService.test.ts` lulus 5/5, typecheck backend dan frontend lulus tanpa error.

## Checkpoint Tooling Solution X900 — 27 Oktober 2026

Ghidra 12.1.4 + JDK 21, Frida, TShark/capinfos, MDB Tools dan 7-Zip tersedia; uji dekompilasi, hook fixture, pembacaan PCAP sintetis, serta MCP dari konfigurasi tersimpan lulus. [Checkpoint dan batas verifikasi](../plan/2026-10-27-solution-x900-tooling-checkpoint.md). [Panduan Att.exe Windows 11](../operations/solution-x900-analysis-guide.md) dan [paket Process Monitor portable](../operations/solution-x900-windows-tools.zip) tersedia. Analisis target serta integrasi Gajianich menunggu artefak dari PC pengguna; belum dibuat commit.

### Update Jeda 30 Menit (Cooldown & Last-Out Update) — 27 Oktober 2026
- Ditambahkan aturan jeda 30 menit (`MIN_CHECKOUT_INTERVAL_MINUTES = 30`) setelah scan masuk.
- Jika karyawan scan lagi dalam rentang < 30 menit setelah scan masuk:
  - Tombol di UI menampilkan "Sudah Masuk" dengan info sisa jeda waktu (disabled untuk absen pulang).
  - Backend menolak absen pulang sebelum 30 menit dan memperlakukannya sebagai duplikat masuk yang aman (tidak merusak jam masuk atau mengubah jadi pulang).
- Jika karyawan sudah absen pulang dan scan pulang kembali di sore/malam hari:
  - Tombol di UI beralih ke "Perbarui Pulang" (*Last Out*).
  - Backend mencatat dan mengupdate jam pulang ke scan kepulangan terbaru.
- Seluruh 8 unit test dan typecheck TypeScript lulus hijau.
