# Checkpoint Perbaikan Tes Impor Excel Frontend — 28 Oktober 2026

## Penyebab dan perubahan

Dua tes parser absensi gagal karena namespace import `xlsx` pada Node.js tidak menyediakan `SSF`, sehingga pemanggilan `parse_date_code` menghasilkan TypeError. Default import menyediakan API tersebut.

- Mengganti import pada `frontend/src/lib/attendance/biff.ts` menjadi default import, sesuai pola pada tes parser.
- Menambahkan tes regresi tanggal serial Excel berbentuk teks pada BIFF mentah. Tes ini diamati gagal dengan TypeError yang sama sebelum perbaikan.
- Mempertahankan tes file OLE2 `docs/21-7.xls` (3.261 baris) dan workbook `.xlsx` sebagai pengujian tanggal serial numerik.

## Verifikasi

Semua perintah dijalankan dari `frontend/`:

- `npm test`: 206 tes lulus, 0 gagal, 0 skipped; termasuk kedua tes yang dilaporkan gagal dan tes regresi tambahan.
- `npx tsc --noEmit --incremental false`: lulus, exit code 0.
- `npm run lint`: exit code 0, tanpa error; 5 warning `@typescript-eslint/no-unused-expressions` pada berkas hasil build yang sudah ada di `frontend/app/.next/dev/static/chunks/src_0gl-6ff._.js`.

Perubahan backend dan folder untracked `frontend/app/` yang sudah ada dipertahankan. Tidak ada perubahan halaman atau CSS. Perubahan belum di-commit.
