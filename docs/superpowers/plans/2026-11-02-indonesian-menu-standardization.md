# Task Plan: Standarisasi Menu Navigasi & Konten Halaman 100% Bahasa Indonesia Profesional (Opsi A)

- **Tanggal Dokumen:** 2026-11-02
- **Spec Terkait:** `docs/superpowers/specs/2026-11-02-indonesian-menu-standardization-design.md`
- **Status:** COMPLETED & VERIFIED

---

## 1. Phase-by-Phase Checklist

### Phase 1: Standardisasi Route Rule, Permission Map & Unit Tests
- [x] Update `DASHBOARD_ROUTE_RULES` di `frontend/src/lib/access/routes.ts` dengan deskripsi `moduleName` Bahasa Indonesia baru.
- [x] Update `ROUTE_PERMISSION_MAP` di `frontend/src/components/layout/DashboardLayout.tsx` agar selaras dengan `routes.ts`.
- [x] Update test assertion di `frontend/src/lib/access/routes.test.mjs`.
- [x] Verifikasi pengujian Phase 1: `cd frontend && npx tsx --test src/lib/access/routes.test.mjs`.

### Phase 2: Standardisasi Sidebar Navigation Groups & Submenus
- [x] Perbarui `mainNavGroup` di `frontend/src/components/layout/DashboardLayout.tsx`:
  - `Utama` -> `Ikhtisar`, `Dashboard` -> `Dasbor Utama`
- [x] Perbarui grup `HR` dan semua submenunya (Kehadiran & Waktu, Integrasi Mesin & IoT, Persetujuan Presensi, Manajemen Cuti & Izin, Data Master Karyawan).
- [x] Perbarui grup `GA` -> `Umum & Pengadaan (GA)`, `Pengajuan Pengadaan`.
- [x] Perbarui grup `IT & Assets` -> `IT & Aset Perusahaan` (Aset Inventaris, Layanan & Operasional IT, Konfigurasi Master IT).
- [x] Perbarui grup `Pengguna & Akses` -> `Pengaturan & Keamanan`, `Akses & Peran Pengguna`.

### Phase 3: Standardisasi Konten Halaman (Judul, Sub-judul, Filter, Tabel, Tombol, Modal)
- [x] **Modul Persetujuan Presensi**:
  - `MobileApprovalsPage.tsx`: Judul `Antrean Persetujuan Presensi`, KPI `Menunggu Persetujuan`, filter status, tombol `Atur Ulang`, direct out notes, modal persetujuan.
  - `FaceApprovalsPage.tsx`: Judul `Verifikasi Swafoto Presensi`, KPI `Menunggu Verifikasi`, filter status, tombol `Verifikasi Foto`, modal verifikasi.
  - `ApprovalRulesPage.tsx`: Judul `Kebijakan Auto-Approval Presensi`, deskripsi shift.
  - `ShiftApprovalSettingsCard.tsx`: Heading kebijakan shift, label checkbox persetujuan masuk/pulang, tombol `Simpan Kebijakan`.
- [x] **Modul Kehadiran & Mesin**:
  - `AttendanceDataPage.tsx`: Judul `Rekap Kehadiran`, tombol `Impor Data Presensi`.
  - `AttendanceDevicesPage.tsx`: Judul `Terminal Mesin Presensi`, deskripsi terminal.
  - `AttendanceRawLogsPage.tsx`: Judul `Log Mentah Presensi Mesin`.
  - `AttendanceTransactionsPage.tsx`: Judul `Log Transaksi Presensi Mesin`.
- [x] **Modul IT & Assets**:
  - `assets/page.tsx`: Judul `Daftar Aset Perangkat`, tombol `Impor Massal Excel`, `Daftarkan Aset Baru`.
  - `AssetTable.tsx`: Header tabel (`Label Aset`, `Perangkat & Spesifikasi`, `Kategori`, `Lokasi`, `Penanggung Jawab`, `Kondisi`, `Status`, `Aksi`), loading & empty states.
  - `AssetFilters.tsx`: Placeholder pencarian, opsi dropdown kategori, lokasi, status (`Tersedia`, `Digunakan`, `Perbaikan / Servis`, `Dihapuskan / Afkir`), tombol `Atur Ulang Filter`.
  - `hardware-audits/page.tsx`: Judul `Audit Fisik Perangkat & Sinkronisasi`, badge pending, link tombol.
  - `licenses/page.tsx`: Judul `Katalog Lisensi Perangkat Lunak`, tombol `Tambah Lisensi Perangkat Lunak`.
  - `LicenseTable.tsx`: Header tabel (`Nama & Detail Perangkat Lunak`, `Tipe Lisensi`, `Penggunaan Kursi (Seat)`, `Masa Berlaku`, `Vendor / Pemasok`, `Status`, `Aksi`), empty states.
  - `LicenseFilters.tsx`: Placeholder dan opsi filter dropdown bahasa Indonesia.

### Phase 4: Verification & Quality Gate
- [x] Jalankan automated unit tests: `cd frontend && npm test`
- [x] Jalankan TypeScript static check: `cd frontend && npx tsc --noEmit`
- [x] Commit perubahan dengan conventional commit: `feat(copywriting): standardize menu navigation and page contents to 100% indonesian`.


---

## 2. Verification Commands

```bash
# 1. Jalankan unit test spesifik rute navigasi
cd frontend && npx tsx --test src/lib/access/routes.test.mjs

# 2. Jalankan seluruh unit test suite frontend
cd frontend && npm test

# 3. Jalankan pemeriksaan type safety
cd frontend && npx tsc --noEmit
```

