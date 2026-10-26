# Prioritas 5: Perombakan Aktivitas Absensi untuk Audit Perubahan HR

- **Status**: Selesai
- **Terakhir Diperbarui**: 2026-10-20
- **Referensi Spec**: [Pencatatan Riwayat Aktivitas HR](../superpowers/specs/2026-10-12-hr-activity-audit-design.md)
- **Referensi Plan**: [Rencana Implementasi](../superpowers/plans/2026-10-12-hr-activity-audit.md)

## Tujuan
Menyediakan riwayat audit yang lengkap untuk setiap perubahan data yang dilakukan melalui menu HR, sehingga tim HR dapat menelusuri siapa yang melakukan perubahan, kapan terjadi, aksi yang dilakukan, dan objek perubahannya.

## Ruang Lingkup
- Catat seluruh aksi mutasi data dari setiap fitur dalam menu HR (tambah, ubah, hapus, impor, hubungkan, pisahkan, setujui, tolak, batalkan, aksi massal).
- Setiap entri memuat waktu, aksi, pengguna pelaku, dan keterangan objek yang terdampak.
- Impor mencatat ringkasan hasil (sumber, jumlah berhasil, jumlah gagal, alasan kegagalan).
- Aksi hapus mencatat identitas data sebelum dihapus.
- Riwayat audit bersifat hanya-tambah (append-only), tidak dapat diedit atau dihapus dari UI.
- Filter dan pencarian berdasarkan rentang waktu, jenis aksi, pengguna, dan kata kunci objek.

## Kriteria Selesai
- [x] Semua endpoint mutasi data HR menghasilkan entri audit yang konsisten.
- [x] Login tidak dicatat pada audit data absensi/HR.
- [x] Data audit tetap ada meskipun data sumber dihapus (tahan penghapusan relasi).
- [x] Pengujian automated mencakup setiap jenis aksi utama.

## Checkpoint Git
- [x] Task 1: `275660e` — schema audit, permission, migrasi append-only; branch `feat/hr-activity-audit`.
- [x] Task 2: `4cbbfc2` — audit writer, actor resolution, sanitasi snapshot/target, idempotensi & serialisasi mutasi.
- [x] Task 3: `eb89465` — capture existing HR mutations (employee, department, location, setting, leave).
- [x] Task 4: `a563cea` — persist HR workspace commands (sources, identities, shifts, assignments, locks, grants, drafts, reviews).
- [x] Task 5: `269e236` — expose audited server commands (POST /commands, GET /workspace, RBAC, Zod validation, idempotency).
- [x] Task 6: `eb6e131` — API baca audit, filter WIB, keyset cursor, sanitasi target/actor.
- [x] Task 7: `637129e` — cutover repository ke server, hilangkan mock, hilangkan local audit.
- [x] Task 8: `4b693ba` — Halaman Riwayat Aktivitas HR (UI, filter WIB, keyset pagination, drawer detail, menu & route guard).
- [x] Task 9: `014e486` — Verifikasi lintas sistem dan panduan aktivasi (`test(hr-audit): verify full HR mutation coverage`).
- [x] Hardening: `885de9c` — Stabilisasi ref ModalShell dan kelengkapan tipe command attendance.

## Hasil Pemeriksaan & Verifikasi (2026-10-20)
- Riwayat aktivitas HR terintegrasi penuh ke server dan database PostgreSQL (append-only audit).
- Halaman UI Riwayat Aktivitas HR (`/dashboard/attendance/activity`) berfungsi dengan filter WIB, keyset cursor, dan drawer detail lengkap.
- Seluruh 238 unit & integration test backend dan 159 test frontend lulus 100%.
- Seluruh kriteria acceptance spec terpenuhi dan seluruh task (Task 1 s/d 9) terverifikasi.
