# Implementation Plan: Notifikasi HRD & Pemisahan Halaman Persetujuan

**Tanggal:** 2026-10-26  
**Spesifikasi:** [docs/superpowers/specs/2026-10-26-hrd-approval-notifications-and-page-split-design.md](../specs/2026-10-26-hrd-approval-notifications-and-page-split-design.md)  
**Status:** Selesai & Terverifikasi

---

## 1. Shared Types & Antarmuka Kontrak

```ts
// Tipe respons badge counter notifikasi HRD
export interface ApprovalBadgeCountResponse {
  success: boolean;
  data: {
    pendingAttendance: number;
    pendingPhotos: number;
    totalPending: number;
  };
}
```

---

## 2. Rencana Tahapan Eksekusi (Phase-by-Phase Tasks)

### Fase 1: Backend API Badge Counter & Testing (TDD)
- [x] **Task 1.1**: Tulis unit/integration test untuk endpoint `GET /api/v1/attendance/mobile/badge-count` di `backend/src/routes/mobileApprovalAccess.integration.test.ts` (uji otorisasi `403` tanpa permission dan hitungan akurat `pendingAttendance` serta `pendingPhotos`).
- [x] **Task 1.2**: Implementasikan handler `GET /badge-count` di `backend/src/routes/mobileApprovalRoutes.ts` dengan query agregasi cepat.
- [x] **Task 1.3**: Jalankan test suite backend untuk memvalidasi endpoint.

### Fase 2: Pemisahan Halaman Approval Absensi & Approval Foto Wajah
- [x] **Task 2.1**: Refactor [MobileApprovalsPage.tsx](file:///home/fastpec/code/ams-app/frontend/src/components/attendance/MobileApprovalsPage.tsx):
  - Ekstrak antarmuka persetujuan log absensi menjadi komponen yang fokus untuk halaman `/dashboard/attendance/approvals`.
  - Ekstrak antarmuka persetujuan foto wajah menjadi komponen mandiri `FaceApprovalsPage.tsx`.
- [x] **Task 2.2**: Buat rute halaman baru [frontend/src/app/dashboard/attendance/approvals/photos/page.tsx](file:///home/fastpec/code/ams-app/frontend/src/app/dashboard/attendance/approvals/photos/page.tsx) yang memuat `FaceApprovalsPage`.
- [x] **Task 2.3**: Pindahkan tab pengaturan auto-approve shift ke halaman pengaturan [frontend/src/app/dashboard/attendance/settings/page.tsx](file:///home/fastpec/code/ams-app/frontend/src/app/dashboard/attendance/settings/page.tsx).

### Fase 3: Pembaruan Navigasi Sidebar Dashboard
- [x] **Task 3.1**: Perbarui struktur menu navigasi di [DashboardLayout.tsx](file:///home/fastpec/code/ams-app/frontend/src/components/layout/DashboardLayout.tsx):
  - Ganti label `Approval Presensi & Foto` menjadi `Persetujuan Absensi` (`/dashboard/attendance/approvals`).
  - Tambahkan item menu baru `Persetujuan Foto Wajah` (`/dashboard/attendance/approvals/photos`) dengan ikon `ScanFace`.
  - Pastikan menu `Pengaturan` di `/dashboard/attendance/settings` sudah mencakup pengaturan persetujuan shift.

### Fase 4: Implementasi Komponen Notifikasi Lonceng di Header
- [x] **Task 4.1**: Buat komponen `NotificationBell.tsx` di `frontend/src/components/layout/NotificationBell.tsx`:
  - Ikon lonceng dengan badge counter angka berwarna merah (hanya tampil jika `totalPending > 0`).
  - Popover dropdown interaktif dengan tautan langsung ke *Persetujuan Absensi* dan *Persetujuan Foto Wajah*.
  - Mekanisme polling interval 60 detik yang otomatis jeda saat tab tidak aktif (`document.hidden`).
- [x] **Task 4.2**: Pasang `NotificationBell` di header [DashboardLayout.tsx](file:///home/fastpec/code/ams-app/frontend/src/components/layout/DashboardLayout.tsx) (di samping profile dropdown) hanya bagi user yang memiliki permission `attendance.mobile.verify`.

### Fase 5: Verifikasi Menyeluruh & Testing Loop
- [x] **Task 5.1**: Jalankan TypeScript check frontend: `npx tsc --noEmit` di `frontend/`.
- [x] **Task 5.2**: Jalankan test suite frontend: `npm test` di `frontend/`.
- [x] **Task 5.3**: Jalankan build Next.js: `npm run build` di `frontend/`.
- [x] **Task 5.4**: Git commit seluruh perubahan dengan conventional commit:
  `feat(attendance): add HRD approval notifications bell and split approval pages`

---

## 3. Verification Commands

```bash
# Backend test
cd backend && npm test -- src/routes/mobileApprovalAccess.integration.test.ts

# Frontend typecheck & test
cd frontend && npx tsc --noEmit
cd frontend && npm test
cd frontend && npm run build
```
