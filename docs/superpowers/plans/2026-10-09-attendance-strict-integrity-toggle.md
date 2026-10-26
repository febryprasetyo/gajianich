# Implementation Plan: Opsi Toggle Integritas Data Ketat (Strict Integrity) pada Impor Absensi

Menambahkan opsi switch/toggle "Integritas Ketat (Strict Integrity)" pada halaman Review Impor Absensi dan memperbarui handler commit batch agar pengujian/upload data banyak dapat langsung disimpan tanpa review manual satu per satu, dengan tetap mencegah duplikasi tanggal ganda.

---

## Shared Interfaces

```typescript
// frontend/src/lib/attendance/types.ts

export interface ImportBatch {
  id: number;
  filename: string;
  sourceId: number;
  fileHash?: string;
  createdAt: string;
  status: 'DRAFT' | 'COMMITTED' | 'CANCELLED';
  rows: ImportRow[];
  strictIntegrity?: boolean; // Default true jika tidak ada
}

export type AttendanceCommand =
  | ...
  | { 
      type: 'batch'; 
      batchId: number; 
      action: 'commit' | 'cancel' | 'reopen'; 
      strictIntegrity?: boolean;
    }
  | { 
      type: 'toggle_strict_integrity'; 
      batchId: number; 
      enabled: boolean; 
    };
```

---

## Phase-by-Phase Tasks

### Phase 1: Unit Tests (TDD) untuk Strict vs Lenient Batch Commit
- [x] Buka `frontend/src/lib/attendance/domain.test.mjs` (atau buat file tes baru `frontend/src/lib/attendance/strictIntegrity.test.mjs`).
- [x] Tambahkan tes untuk:
  1. `strictIntegrity: true` (default): batch yang memiliki baris `NEEDS_REVIEW` atau `BLOCKED` tetap melempar error saat commit.
  2. `strictIntegrity: false`: batch yang memiliki baris `NEEDS_REVIEW` langsung berhasil di-commit ke `records`.
  3. Baris dengan karyawan `null` otomatis ditandai `SKIPPED` saat `strictIntegrity: false`.
  4. Baris dengan tanggal ganda untuk karyawan yang sama **tetap tidak disimpan ganda**, melainkan otomatis dilewati (`SKIPPED`).
- [x] Jalankan `npm test --prefix frontend` dan pastikan tes baru gagal terlebih dahulu (RED).

### Phase 2: Perubahan Core Domain Logic (`commands.ts` & `types.ts`)
- [x] Perbarui `frontend/src/lib/attendance/types.ts`:
  - Tambahkan `strictIntegrity?: boolean` pada `ImportBatch`.
  - Tambahkan `strictIntegrity?: boolean` pada command `batch` dan command `toggle_strict_integrity`.
- [x] Perbarui `applyCommand` di `frontend/src/lib/attendance/commands.ts`:
  - Tangani `toggle_strict_integrity`: mengubah properti `strictIntegrity` pada batch draft.
  - Tangani `batch` commit ketika `strictIntegrity === false`:
    - Lewati pengecekan `blocking`.
    - Otomatis lewati baris tanpa karyawan atau baris duplikat.
    - Simpan semua baris valid ke dalam `data.records`.
- [x] Jalankan `npm test --prefix frontend` dan pastikan tes berhasil (GREEN).

### Phase 3: Frontend UI (`AttendanceImportsPage.tsx`)
- [x] Tambahkan toggle switch UI "Integritas Ketat (Strict Integrity)" di atas tabel atau samping action bar.
- [x] Ketika dimatikan (Strict Integrity OFF):
  - Tombol **"Simpan absensi"** aktif selama ada baris valid yang terpetakan.
  - Tampilkan banner pemberitahuan yang jelas bahwa mode cepat aktif dan duplikat akan dilewati otomatis.
- [x] Hubungkan aksi toggle dengan command `toggle_strict_integrity` atau kirimkan `strictIntegrity: false` saat modal konfirmasi konfirmasi simpan absensi.

### Phase 4: Verification Loop & Quality Check
- [x] Jalankan unit test frontend: `npm test --prefix frontend`.
- [x] Jalankan build frontend: `npm run build --prefix frontend`.
- [x] Uji secara manual alur UI dengan file `21-7.xls` yang memiliki 3.261 baris.
- [x] Git commit dengan conventional commit sesuai aturan proyek.
