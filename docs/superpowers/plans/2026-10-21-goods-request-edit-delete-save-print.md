# Implementation Plan: Direct Save & Print, Edit, and Delete for Goods Requests (GA)

- **Date:** 2026-10-21
- **Status:** COMPLETED (Selesai & Terverifikasi di ba5d51f, f03f3a9)
- **Target Spec:** `docs/superpowers/specs/2026-10-21-goods-request-edit-delete-save-print-design.md`

---

## 1. Shared Types & Helpers

1. Helper `isRequestEditable(status: string): boolean`:
   - Lokasi: `frontend/src/lib/ga/goodsRequestStatus.ts` & `backend/src/lib/goodsRequestStatus.ts` (atau di route backend).
   - Aturan: `!['approved', 'ordered', 'delivered', 'completed', 'cancelled'].includes(status)`.

---

## 2. Phase-by-Phase Tasks

### Phase 1: Backend Endpoints & Automated Tests
- [x] Buat unit/integration test untuk `DELETE /api/v1/ga/requests/:id`:
  - Lolos jika status `draft` / `ready_to_print`.
  - Ditolak (`403 Forbidden`) jika status `approved`.
- [x] Implementasikan handler `DELETE /api/v1/ga/requests/:id` di `backend/src/routes/goodsRequestRoutes.ts`.
- [x] Buat unit/integration test untuk `PUT /api/v1/ga/requests/:id`:
  - Lolos update data jika status belum `approved`.
  - Ditolak (`403 Forbidden`) jika status `approved`.
- [x] Implementasikan handler `PUT /api/v1/ga/requests/:id` di `backend/src/routes/goodsRequestRoutes.ts`.
- [x] Verifikasi backend tests: `npm test` di `backend/`.

### Phase 2: Direct Save & Print Workflow
- [x] Di `frontend/src/components/ga/GoodsRequestForm.tsx`:
  - Tambahkan tombol aksi **"Simpan & Cetak"** (Primary, Icon `Printer` + `Save`).
  - Ubah tombol simpan draft menjadi aksi sekunder.
  - Saat klik "Simpan & Cetak", setelah request berhasil dibuat, redirect ke `/dashboard/ga/requests/[id]?autoPrint=true`.
- [x] Di `frontend/src/components/ga/GoodsRequestDetail.tsx`:
  - Tangkap parameter URL `autoPrint=true`.
  - Saat dokumen dan seluruh lampiran gambar selesai di-load (`!imageLoading && !imageError`), jalankan otomatis `window.print()`.

### Phase 3: Edit & Delete Menu in Frontend
- [x] Di `frontend/src/lib/ga/goodsRequestStatus.ts`:
  - Ekspor fungsi `isRequestEditable(status: string): boolean`.
  - Tulis unit test di `goodsRequestStatus.test.mjs`.
- [x] Di `frontend/src/components/ga/GoodsRequestDetail.tsx`:
  - Tambahkan tombol **Edit** (Icon `Pencil`) dan **Hapus** (Icon `Trash2`, variant danger) pada baris aksi header jika `isRequestEditable(request.status)`.
  - Sambungkan aksi Hapus ke `ConfirmModal` sebelum memanggil `DELETE /ga/requests/:id`.
  - Setelah berhasil dihapus, redirect ke `/dashboard/ga/requests`.
- [x] Buat rute halaman edit di `frontend/src/app/dashboard/ga/requests/[id]/edit/page.tsx`:
  - Memuat data pengajuan lalu menampilkan `GoodsRequestForm` dengan `initialData`.
- [x] Di `frontend/src/components/ga/GoodsRequestForm.tsx`:
  - Terima `initialData` dan sesuaikan submit handler untuk memanggil `PUT /ga/requests/:id` bila dalam mode edit.

### Phase 4: Verification Loop
- [x] Jalankan typecheck frontend: `./frontend/node_modules/.bin/tsc --project frontend/tsconfig.json --noEmit`.
- [x] Jalankan frontend tests: `npm run --prefix frontend test`.
- [x] Jalankan backend tests: `npm test` di `backend/`.
- [x] Pengujian manual visual di browser (verifikasi Save & Print, tombol Edit, tombol Hapus, serta penguncian saat status Approved).
