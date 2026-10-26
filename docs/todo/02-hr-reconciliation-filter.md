# Prioritas 2: HR Reconciliation Manual User/Employee Filter dan Selection

- **Status**: Selesai
- **Terakhir Diperbarui**: 2026-10-08
- **Referensi Spec**: [Design Spec](../superpowers/specs/2026-10-08-hr-reconciliation-manual-user-filter-design.md)
- **Referensi Plan**: [Implementation Plan](../superpowers/plans/2026-10-08-hr-reconciliation-manual-user-filter.md)

## Tujuan
Memberi HR cara untuk menemukan dan memilih karyawan secara manual saat hasil rekonsiliasi custodian tidak menemukan kecocokan yang tepat.

## Ruang Lingkup
- Tab untuk berpindah antara rekomendasi sistem dan pencarian karyawan manual.
- Pencarian berdasarkan nama, NIP, dan departemen.
- Pemilihan satu karyawan dari daftar hasil pencarian.
- Penanda bila karyawan yang dipilih sudah memiliki custodian aktif.
- Aksi lanjutan yang jelas: menghubungkan custodian ke karyawan atau menggunakan proses merge saat terjadi konflik.

## Kriteria Selesai
- [x] HR dapat mencari dan memilih karyawan aktif tanpa bergantung pada rekomendasi otomatis.
- [x] Konflik custodian aktif terlihat sebelum HR menyimpan perubahan.
- [x] Nilai seleksi manual dipakai oleh proses link atau merge yang sudah ada.
- [x] Interaksi tab, pencarian, pemilihan, dan penanganan konflik tercakup oleh pengujian.

## Checkpoint Git
- [x] `57018a0` feat(frontend): add HR reconciliation manual employee filter, tab switcher, and smart conflict advisory
- [x] `5ba3188` docs: mark Prioritas 2 as completed in feature roadmap
