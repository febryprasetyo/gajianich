# Task Plan: Natural Copywriting + Server & VPS + Domain & Hosting Monitoring

- **Tanggal Dokumen:** 2026-11-02
- **Spec Terkait:** `docs/superpowers/specs/2026-11-02-servers-and-domain-subscriptions-monitoring-design.md`
- **Status:** APPROVED BY USER - Dalam Eksekusi

---

## 1. Phase-by-Phase Checklist

### Phase 1: Penyesuaian Copywriting Alami (Anti-Kaku) & Update Routes
- [ ] Update `DASHBOARD_ROUTE_RULES` di `frontend/src/lib/access/routes.ts`:
  - Update nama modul alami sesuai persetujuan.
  - Tambah route rule baru:
    - `/dashboard/servers`: moduleName `'Monitoring Server & VPS'`, permission `'infrastructure.view'`
    - `/dashboard/subscriptions`: moduleName `'Monitoring Domain, Hosting & Email'`, permission `'infrastructure.view'`
- [ ] Update `ROUTE_PERMISSION_MAP` di `frontend/src/components/layout/DashboardLayout.tsx`.
- [ ] Update `navGroups` di `DashboardLayout.tsx`:
  - `Ikhtisar` -> `Dashboard` / `Beranda`
  - `Server Accurate` (`/dashboard/infrastructure`)
  - Tambah menu `Server & VPS` (`/dashboard/servers`)
  - Tambah menu `Domain & Hosting` (`/dashboard/subscriptions`)
  - Ubah istilah-istilah kaku (Presensi & Jadwal, Review Presensi, Validasi Foto Wajah, Aturan Auto-Approve, dll).
- [ ] Update test assertion di `frontend/src/lib/access/routes.test.mjs` dan verifikasi lulus.

### Phase 2: Penyesuaian Konten Halaman (Anti-Kaku)
- [ ] `MobileApprovalsPage.tsx`: Judul `Review Presensi`, tombol `Reset Filter`.
- [ ] `FaceApprovalsPage.tsx`: Judul `Validasi Foto Wajah`, modal `Validasi Foto Wajah`, tombol `Reset Filter`, tombol `Tinjau Foto`.
- [ ] `ApprovalRulesPage.tsx`: Judul `Aturan Auto-Approve`.
- [ ] `ShiftApprovalSettingsCard.tsx`: `Auto-Approve Jam Masuk`, `Auto-Approve Jam Pulang`, `Simpan Aturan`.
- [ ] `assets/page.tsx` & `AssetTable.tsx` & `AssetFilters.tsx`: `Asset Tag`, `Pemegang Aset`, `Reset Filter`, `Tambah Aset Baru`, `Impor Excel`.
- [ ] `licenses/page.tsx` & `LicenseTable.tsx`: `Lisensi Software`, `Kapasitas Lisensi (Seats)`, `Tanggal Kedaluwarsa`, `Permanen (No Expiry)`.
- [ ] `frontend/src/app/dashboard/infrastructure/page.tsx`: Judul `Monitoring Server Accurate`.

### Phase 3: Implementasi Halaman Monitoring Server & VPS (`/dashboard/servers`)
- [ ] Buat page component: `frontend/src/app/dashboard/servers/page.tsx`.
- [ ] Tambahkan kartu KPI interaktif (Total Server, Online, Offline, VPS, Fisik).
- [ ] Tambahkan Toolbar Filter (Search IP/Hostname, Filter Tipe, Filter Status, Reset).
- [ ] Tambahkan tabel server responsif dengan IP, OS, Uptime, Provider, Spesifikasi, StatusBadge dot.
- [ ] Tambahkan Modal Detail Server & Modal Tambah/Koneksi Server baru.

### Phase 4: Implementasi Halaman Monitoring Domain, Hosting & Email (`/dashboard/subscriptions`)
- [ ] Buat page component: `frontend/src/app/dashboard/subscriptions/page.tsx`.
- [ ] Tambahkan kalkulasi otomatis sisa hari (countdown expiration).
- [ ] Tambahkan kartu KPI interaktif (Total Layanan, Segera Expired <30 Hari, Sudah Expired, Layanan Aman).
- [ ] Tambahkan badge warning jatuh tempo (Merah <7 hari/expired, Kuning <30 hari, Hijau aman).
- [ ] Tambahkan filter kategori (Domain, Hosting, Email Bisnis, SSL) dan pencarian nama/provider.
- [ ] Tambahkan Modal Detail / Tambah Layanan Langganan (Registrar, tgl mulai, tgl kedaluwarsa, biaya, siklus tagihan, PIC).

### Phase 5: Verification & Quality Gate
- [ ] Jalankan unit test `routes.test.mjs`: `cd frontend && npx tsx --test src/lib/access/routes.test.mjs`.
- [ ] Jalankan full test suite: `cd frontend && npm test`.
- [ ] Jalankan static analysis: `cd frontend && npx tsc --noEmit`.
- [ ] Commit rapi dengan conventional commits.

