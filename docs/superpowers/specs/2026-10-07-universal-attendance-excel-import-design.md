# Design Spec: Universal Attendance Excel Import (.xls & .xlsx)

## 1. Summary & Problem Statement
Saat ini modul impor absensi karyawan hanya menerima *raw unencapsulated BIFF stream* (file dengan byte awal `0x09` seperti `asd.xls`). Ketika tim HRD mengunggah file ekspor langsung dari aplikasi/mesin absensi (`docs/21-7.xls`), sistem gagal memproses dan memunculkan error:
`"Gunakan file .xls BIFF mesin absensi dengan format seperti asd.xls."`

File ekspor HRD `docs/21-7.xls` adalah file Excel biner berformat standar **OLE2 / Compound Document Format (`CDFV2`)** (byte awal `0xD0 0xCF 0x11 0xE0`) yang berisi 3.262 baris data nyata. Selain itu, pengguna HRD juga kerap menggunakan format `.xlsx` (OpenXML) atau file yang sempat diedit/disimpan ulang di Microsoft Excel.

Fitur ini memperbarui parser dan modal impor absensi agar dapat menerima semua variasi file Excel (`.xls` OLE2, `.xlsx` OpenXML, dan *legacy raw BIFF*), membaca kolom absensi secara fleksibel, mengonversi nilai tanggal serial Excel maupun teks tanggal, serta menormalisasi baris absensi ke dalam format `ImportRow` yang sudah ada.

---

## 2. Goals & Non-Goals

### Goals
- **Mendukung format file ganda**: Menerima file biner `.xls` (baik OLE2 CDFV2 standar maupun raw BIFF mesin absensi) dan `.xlsx` (OpenXML).
- **Kompatibilitas mundur penuh**: Tetap mendukung file fixture legacy/raw BIFF (`asd.xls`) tanpa merusak tes yang sudah ada di `biff.test.mjs`.
- **Parsing Tanggal Universal**: Mendukung serial date number Excel (seperti `46285` $\rightarrow$ `2026-09-20`), teks berformat `DD/MM/YYYY`, `YYYY-MM-DD`, maupun objek `Date`.
- **Parsing Jam & Durasi Fleksibel**:
  - Kolom jam (`Jam Masuk`, `Jam Pulang`, `Scan Masuk`, `Scan Pulang`) menerima format string `HH:mm` maupun serial waktu pecahan Excel.
  - Kolom durasi (`Terlambat`, `Plg. Cepat`, `Lembur`) menerima format `HH:mm` maupun angka menit/jam.
  - Kolom opsional yang kosong/hilang di-fallback secara aman (default 0 menit untuk durasi, null untuk scan).
- **UI/UX Impor Diperbarui**:
  - Input file menerima `.xls, .xlsx`.
  - Teks instruksi dan pesan validasi diperjelas untuk format `.xls` dan `.xlsx`.
- **Pengujian Lengkap**: Unit test komprehensif untuk raw BIFF legacy, OLE2 `.xls` nyata (`docs/21-7.xls`), dan `.xlsx`.

### Non-Goals
- Tidak mengubah skema database backend atau tabel `attendance_records` / `attendance_batches` (struktur payload `ImportRow` tetap konsisten).
- Tidak mengubah hak akses / RBAC (hanya HR_ADMIN / HR_STAFF yang memiliki izin impor).
- Tidak memodifikasi logika kalkulasi payroll (payroll tetap membaca data hasil review yang sudah di-commit).

---

## 3. Data Model & Normalization Spec

Tipe output baris impor tetap mempertahankan antarmuka `ImportRow` di [`frontend/src/lib/attendance/types.ts`](frontend/src/lib/attendance/types.ts):

```typescript
export interface ImportRow {
  id: number;
  externalNoId: string;
  employeeId: number | null;
  employeeName: string | null;
  employeeCode: string | null;
  department: string | null;
  workDate: string; // Format: YYYY-MM-DD
  shift: string | null;
  scheduleIn: string | null;  // Format: HH:mm
  scheduleOut: string | null; // Format: HH:mm
  scanIn: string | null;      // Format: HH:mm
  scanOut: string | null;     // Format: HH:mm
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

### Aturan Normalisasi Baris:
1. **Identitas**: `No. ID` wajib ada. Jika string kosong atau hanya spasi, baris ditandai `BLOCKED` dengan catatan `"No. ID kosong."`.
2. **Tanggal**:
   - Jika nilai berupa angka (serial date Excel): dikonversi dengan algoritma standar Excel / `XLSX.SSF.parse_date_code` menjadi string `YYYY-MM-DD`.
   - Jika string `DD/MM/YYYY`: dikonversi menjadi `YYYY-MM-DD`.
   - Jika string `YYYY-MM-DD`: divalidasi dan digunakan langsung.
   - Tahun harus valid antara `2000` s/d `2100`. Jika tidak valid, lempar error validasi tanggal.
3. **Scan Kosong**:
   - Jika kedua scan (`Scan Masuk` dan `Scan Pulang`) kosong: status `SKIPPED`, catatan `"Kedua scan kosong; tidak disimpulkan alpha."`.
   - Jika salah satu scan kosong: gunakan jadwal yang bersangkutan (`scheduleIn` / `scheduleOut`), tandai `normalized: true`, status `NEEDS_REVIEW`, catatan `"Data Excel tidak lengkap, sudah dinormalisasi"`.
4. **Durasi**:
   - String `HH:mm` dikonversi ke menit (`HH * 60 + mm`).
   - String kosong / null dikonversi ke `0`.

---

## 4. Architecture & Parser Flow

```text
[ File Upload (.xls / .xlsx) ]
            │
            ▼
    [ Signature Check ]
            │
    ┌───────┴──────────────────────────────┐
    ▼                                      ▼
[ Raw BIFF: 0x09 ]              [ OLE2 (0xD0 0xCF) / XLSX (PK) ]
    │                                      │
    ▼                                      ▼
[ parseRawBiffRecords ]             [ SheetJS XLSX.read ]
    │                                      │
    └───────────────┬──────────────────────┘
                    ▼
          [ Unified Cell Table ]
                    │
                    ▼
         [ validateRequiredHeaders ]
         (No. ID, Nama, Tanggal)
                    │
                    ▼
         [ normalizeAttendanceRow ]
         (Date, Clock, Minutes, States)
                    │
                    ▼
          [ Array<ImportRow> ]
```

---

## 5. Frontend & UX Updates

### [`AttendanceImportsPage.tsx`](frontend/src/components/attendance/AttendanceImportsPage.tsx):
- `UploadDialog`:
  - `accept=".xls,.xlsx"` pada input file.
  - Subtitle modal: `"Format Excel .xls atau .xlsx mesin absensi"`
  - Teks bantuan: `"Menerima file .xls dan .xlsx dari mesin absensi. Kolom wajib: No. ID, Nama, dan Tanggal. Kolom jadwal, scan, keterlambatan, dan lembur terbaca otomatis."`

---

## 6. Security & Boundary Checks
- **Ukuran Maksimum**: Batas 20 MiB tetap diberlakukan sebelum parsing.
- **Batas Baris**: Batas maksimum 50.000 baris untuk mencegah Denial of Service (DoS) pada browser memory.
- **Sanitasi Formula**: Tidak mengeksekusi macro/formula VBA; hanya mengekstrak nilai teks/angka dari cell data.
- **Fail Loudly**: Jika format file bukan Excel atau korup, tampilkan pesan error deskriptif yang memandu user.
