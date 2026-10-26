# Design Spec: Direct Save & Print, Edit, and Delete for Goods Requests (GA)

- **Date:** 2026-10-21
- **Status:** Proposed (Awaiting User Review & Approval)
- **Author:** Antigravity / Gemini SDD Engine

---

## 1. Summary & Problem Statement
Pengguna modul General Affair (GA) membutuhkan alur kerja yang lebih ringkas dan fleksibel saat mengelola pengajuan permintaan barang:
1. **Langsung Simpan & Cetak**: Saat selesai mengisi formulir, pengguna ingin opsi untuk langsung menyimpan dan secara otomatis membuka jendela print browser tanpa perlu berpindah manual dan menekan tombol cetak lagi.
2. **Menu Edit Pengajuan**: Pengajuan yang belum disetujui (`draft`, `ready_to_print`, `printed`, `submitted`) harus bisa diperbaiki/diedit jika ada kesalahan data barang, harga, atau identitas.
3. **Menu Hapus Pengajuan**: Pengajuan yang belum disetujui harus bisa dihapus jika dibatalkan atau salah buat.
4. **Proteksi Integritas Approval**: Pengajuan yang sudah berstatus **Disetujui (`approved`)** ke atas (`ordered`, `delivered`, `completed`) **TIDAK BOLEH** diedit maupun dihapus demi kepatuhan audit dan kontrol internal perusahaan.

---

## 2. Goals & Non-Goals

### Goals
- [x] Menambahkan tombol/opsi aksi **"Simpan & Cetak"** pada form pengajuan permintaan barang yang setelah submit berhasil akan langsung membuka dialog cetak (`window.print()`).
- [x] Menyediakan endpoint backend `PUT /api/v1/ga/requests/:id` untuk memperbarui data pengajuan (dengan validasi guard: hanya status sebelum `approved`).
- [x] Menyediakan endpoint backend `DELETE /api/v1/ga/requests/:id` untuk menghapus pengajuan (dengan validasi guard: hanya status sebelum `approved`).
- [x] Menambahkan tombol **Edit** dan **Hapus** pada halaman detail ([GoodsRequestDetail.tsx](file:///home/fastpec/code/ams-app/frontend/src/components/ga/GoodsRequestDetail.tsx)) dan daftar ([GoodsRequestList.tsx](file:///home/fastpec/code/ams-app/frontend/src/components/ga/GoodsRequestList.tsx)) hanya jika pengajuan belum disetujui.
- [x] Menolak operasi edit/delete di backend dengan status 403 / 400 jika pengajuan sudah berstatus `approved` atau setelahnya.
- [x] Menyediakan modal konfirmasi (`ConfirmModal`) sebelum penghapusan data untuk mencegah kesalahan klik.

### Non-Goals
- Tidak mengubah alur tanda tangan basah fisik atau format dokumen cetak A4 yang sudah disepakati.
- Tidak mengizinkan perubahan data pada pengajuan yang sudah memiliki approval sah (status `approved`, `ordered`, `delivered`, `completed`).

---

## 3. Data Model & Integrity Rules

Tabel basis data `ga_goods_requests` dan relasi cascade-nya (`ga_goods_request_items`, `ga_goods_request_attachments`, `ga_goods_request_status_logs`) sudah memiliki `onDelete: 'cascade'`.

### Status Guard Rules
```text
[ draft / ready_to_print / printed / submitted ] ──► BISA DIEDIT & DIHAPUS
                      │
           (Approval Transition)
                      ▼
[ approved / ordered / delivered / completed ]   ──► DIKUNCI (TIDAK BISA DIEDIT & DIHAPUS)
```

Fungsi helper `isRequestEditable(status: string): boolean`:
- Return `true` jika status adalah `draft`, `ready_to_print`, `printed`, atau `submitted`.
- Return `false` jika status adalah `approved`, `ordered`, `delivered`, `completed`, atau `cancelled`.

---

## 4. API Specifications

### 1. `PUT /api/v1/ga/requests/:id`
- **Method:** `PUT` (atau `PATCH`)
- **Permission:** `ga.requests.create`
- **Payload:** `multipart/form-data` dengan payload JSON `payload` + file baru `evidence` (jika ada).
- **Validasi:**
  - Cek apakah data ada di DB.
  - Cek `isRequestEditable(existing.status)`. Jika `false`, kembalikan `403 Forbidden: "Pengajuan yang sudah disetujui tidak dapat diubah."`.
  - Update data identitas, items, dan lampiran baru/existing.
  - Tambahkan log riwayat edit jika perlu.
- **Response:** `{ success: true, data: { id, version, ... } }`.

### 2. `DELETE /api/v1/ga/requests/:id`
- **Method:** `DELETE`
- **Permission:** `ga.requests.create`
- **Validasi:**
  - Cek `isRequestEditable(existing.status)`. Jika `false`, kembalikan `403 Forbidden: "Pengajuan yang sudah disetujui tidak dapat dihapus."`.
  - Hapus data dari `ga_goods_requests` (cascade hapus items & lampiran).
- **Response:** `{ success: true, message: "Pengajuan berhasil dihapus." }`.

---

## 5. Frontend UI/UX Architecture

1. **Form Pengajuan ([GoodsRequestForm.tsx](file:///home/fastpec/code/ams-app/frontend/src/components/ga/GoodsRequestForm.tsx))**:
   - Dukungan **Mode Buat (Create)** dan **Mode Edit (Edit)** melalui prop `initialData?: GoodsRequest`.
   - Tombol Aksi:
     - **Simpan & Cetak** (Tombol Utama): Menyimpan form dan redirect ke `/dashboard/ga/requests/[id]?autoPrint=true`.
     - **Simpan Draft** (Tombol Sekunder): Menyimpan tanpa langsung membuka print preview.
2. **Detail View ([GoodsRequestDetail.tsx](file:///home/fastpec/code/ams-app/frontend/src/components/ga/GoodsRequestDetail.tsx))**:
   - Jika `autoPrint=true` ada di query URL, otomatis panggil `window.print()` segera setelah gambar ter-decode.
   - Header Bar menambahkan tombol:
     - **Edit** (Icon `Pencil`): Hanya muncul jika `isRequestEditable(request.status)`. Navigasi ke `/dashboard/ga/requests/[id]/edit`.
     - **Hapus** (Icon `Trash2`, varian danger): Hanya muncul jika `isRequestEditable(request.status)`. Membuka modal konfirmasi.
3. **List View ([GoodsRequestList.tsx](file:///home/fastpec/code/ams-app/frontend/src/components/ga/GoodsRequestList.tsx))**:
   - Kolom aksi baris menambahkan opsi **Edit** dan **Hapus** (khusus baris yang belum `approved`).

---

## 6. Security & Audit Trail
- RBAC: Hak akses tetap terikat pada izin `ga.requests.create` / `ga.requests.view`.
- Proteksi server-side: Validasi status strictly enforced di backend route handler (bukan hanya menyembunyikan tombol di frontend).
- Audit trail: Status log dan riwayat perubahan tetap terjaga.
