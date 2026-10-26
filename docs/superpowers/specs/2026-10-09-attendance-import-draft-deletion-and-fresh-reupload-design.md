# Design Spec: Hapus Draft Impor Absensi & Unggah Ulang Draft Baru (Fresh Re-upload)

## 1. Summary & Problem Statement
Saat ini pada modul impor absensi:
1. **Retensi Draft:** File impor yang diunggah ke status DRAFT bertahan secara permanen di storage (`localStorage` / database) tanpa masa kedaluwarsa otomatis.
2. **Tidak Ada Fitur Hapus Draft:** Hanya ada tombol "Batalkan draft" (`CANCELLED`), sehingga draft lama atau salah unggah tetap menumpuk di daftar tabel impor dan tidak bisa dihapus bersih.
3. **Pencegahan Hash Kaku (Redirect ke Draft Lama):** Ketika pengguna mengunggah ulang file Excel yang sama (misalnya untuk mengulang proses pengujian dari awal), sistem mendeteksi kesamaan konten hash (`fileHash`) lalu me-reuse batch lama tanpa membuat draft baru (`action = 'Impor ditemukan kembali'`), sehingga pengguna langsung di-redirect kembali ke draft lama yang bermasalah.

Fitur ini menambahkan:
- Kemampuan menghapus draft secara permanen (**Hapus Draft**) baik dari halaman review draft maupun dari tabel daftar semua impor.
- Menghapus pembatasan reuse hash saat unggah file sehingga setiap kali pengguna mengunggah file (meskipun file yang sama persis), sistem **selalu membuatkan draft baru yang segar (*fresh draft*)** dengan baris data baru dan ID baru.

---

## 2. Goals & Non-Goals

### Goals
- **Hapus Draft Permanen:**
  - Tambahkan perintah `action: 'delete'` pada command `batch` (atau `{ type: 'delete_batch', batchId: number }`).
  - Hapus batch dari daftar `data.batches`.
  - Batch yang sudah berstatus `COMMITTED` (sudah tersimpan menjadi catatan absensi final) tidak dapat dihapus melalui fitur ini demi menjaga integritas rekap absensi. Hanya batch berstatus `DRAFT` atau `CANCELLED` yang dapat dihapus.
  - Sediakan tombol "Hapus draft" di halaman Review Impor dan tombol aksi "Hapus" pada tabel daftar semua impor.
  - Gunakan modal konfirmasi aman (`ConfirmDeleteModal`).
- **Unggah Ulang Selalu Membuat Draft Baru (*Always Fresh Draft*):**
  - Hapus logika short-circuit reuse hash pada `case 'import'` di `commands.ts`.
  - Setiap kali file diunggah via dialog impor, sistem selalu men-generate batch draft baru dengan ID unik dan timestamp terbaru.
- **Dukungan RBAC:** Hanya akun dengan hak review/tulis (`canWrite` / `canReview`) yang dapat menghapus draft impor.

### Non-Goals
- Tidak menghapus catatan final yang sudah di-commit (`COMMITTED`). Jika catatan final ingin dihapus/diubah, gunakan fitur koreksi absensi.

---

## 3. Data Model & Command Contract

Pada [`frontend/src/lib/attendance/types.ts`](frontend/src/lib/attendance/types.ts):
```typescript
export type AttendanceCommand =
  | ...
  | { 
      type: 'batch'; 
      batchId: number; 
      action: 'commit' | 'cancel' | 'reopen' | 'delete'; 
      strictIntegrity?: boolean; 
    }
  | { type: 'delete_batch'; batchId: number }
```

---

## 4. Business Logic Changes (`commands.ts`)

1. **Pada `case 'import'`:**
   - Hilangkan pengecekan `if (command.fileHash) { const existing = ...; if (existing) break; }`.
   - Setiap unggahan selalu membuat objek `batch: ImportBatch` baru di `data.batches`.
2. **Pada `case 'batch'`:**
   - Tambahkan penanganan `command.action === 'delete'` (atau `case 'delete_batch'`):
     - Validasi: Jika `batch.status === 'COMMITTED'`, lempar error: *"Batch yang sudah tersimpan final tidak dapat dihapus."*
     - Hapus dari array: `data.batches = data.batches.filter(b => b.id !== command.batchId);`
     - Catat riwayat audit: `action = 'Draft impor dihapus'; detail = batch.filename;`

---

## 5. UI/UX Changes (`AttendanceImportsPage.tsx`)

1. **Halaman Review Impor (`/dashboard/attendance/imports/[id]`):**
   - Di baris aksi header, jika `batch.status === 'DRAFT'` atau `'CANCELLED'`, tampilkan tombol **"Hapus draft"** dengan ikon tong sampah merah/slate di samping "Batalkan draft".
   - Mengklik tombol memunculkan `ConfirmDeleteModal`.
   - Setelah konfirmasi hapus: hapus batch, tampilkan pesan sukses, dan arahkan pengguna kembali ke `/dashboard/attendance/imports`.
2. **Tabel Daftar Semua Impor (`/dashboard/attendance/imports`):**
   - Pada kolom "Aksi", di samping tombol "Review" / "Lihat detail", tambahkan tombol aksi **"Hapus"** (hanya untuk batch berstatus Draft atau Dibatalkan).
