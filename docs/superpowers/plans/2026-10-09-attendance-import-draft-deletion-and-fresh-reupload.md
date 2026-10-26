# Implementation Plan: Hapus Draft Impor Absensi & Unggah Ulang Draft Baru (Fresh Re-upload)

## 1. Overview & Objectives
Menjawab pertanyaan masa retensi draft impor absensi, menambahkan fitur **Hapus Draft** untuk batch yang berstatus DRAFT atau CANCELLED, serta meniadakan dedup file hash sehingga pengunggahan ulang file yang sama akan **selalu membuat draft baru**.

---

## 2. Tasks & Phases

### Phase 1: Domain Logic, Types & Unit Tests (TDD)
- [x] Update `frontend/src/lib/attendance/types.ts`:
  - Perbarui union `AttendanceCommand`: izinkan `action: "commit" | "cancel" | "reopen" | "delete"` pada command `batch` dan/atau `{ type: "delete_batch"; batchId: number }`.
- [x] Update `frontend/src/lib/attendance/commands.ts`:
  - Hapus short-circuit `if (command.fileHash) { const existing = ...; if (existing) break; }` pada `case "import"`. Setiap impor selalu menghasilkan draft batch baru.
  - Tambahkan penanganan `action === "delete"` (atau `case "delete_batch"`):
    - Jika `batch.status === "COMMITTED"`, lempar error penolakan.
    - Hapus batch dari `data.batches = data.batches.filter(b => b.id !== targetId)`.
    - Tambahkan entri audit log bahwa draft dihapus.
- [x] Update tests di `frontend/tests/attendance/`:
  - Perbarui `frontend/tests/attendance/domain.test.mjs`: ubah tes yang tadinya mengharapkan hash reuse menjadi ekspektasi bahwa pengunggahan ulang menghasilkan draft batch baru yang terpisah.
  - Tambahkan tes baru di `frontend/tests/attendance/strictIntegrity.test.mjs`:
    - Verifikasi hapus draft berhasil menghapus batch dari workspace.
    - Verifikasi penolakan hapus untuk batch yang sudah COMMITTED.
    - Verifikasi re-upload file yang sama membuat draft baru.

### Phase 2: UI Integration (`AttendanceImportsPage.tsx`)
- [x] Tambahkan tombol "Hapus draft" pada header detail review jika batch berstatus `DRAFT` atau `CANCELLED`.
- [x] Tambahkan tombol aksi "Hapus" pada baris tabel daftar semua file impor untuk batch `DRAFT` atau `CANCELLED`.
- [x] Integrasikan dengan `ConfirmDeleteModal` atau modal konfirmasi aman.
- [x] Arahkan navigasi ke `/dashboard/attendance/imports` setelah draft berhasil dihapus dari halaman detail review.

### Phase 3: Verification & Quality Gate
- [x] Jalankan `npm test --prefix frontend`.
- [x] Jalankan `npm run build --prefix frontend`.
- [x] Lakukan atomic commit git sesuai aturan Conventional Commits.
