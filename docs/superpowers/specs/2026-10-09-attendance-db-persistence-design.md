# Design Spec: Persistensi Data Absensi & Impor ke PostgreSQL

- **Tanggal**: 2026-10-09
- **Status**: Ready for Approval
- **Modul**: HR Attendance Management & Sync

---

## 1. Summary & Problem Statement

Saat ini, data hasil unggah impor absensi dan rekap absensi harian (AttendanceDataset, records, batches) disimpan di **Local Storage browser** (localStorage['ams:attendance-workspace:v2']). Akibatnya:
- Ketika file absensi diunggah dan disimpan di laptop HRD, data hanya berada di browser laptop HRD tersebut.
- Pengguna lain (seperti Administrator atau sesama staf HR di laptop berbeda) tidak dapat melihat data yang sudah diunggah dan disimpan karena data tidak tersinkronisasi ke server database.

Tujuan dari perancangan ini adalah **menyimpan seluruh data absensi yang sudah berhasil diimpor dan disimpan secara permanen ke database PostgreSQL terpusat**, sehingga data otomatis tersinkronisasi secara real-time dan dapat diakses bersama oleh Admin maupun seluruh staf HR dari laptop/perangkat manapun.

---

## 2. Goals & Non-Goals

### Goals
1. **Centralized Persistence**:
   - Menyimpan batch impor absensi (attendance_batches) ke tabel PostgreSQL.
   - Menyimpan seluruh baris data absensi harian yang valid dan ter-commit (attendance_records) ke tabel PostgreSQL.
2. **Real-time Cross-Device Sync**:
   - repository.ts di frontend secara otomatis memuat data absensi dari endpoint API database saat halaman dibuka.
   - Ketika tombol "Simpan absensi" ditekan di laptop HRD, data absensi langsung dikirim dan disimpan ke PostgreSQL, sehingga langsung muncul di laptop Admin saat memuat/refresh halaman.
3. **Data Integrity & Idempotency**:
   - Mencegah duplikasi data absensi untuk karyawan dan tanggal kerja yang sama (UNIQUE(employee_id, work_date) dengan strategi upsert/replace).
4. **Security & RBAC**:
   - Akses baca data absensi dilindungi permission attendance.view.
   - Akses simpan/impor absensi dilindungi permission attendance.import atau attendance.manage (dapat diakses oleh peran HRD dan Admin).

### Non-Goals
- Tidak mengubah algoritma parsing file Excel/biometrik di frontend (tetap menggunakan parser client-side yang cepat dan aman, lalu baris hasil commit dikirim ke database).
- Tidak menghapus fitur koreksi lokal/offline fallback jika koneksi terputus.

---

## 3. Data Model & Schema Diffs (Drizzle ORM)

### Tabel attendance_batches
Menyimpan riwayat berkas impor yang telah disimpan/dikomit.
- id: serial primary key
- filename: varchar(255) not null
- source_id: integer not null default 1
- file_hash: varchar(64)
- status: varchar(20) not null default 'COMMITTED'
- total_rows: integer not null default 0
- valid_rows: integer not null default 0
- skipped_rows: integer not null default 0
- created_by: integer references users(id)
- created_at: timestamp not null default now()
- committed_at: timestamp not null default now()

### Tabel attendance_records
Menyimpan rekap kehadiran harian per karyawan.
- id: serial primary key
- employee_id: integer not null references employees(id) on delete cascade
- work_date: varchar(10) not null (YYYY-MM-DD)
- shift: varchar(100)
- schedule_in: varchar(10)
- schedule_out: varchar(10)
- scan_in: varchar(10)
- scan_out: varchar(10)
- raw_scan_in: varchar(10)
- raw_scan_out: varchar(10)
- late_minutes: integer not null default 0
- early_minutes: integer not null default 0
- overtime_minutes: integer not null default 0
- attendance_status: varchar(20) not null default 'PRESENT'
- is_day_off: boolean not null default false
- normalized: boolean not null default false
- revision: integer not null default 1
- source_batch_id: integer references attendance_batches(id) on delete set null
- created_at: timestamp not null default now()
- updated_at: timestamp not null default now()
- CONSTRAINT: UNIQUE (employee_id, work_date)

---

## 4. API Specifications

1. **GET /api/v1/attendance/records**
   - Query: startDate, endDate, employeeId, departmentId
   - Response: List record absensi dari database.

2. **POST /api/v1/attendance/commit-batch**
   - Payload: filename, sourceId, fileHash, records: []
   - Action: Transaksi atomik menyimpan batch dan meng-upsert baris absensi ke attendance_records.

3. **GET /api/v1/attendance/batches**
   - Response: List batch riwayat impor.

---

## 5. Frontend & Repository Integration

Di frontend/src/lib/attendance/repository.ts:
- load(): Melakukan fetch GET /api/v1/attendance/records dan GET /api/v1/attendance/batches untuk mengisi dataset.
- execute(command): Saat action 'commit' pada 'batch', panggil API POST /api/v1/attendance/commit-batch.
