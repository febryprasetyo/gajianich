# Design Spec: Laporan Absensi Harian (Format Cetak Landscape)

- **Tanggal Dokumen**: 2026-11-02
- **Penulis**: AI Agent & Tim Rekayasa Sistem GAJIANICH
- **Status**: Draft for User Review & Approval
- **Target Rilis**: v1.2.0 (Modul Attendance / Laporan Harian)

---

## 1. Summary & Problem Statement

Manajemen dan HRD GAJIANICH membutuhkan laporan rekapitulasi absensi harian yang dapat dicetak langsung (*print ready*) dalam format **Landscape (A4/F4)** dengan tata letak baku yang identik dengan format fisik operasional yang digunakan di lapangan (khususnya departemen Marketing dan departemen lainnya).

Laporan ini merangkum kehadiran karyawan per tanggal tertentu yang memuat:
1. **Nomor urut (`No`)**.
2. **Nama Karyawan** dengan header departemen (misal `MARKETING`), lengkap dengan **highlight kuning otomatis** untuk karyawan dengan **Level Jabatan = Koordinator / Direktur** (dari tabel karyawan `employees.job_level` / `employees.position`), serta dapat ditandai manual oleh HRD.
3. **Lokasi Update**:
   - Statis `"Jakarta/ Kantor"` untuk presensi mesin ADMS/kantor.
   - Dinamis `[Kabupaten/Kota], [Provinsi]` (misal: `"Kabupaten Serang, Banten"` atau `"Kabupaten Gowa, Sulawesi Selatan"`) khusus untuk karyawan presensi mobile / dinas luar.
   - Kosong jika tidak hadir.
4. **Jam Masuk** (`HH:mm`) dengan penanda visual sel berwarna **merah/pink** jika terjadi keterlambatan dari jadwal shift.
5. **Keterangan**: Otomatis mendeteksi `"TDK ADA ABSEN"`, status cuti/sakit dari pengajuan cuti, serta mendukung memo/catatan manual yang dapat diedit langsung oleh HRD dan tersimpan persisten untuk tanggal kapan pun (termasuk hari-hari sebelumnya).

---

## 2. Goals & Non-Goals

### Goals
- Menyediakan endpoint backend untuk query rekapitulasi absensi harian per tanggal (`workDate`) baik hari ini maupun **hari-hari sebelumnya (historis)** dan filter departemen (`departmentId` atau seluruh departemen).
- **Persistensi Catatan & Highlight Historis**: Menyimpan status penandaan kuning (*highlight*) dan memo keterangan manual HRD di tabel `attendance_daily_notes` berbasis pasangan unik `(employee_id, work_date)`. Catatan hari-hari sebelumnya tetap tersimpan permanen dan tidak akan hilang saat berpindah tanggal atau dibuka kembali di masa depan.
- Mengintegrasikan deteksi sumber scan:
  - Mesin Finger/ADMS $\rightarrow$ statis `"Jakarta/ Kantor"`.
  - Mobile Face / Dinas Luar $\rightarrow$ dinamis parsing `city/county` + `state` dari data geolokasi Nominatim `attendance_self_logs.address`.
- Menyediakan halaman dashboard interaktif di frontend yang memenuhi standar *Emerald Enterprise Design System* (`PageHeader`, filter tanggal historis, filter departemen, ringkasan KPI).
- Menyediakan fitur cetak (*print preview & window.print*) format **Landscape** dengan styling `@page { size: landscape; margin: 10mm; }`, border hitam rapi, highlight sel merah untuk keterlambatan, dan highlight kuning untuk nama terpilih persis seperti contoh fisik.
- Mendukung cetak khusus departemen Marketing maupun gabungan seluruh departemen dengan pemisah halaman (*page-break*) per departemen.

### Non-Goals
- Tidak mengubah alur kerja sinkronisasi mesin ADMS atau protokol pengenalan wajah mobile yang sudah berjalan.
- Tidak mengubah tabel rekapitulasi gaji bulanan (laporan ini berfokus pada audit & monitoring harian operasional HRD).
- Tidak mengizinkan perubahan data historis scan raw (audit trail integritas absensi tetap terjaga *read-only*).

---

## 3. Data Model & Schema Diffs

### 3. Skema Database & Persistensi Historis: `attendance_daily_notes`
Dibuat tabel baru untuk menyimpan catatan memo HRD dan penandaan warna kuning (*highlight*) karyawan harian berbasis `work_date`. Setiap catatan yang diisi atau diubah oleh HRD pada tanggal manapun (hari ini maupun tanggal historis di masa lalu) akan tersimpan permanen di database.

#### Logika Penentuan Highlight Kuning Nama Karyawan:
1. **Otomatis berdasarkan Jabatan/Level Jabatan**:
   - Jika `employees.job_level` atau `employees.position` mengandung kata `koordinator` atau `direktur` (case-insensitive, misal: *KOORDINATOR MARKETING*, *DIREKTUR OPERASIONAL*, *Koordinator*, *Direktur*), nama karyawan otomatis diberi highlight kuning (`isHighlighted = true`).
2. **Manual Override oleh HRD**:
   - Jika ada nilai eksplisit pada `attendance_daily_notes.is_highlighted` untuk karyawan dan tanggal tersebut, gunakan nilai manual dari HRD (memungkinkan HRD menambah stabilo kuning pada staf lain atau menonaktifkannya).

#### Hirarki Penentuan Kolom Keterangan:
1. **Prioritas 1 (Manual Note HRD)**: Jika terdapat `manualNote` di `attendance_daily_notes` untuk karyawan dan tanggal tersebut, gunakan catatan ini (misal memo lisan dari Pak Sendy: `"SAKIT (SDH INFO PAK SENDY) ADA SURAT DOKTER"`).
2. **Prioritas 2 (Data Permohonan Cuti/Sakit Resmi)**: Jika tidak ada memo manual, periksa tabel `leave_requests`. Jika ada permohonan yang disetujui (misal `"SAKIT"`, `"CUTI"`), tampilkan jenis cuti dan alasan dokumennya.
3. **Prioritas 3 (Deteksi Absen)**: Jika tidak ada scan masuk (`scanIn === null`) dan tidak ada cuti, otomatis tampilkan `"TDK ADA ABSEN"`.
4. **Prioritas 4 (Hadir Normal)**: Jika hadir tepat waktu tanpa catatan, kosongkan (`""`).

```typescript
// backend/src/db/schema/attendanceDailyNotes.ts
import { pgTable, bigint, varchar, text, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';
import { organizationGroups, organizations } from './organizations';

export const attendanceDailyNotes = pgTable('attendance_daily_notes', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  groupId: bigint('group_id', { mode: 'number' }).references(() => organizationGroups.id, { onDelete: 'restrict' }),
  organizationId: bigint('organization_id', { mode: 'number' }).references(() => organizations.id, { onDelete: 'restrict' }),
  workDate: varchar('work_date', { length: 10 }).notNull(), // 'YYYY-MM-DD'
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  isHighlighted: boolean('is_highlighted').default(false).notNull(), // Highlight kuning manual oleh HRD
  manualNote: text('manual_note'), // Memo manual HRD yang persisten per tanggal
  updatedById: bigint('updated_by_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_attendance_daily_notes_emp_date').on(table.employeeId, table.workDate),
]);
```

---

## 4. API Specifications

### Endpoint 1: Ambil Data Laporan Absensi Harian
- **URL**: `GET /api/attendance/daily-report`
- **Scope Authn/Authz**: HR role (token verified, organization scoped)
- **Query Parameters**:
  - `date`: `YYYY-MM-DD` (wajib, misal `2026-10-30`)
  - `departmentId`: number (opsional, jika kosong atau `0` berarti semua departemen)
  - `highlightOnly`: boolean (opsional)
- **Response Format (200 OK)**:
```json
{
  "workDate": "2026-10-30",
  "formattedDate": "Jumat, 30 Oktober 2026",
  "departments": [
    {
      "departmentId": 5,
      "departmentName": "MARKETING",
      "employees": [
        {
          "no": 1,
          "employeeId": 86,
          "employeeName": "Aldio Rizky Mulyawan",
          "isHighlighted": false,
          "locationUpdate": "Jakarta/ Kantor",
          "scanIn": "06:58",
          "isLate": false,
          "lateMinutes": 0,
          "keterangan": "",
          "attendanceStatus": "PRESENT",
          "sourceType": "ADMS"
        },
        {
          "no": 2,
          "employeeId": 158,
          "employeeName": "Sofyan",
          "isHighlighted": false,
          "locationUpdate": "Kabupaten Gowa, Sulawesi Selatan",
          "scanIn": null,
          "isLate": false,
          "lateMinutes": 0,
          "keterangan": "TDK ADA ABSEN",
          "attendanceStatus": "ALPHA",
          "sourceType": "MOBILE"
        },
        {
          "no": 4,
          "employeeId": 98,
          "employeeName": "Lolita ayu permata dewi",
          "isHighlighted": false,
          "locationUpdate": "Jakarta/ Kantor",
          "scanIn": null,
          "isLate": false,
          "lateMinutes": 0,
          "keterangan": "SAKIT (SDH INFO PAK SENDY) ADA SURAT DOKTER",
          "attendanceStatus": "SAKIT",
          "sourceType": "LEAVE"
        },
        {
          "no": 8,
          "employeeId": 162,
          "employeeName": "Muhammad Gilang Ramadhan",
          "isHighlighted": false,
          "locationUpdate": "Jakarta/ Kantor",
          "scanIn": "08:10",
          "isLate": true,
          "lateMinutes": 10,
          "keterangan": "",
          "attendanceStatus": "PRESENT",
          "sourceType": "ADMS"
        }
      ]
    }
  ],
  "summary": {
    "totalEmployees": 21,
    "present": 18,
    "late": 10,
    "absent": 3
  }
}
```

### Endpoint 2: Simpan/Update Catatan & Highlight Manual HRD
- **URL**: `POST /api/attendance/daily-report/note`
- **Scope Authn/Authz**: HR role (Write permission)
- **Payload**:
```json
{
  "workDate": "2026-10-30",
  "employeeId": 98,
  "isHighlighted": true,
  "manualNote": "SAKIT (SDH INFO PAK SENDY) ADA SURAT DOKTER"
}
```
- **Response Format (200 OK)**:
```json
{
  "success": true,
  "data": {
    "employeeId": 98,
    "workDate": "2026-10-30",
    "isHighlighted": true,
    "manualNote": "SAKIT (SDH INFO PAK SENDY) ADA SURAT DOKTER"
  }
}
```

---

## 5. Frontend & Mobile UX

### 5.1 Halaman Interaktif HRD (`/dashboard/attendance/daily-report`)
1. **Page Header**:
   - Logo icon emerald (`FileText` atau `CalendarCheck`), judul *"Laporan Absensi Harian"*, deskripsi *"Rekapitulasi kehadiran harian per departemen dengan format siap cetak landscape"*.
2. **Filter Toolbar**:
   - Pemilih tanggal tunggal (`workDate`), default tanggal hari ini.
   - Dropdown Departemen (pilihan: *"MARKETING (Khusus)"*, per departemen lain, atau *"Semua Departemen"*).
   - Tombol Aksi:
     - `Printer` **Cetak Landscape**: Membuka dialog / halaman cetak landscape langsung.
     - `FileSpreadsheet` **Export Excel**: Mengunduh spreadsheet berformat landscape.
3. **Tabel Pratinjau Interaktif**:
   - Tombol toggle stabilo (*highlight* kuning) di setiap nama karyawan.
   - Kolom Jam Masuk menampilkan badge merah lembut bila terlambat.
   - Kolom Keterangan berupa *inline editable field* dengan tombol simpan cepat, memudahkan HR mengetik memo catatan.

### 5.2 Lembar Dokumen Cetak (`@media print` Landscape)
1. **Aturan CSS Cetak**:
   ```css
   @page {
     size: landscape;
     margin: 10mm;
   }
   @media print {
     .no-print { display: none !important; }
     body { background: white !important; color: black !important; font-family: sans-serif; }
     .print-table { width: 100%; border-collapse: collapse; }
     .print-table th, .print-table td { border: 1px solid #1e293b; padding: 4px 8px; font-size: 11pt; }
     .bg-yellow-highlight { background-color: #fef08a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
     .bg-late-highlight { background-color: #fca5a5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
     .page-break-dept { page-break-before: always; }
   }
   ```
2. **Struktur Header Lembar Cetak**:
   - Judul Tanggal di tengah atas (misal: `30-Oct-26`).
   - Header Kolom:
     - `No`
     - Header Departemen (misal: `MARKETING`)
     - `LOKASI UPDATE`
     - `JAM MASUK`
     - `KETERANGAN`

---

## 6. Security, Integrity & Edge Cases

1. **Role-Based Access Control (RBAC)**:
   - Akses dibatasi untuk pengguna berwenang HR (`SUPER_ADMIN`, `HR_ADMIN`, `HR_STAFF`, `REPORT_VIEWER`).
   - Akses dibatasi sesuai cakupan kelompok organisasi (`RequestScope`).
2. **Audit Trail**:
   - Setiap modifikasi manual note atau highlight dicatat dengan `updated_by_id` dan `updated_at`.
3. **Penanganan Kasus Tepi (Edge Cases)**:
   - **Karyawan tanpa scan**: Otomatis ditampilkan di baris dengan status `"TDK ADA ABSEN"`.
   - **Karyawan Dinas Luar**: Jika scan dari aplikasi mobile dengan GPS, parser mengekstrak nama kabupaten/kota dan provinsi (contoh: `"Kabupaten Serang, Banten"`). Jika gagal memuat nama kota, fallback ke koordinat/alamat tertera.
   - **Multi-Departemen Print**: Jika mencetak seluruh departemen sekaligus, diterapkan CSS `page-break-after: always;` di akhir tiap departemen sehingga cetakan tidak bercampur di lembar kertas yang sama.

