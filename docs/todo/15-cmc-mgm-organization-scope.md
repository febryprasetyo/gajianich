# 15 — Pemisahan CMC/MGM dan identitas dokumen

Status 29 Oktober 2026: **implementasi dan verifikasi selesai; aktivasi operasional menunggu konfigurasi yang disetujui**. Tidak ada deploy produksi.

## Acuan

- [Spesifikasi](../superpowers/specs/2026-10-29-cmc-mgm-organization-scope-design.md).
- [Rencana implementasi](../superpowers/plans/2026-10-29-cmc-mgm-organization-scope.md).
- [Checkpoint dan bukti verifikasi](../plan/2026-10-29-cmc-mgm-organization-scope-checkpoint.md).
- [Runbook aktivasi dan reproduksi tes](../plan/2026-10-29-cmc-mgm-rollout-runbook.md).

## Hasil

HR, GA, inventaris dan manajemen akun memeriksa permission sekaligus kelompok di server. Inventaris mengikuti Primary Facility Location; transfer lintas induk hanya SuperAdmin dengan audit. Role/status/membership dibaca ulang sehingga token lama tidak mempertahankan akses yang dicabut. Akun tanpa pegawai tidak otomatis global.

Dokumen cuti/GA menyimpan versi identitas/template dan snapshot pengajuan; database menolak penulisan ulang versi dan snapshot. Profil resmi yang belum tersedia menolak finalisasi. Aturan cuti/approval tetap sama untuk CMC/MGM.

Pemilih kelompok memakai sessionStorage per tab. Pergantian kelompok membatalkan request lama dan membersihkan state/cache; respons terlambat tidak dapat mencampur data. Tampilan ponsel 390 px, fokus keyboard, dua tab, reload dan deep-link lintas kelompok diuji di Chromium.

Migrasi 0026–0029 diterapkan pada development saja. Fingerprint 19 tabel memastikan seluruh kolom lama tetap sama: **369 karyawan dan 1.684 absensi**, termasuk ID dan relasi. Tidak ada reset, seed development, backfill historis atau provisioning spekulatif.

## Verifikasi

- Backend: **408/408**, 0 gagal/skip; typecheck lulus.
- Frontend: **217/217**, 0 gagal/skip; lint, typecheck dan build lulus.
- Browser Chromium: **2/2** dengan autentikasi/API/database nyata pada fixture disposable.
- Regresi database: kepemilikan absensi tidak dapat diganti, versi dokumen tidak dapat ditulis ulang/dihapus, role runtime dapat membaca profil, upgrade dua kali mempertahankan data lama.
- `git diff --check` lulus. Backend tidak menyediakan script lint.

## Checkpoint Git

Commit implementasi terverifikasi: `c17148e` pada `feature/cmc-mgm-organization-scope`.

- [x] 1. Preview read-only dan manifest target.
- [x] 2. Schema additive, mapping dan membership.
- [x] 3. Scope server dan autentikasi terkini.
- [x] 4. Integrasi HR, mobile dan riwayat.
- [x] 5. Manajemen pengguna tanpa eskalasi kelompok/peran.
- [x] 6. GA, file, pencarian dan histori.
- [x] 7. Inventaris berdasarkan lokasi dan transfer berizin.
- [x] 8. Profil dokumen berversi dan snapshot identitas.
- [x] 9. UI kelompok, cache dan isolasi antar-tab.
- [x] 10a. Verifikasi lintas modul, rekonsiliasi dan runbook.
- [ ] 10b. Aktivasi operasional/produksi setelah konfigurasi dan persetujuan terkait lengkap.

## Gerbang aktivasi

Katalog, mapping dan membership development masih kosong. Daftar enam organisasi/identitas/logo/template resmi dan alokasi akun HR/GA belum diberikan. Jangan mengarangnya atau mengganti template MGM dengan CMC. Manifest produksi belum tersedia.

Preview historis lama menunjukkan 1.657 absensi terkait departemen CMC dan 27 MGM. Penguncian pemilik berdasarkan departemen sekarang belum dikonfirmasi; metadata tetap null dan hanya tersedia untuk review SuperAdmin. Keputusan ini tidak mengubah data absensi final.

D1 inventaris per induk dan D2 kebijakan cuti sama selesai. D3 identitas/template, D4 manifest/provisioning dan D6 bukti historis tetap gerbang aktivasi. Kebijakan HR SuperAdmin tidak diperluas.
