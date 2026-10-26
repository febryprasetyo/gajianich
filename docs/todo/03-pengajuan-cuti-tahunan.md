# Prioritas 3: Perhitungan dan Form Pengajuan Cuti Tahunan (F4)

- **Status**: Selesai
- **Terakhir Diperbarui**: 2026-10-20
- **Referensi Spec**: 
  - [Design Spec Form Cuti](../superpowers/specs/2026-10-09-leave-request-form-design.md)
  - [Design Spec Master Cuti & Pengaturan](../superpowers/specs/2026-10-14-master-cuti-settings-design.md)
  - [Design Spec Refinement Modul Cuti](../superpowers/specs/2026-10-19-leave-module-refinement-design.md)
  - [Design Spec Edit Permohonan Cuti](../superpowers/specs/2026-10-19-edit-leave-request-design.md)
- **Referensi Plan**: 
  - [Implementation Plan Form Cuti](../superpowers/plans/2026-10-09-leave-request-form.md)
  - [Implementation Plan Master Cuti](../superpowers/plans/2026-10-14-master-cuti-settings.md)
  - [Implementation Plan Refinement Modul Cuti](../superpowers/plans/2026-10-19-leave-module-refinement.md)
  - [Implementation Plan Edit Cuti](../superpowers/plans/2026-10-19-edit-leave-request.md)

## Tujuan
Mengelola kuota cuti tahunan per karyawan, pengajuan cuti, formulir cetak standar F4, pengaturan hak cuti bersama dari HRD, rekapitulasi saldo rill karyawan, proteksi boundary tahun kalender, serta fitur pengeditan permohonan cuti yang berstatus pending.

## Ruang Lingkup
- Konfigurasi kuota dasar (default 12 hari) dan kalender cuti bersama oleh HRD terintegrasi secara rill.
- Saldo cuti per karyawan: kuota dasar, potongan cuti bersama, cuti pribadi yang disetujui, dan sisa saldo bersih.
- Form pengajuan cuti karyawan: searchable employee picker (mirip Assigned Custodian), pilihan rentang tanggal otomatis atau input manual hari cuti, serta penyesuaian layout sesuai tema standar (`employees/new`).
- Filter permohonan cuti per tahun kalender berjalan dan validasi batas tahun (tidak boleh lintas tahun kalender / tahun lampau).
- Cetak dokumen resmi format ukuran kertas F4 full-page dengan tombol "Print" bertema Emerald dan pratinjau formulir (View).
- Fitur Edit Permohonan Cuti: Mengedit permohonan berstatus PENDING dengan penyesuaian delta kuota cuti tahunan secara transaksional (`db.transaction`).
- Pembersihan elemen navigasi & tombol redundan (penghapusan tombol "Muat Ulang" dan penghapusan halaman "Akses Absensi").

## Kriteria Selesai
- [x] HRD dapat mengatur kalender cuti dan melihat dampaknya terhadap saldo karyawan secara real-time.
- [x] Karyawan dapat melihat saldo yang sama dengan perhitungan sistem sebelum mengajukan.
- [x] Cuti bersama dan cuti pribadi tidak dihitung minus atau ganda pada tabel rekap.
- [x] Form input mendukung pemilihan nama karyawan, tanggal, hitungan hari, dan dokumen pratinjau F4.
- [x] Navigasi sidebar terisolasi aktif sesuai rute menu (`/dashboard/leaves`, `/dashboard/leaves/balances`, `/dashboard/leaves/settings`).
- [x] Permohonan berstatus PENDING dapat diedit dan menyesuaikan kuota sisa secara transaksional; permohonan non-PENDING dikunci (403 Forbidden).
- [x] Verifikasi menyeluruh end-to-end alur cuti & seluruh unit test lulus 100%.

## Checkpoint Git
- [x] `b6de722` feat(leaves): add database schema and migrations for leave requests and holidays
- [x] `22a530f` feat(leaves): implement leave calculation domain, controller, and routes
- [x] `602c49c` feat(leaves): implement leave request form, management page, and F4 full-page print document
- [x] `ab00d43` fix(leaves): support manual leave days input, blank handwritten handover, and fix employee dropdown
- [x] `11637f3` fix(leaves): route client leave API calls through v1 proxy
- [x] `addf00a` feat(leaves): unify UI template with employee directory standard and add design guide
- [x] `204b57e` fix(leaves): refine sidebar active state, view action, print styling, form layout, and date picker
- [x] `d860457` feat(leaves): implement searchable employee picker, real leave config integration, and history replace on submit
- [x] `422c1c5` fix(leaves): initialize manual duration as empty and show accurate remaining estimate
- [x] `96d7742` fix(leaves): remove minus signs in recap table, clean up subtitles, fix leave history scoping, and rename submit button
- [x] `1d604fc` feat(leaves): enforce strict annual boundary and reject cross-year or past-year leave requests
- [x] `f669aca` feat(leaves): add annual year filter to leave requests list and remove refresh button
- [x] `5068f71` refactor(leaves): remove refresh buttons from leave balances and settings pages
- [x] `0389f89` feat(attendance): remove unused Akses Absensi page and navigation item
- [x] `1aa101f` feat(leaves): implement edit pending leave request with balance delta adjustment
- [x] `0dfd111` feat(leaves): implement refined F4 leave document live view with detailed date ranges
