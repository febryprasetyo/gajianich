# Implementation Plan: Universal Attendance Excel Import (.xls & .xlsx)

Pembaruan parser absensi agar dapat menerima file Excel biner OLE2 (`docs/21-7.xls`), file OpenXML `.xlsx`, maupun file raw BIFF legacy secara transparan.

---

## Shared Interfaces

```typescript
// frontend/src/lib/attendance/types.ts
export interface ImportRow {
  id: number;
  externalNoId: string;
  employeeId: number | null;
  employeeName: string | null;
  employeeCode: string | null;
  department: string | null;
  workDate: string; // YYYY-MM-DD
  shift: string | null;
  scheduleIn: string | null;
  scheduleOut: string | null;
  scanIn: string | null;
  scanOut: string | null;
  rawScanIn?: string | null;
  rawScanOut?: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
  reviewStatus: 'READY' | 'NEEDS_REVIEW' | 'BLOCKED' | 'SKIPPED';
  note: string;
  normalized: boolean;
}
```

Fungsi utama parser:
```typescript
// frontend/src/lib/attendance/biff.ts
export function parseAttendanceWorkbook(bytes: Uint8Array): ImportRow[];
// Alias kompatibilitas mundur:
export const parseAttendanceBiff = parseAttendanceWorkbook;
```

---

## Phase-by-Phase Tasks

### Phase 1: Unit Tests (TDD) untuk Format OLE2 & XLSX
- [ ] Buka `frontend/src/lib/attendance/biff.test.mjs`.
- [ ] Tambahkan tes untuk file nyata `docs/21-7.xls`:
  - Memverifikasi parsing 3.261 baris data sukses tanpa error.
  - Memverifikasi serial date `46285` dikonversi dengan tepat ke `2026-09-20`.
  - Memverifikasi jam scan, keterlambatan, dan jam kerja terpetakan dengan benar.
- [ ] Tambahkan tes untuk format `.xlsx` (menggunakan workbook sintetis SheetJS).
- [ ] Pertahankan 100% tes lama untuk raw BIFF agar tidak ada regresi.
- [ ] Verifikasi tes gagal (RED) sebelum parser diperbarui.

### Phase 2: Implementasi Universal Parser di `frontend/src/lib/attendance/biff.ts`
- [ ] Impor library `xlsx` (SheetJS) di `biff.ts`.
- [ ] Pisahkan parser menjadi:
  1. `isRawBiff(bytes)`: cek `bytes[0] === 9 && [0, 2, 8].includes(bytes[1])`.
  2. `parseRawBiffTable(bytes)`: logika pembaca biner BIFF record type 4 yang sudah ada.
  3. `parseSheetJsTable(bytes)`: pembaca workbook Excel untuk OLE2 (`.xls`) dan ZIP (`.xlsx`).
- [ ] Implementasikan konverter tanggal universal `parseAttendanceDate(value)`:
  - Dukung angka serial Excel (misal `46285` menggunakan `XLSX.SSF.parse_date_code`).
  - Dukung string `DD/MM/YYYY`, `YYYY-MM-DD`, dan `DD-MM-YYYY`.
  - Validasi rentang tahun 2000–2100.
- [ ] Implementasikan parser jam dan durasi fleksibel (`parseClock`, `parseMinutes`).
- [ ] Normalisasi baris menjadi array `ImportRow` dengan aturan status (`READY`, `NEEDS_REVIEW`, `SKIPPED`, `BLOCKED`).
- [ ] Export `parseAttendanceWorkbook` dan alias `parseAttendanceBiff`.
- [ ] Jalankan tes (GREEN).

### Phase 3: Pembaruan Komponen Frontend
- [ ] Buka `frontend/src/components/attendance/AttendanceImportsPage.tsx`.
- [ ] Ubah `<input type="file" accept=".xls" ... />` menjadi `accept=".xls,.xlsx"`.
- [ ] Perbarui teks modal impor:
  - Subtitle: `"Format Excel .xls atau .xlsx mesin absensi"`
  - Teks petunjuk: Menyebutkan dukungan untuk file `.xls` dan `.xlsx`.
  - Placeholder & dropzone: Menampilkan `"Pilih file .xls atau .xlsx dari mesin absensi"`.

### Phase 4: Verification Loop & Quality Gate
- [ ] Jalankan unit test frontend:
  ```bash
  npm test --prefix frontend
  ```
- [ ] Jalankan typecheck frontend:
  ```bash
  npx tsc --noEmit --project frontend/tsconfig.json
  ```
- [ ] Jalankan linter frontend:
  ```bash
  npm run lint --prefix frontend
  ```
- [ ] Jalankan build frontend:
  ```bash
  npm run build --prefix frontend
  ```
- [ ] Commit perubahan dengan conventional commit:
  `feat(attendance): support universal excel import for .xls and .xlsx files`

---

## Verification Commands
```bash
npm test --prefix frontend
npx tsc --noEmit --project frontend/tsconfig.json
npm run lint --prefix frontend
npm run build --prefix frontend
```
