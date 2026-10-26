# GAJIANICH HR Dedicated Landing Dashboard — Implementation Plan (Revisi)

**Tanggal:** 2026-10-01  
**Spec Referensi:** `docs/superpowers/specs/2026-10-01-hr-landing-dashboard-design.md`  
**Target URL Landing:** `/dashboard/attendance/overview`  
**Target URL Data Operasional:** `/dashboard/attendance`  

---

## 1. Summary of Changes

1. **Dedicated Landing Route**:
   - Memastikan `/dashboard/attendance/overview` aktif dengan komponen `HrOverviewPage.tsx`.
   - Mengarahkan login role HR ke `/dashboard/attendance/overview` di `frontend/src/lib/access/routes.ts`.
   - Menambahkan menu "Ringkasan HR" di sidebar navigation `frontend/src/components/layout/DashboardLayout.tsx`.
2. **Separation from Data Absensi**:
   - Membersihkan `frontend/src/components/attendance/AttendanceDataPage.tsx` agar murni memuat tabel data operasional, filter tanggal/departemen, ekspor excel, dan dialog koreksi.
3. **8 Compact KPI Metric Cards**:
   - Mengembangkan `HrTodayKpiCards.tsx` menjadi 8 indikator operasional: Karyawan Aktif, Total Hadir, Tepat Waktu, Terlambat, Pulang Awal, Lembur, Izin/Cuti, dan Missing Punch.
   - Setiap kartu memiliki deep link ke `/dashboard/attendance?condition=...`.
4. **Department Summary dengan Show More**:
   - Menambahkan toggle "Lihat Semua (N)" / "Tampilkan Lebih Sedikit" di `HrDepartmentSummary.tsx` dengan `initialVisible={4}`.

---

## 2. Phase-by-Phase Checklist

### Phase 1: Pure Functions & Route Logic
- [x] Perhitungan metrik lengkap di `frontend/src/lib/attendance/overviewMetrics.ts`.
- [x] Default redirect login HR di `frontend/src/lib/access/routes.ts` -> `/dashboard/attendance/overview`.
- [x] Unit test `frontend/src/lib/attendance/overviewMetrics.test.mjs` (PASS).
- [x] Unit test `frontend/src/lib/access/routes.test.mjs` (PASS).

### Phase 2: Komponen Tampilan Khusus Overview
- [x] Komponen `HrHeroGreeting.tsx` (sapaan personal, tanggal WIB, aksi cepat).
- [x] Komponen `HrTodayKpiCards.tsx` (8 kartu metrik padat, angka tabular, deep link).
- [x] Komponen `HrPriorityChecks.tsx` (daftar anomali yang perlu ditindaklanjuti).
- [x] Komponen `HrDepartmentSummary.tsx` (4 departemen teratas + tombol Show More toggle).
- [x] Halaman container `HrOverviewPage.tsx` di route `/dashboard/attendance/overview`.

### Phase 3: Preservasi Halaman Data Absensi
- [x] Memastikan `AttendanceDataPage.tsx` bersih dari tumpukan overview dan fokus pada tabel operasional.
- [x] Sidebar menu membedakan "Ringkasan HR" dan "Data Absensi" dengan jelas.

### Phase 4: Verification & Build
- [x] Typecheck & production build Next.js: `npm run build` (0 errors).
- [x] Seluruh unit test frontend: `npm test` (79/79 PASS).
- [x] Seluruh unit test backend: `npm test` (124/124 PASS).

---

## 3. Verification Commands

```bash
# 1. Jalankan unit test frontend
cd frontend && npm test

# 2. Jalankan build production frontend
cd frontend && npm run build
```
