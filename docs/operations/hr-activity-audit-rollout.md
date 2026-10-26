# Panduan Operasional & Rollout: HR Activity Audit

Dokumen ini menjelaskan prosedur migrasi, rollout bertahap, konfigurasi hak akses, dan mitigasi rollback untuk fitur **Pencatatan Riwayat Aktivitas HR (Server-Side Append-Only Audit)** pada aplikasi AMS.

---

## 1. Ringkasan Arsitektur & Prinsip

1. **Server-Side Append-Only**: Seluruh catatan audit disimpan di PostgreSQL (`hr_audit_events`, `hr_audit_targets`, `hr_mutation_receipts`) yang dilindungi trigger `BEFORE UPDATE OR DELETE` dan permission table runtime `INSERT/SELECT` saja.
2. **Identitas Pelaku Terverifikasi**: Pelaku audit diselesaikan langsung dari token JWT akun yang terautentikasi di database server. Tidak pernah menerima actor dari body request, metadata klien, pemohon cuti, atau fallback `user 1`.
3. **Idempotensi & Transaksional**: Semua mutasi bisnis dan catatan audit dieksekusi dalam transaksi database yang sama (`BEGIN ... COMMIT`). Jika penulisan audit gagal, mutasi bisnis otomatis di-rollback. Retry request dengan `operationId` yang sama mengembalikan respons identik tanpa membuat duplikat audit event.
4. **Tidak Ada Backfill Audit Lokal Browser**: Data audit historis lokal di browser (`localStorage`) tidak boleh di-backfill ke database karena tidak terjamin integritas dan keaslian pelakunya. Riwayat server dimulai sejak tanggal/jam fitur diaktifkan.

---

## 2. Pemisahan Hak Akses Database (Migration vs Runtime)

Untuk mematuhi prinsip *least privilege* dan menjamin sifat append-only secara fisik:

### 2.1. Migration Owner (`ams_migration`)
- Memiliki hak DDL penuh untuk membuat tabel, indeks, foreign key, dan trigger.
- Dijalankan via `npm run db:migrate` saat proses CI/CD deployment.
- Variabel lingkungan: `MIGRATION_DATABASE_URL` (atau fallback `DATABASE_URL` pada lingkungan pengujian lokal).

### 2.2. Runtime Service (`ams_app`)
- Hanya memiliki hak DML terbatas:
  ```sql
  -- Tabel bisnis biasa
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ams_app;

  -- Khusus tabel audit append-only: DILARANG UPDATE ATAU DELETE
  REVOKE UPDATE, DELETE, TRUNCATE ON TABLE hr_audit_events, hr_audit_targets, hr_mutation_receipts FROM ams_app;
  GRANT SELECT, INSERT ON TABLE hr_audit_events, hr_audit_targets, hr_mutation_receipts TO ams_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ams_app;
  ```
- Variabel lingkungan: `DATABASE_URL` (digunakan oleh Express backend saat runtime).

---

## 3. Prosedur Pra-Deployment & Backup

Sebelum menjalankan deployment ke server staging/production:

1. **Backup Basis Data Penuh**:
   ```bash
   pg_dump -h <db_host> -U <db_user> -d <db_name> -F c -b -v -f /backup/ams_pre_hr_audit_$(date +%Y%m%d_%H%M%S).dump
   ```
2. **Validasi Konektivitas & Versi PostgreSQL**:
   - Pastikan PostgreSQL versi 16+ aktif.
   - Pastikan extension `uuid-ossp` atau native UUID support aktif.
3. **Periksa Status Migrasi**:
   ```bash
   cd backend && npm run db:migrate
   ```
   Pastikan file `0015_hr_activity_audit.sql` dan `0016_goofy_random.sql` teraplikasi dengan status sukses.

---

## 4. Urutan Deployment (Zero-Downtime Rollout)

Rollout harus mengikuti urutan ketat berikut untuk mencegah ketidaksinkronan klien dengan backend:

### Langkah 1: Migrasi Skema Basis Data
Jalankan migrasi database via pipeline runner menggunakan kredensial Migration Owner.

### Langkah 2: Deploy Backend API
- Deploy service Express backend versi terbaru.
- Backend baru memuat router `/api/v1/attendance/commands`, `/api/v1/attendance/workspace`, dan `/api/v1/hr/activities`.
- Backend baru menjamin transaksi atomik dan menolak request body yang menyuntikkan actor klien.
- Lakukan health check endpoint:
  ```bash
  curl -s -f http://localhost:5000/api/v1/health || exit 1
  ```

### Langkah 3: Deploy Frontend Web Application
- Deploy artefak Next.js versi terbaru.
- Frontend baru mengarahkan seluruh mutasi ke endpoint `/api/v1/attendance/commands` dengan header `Idempotency-Key` dan tidak lagi menulis ke `localStorage`.
- Halaman `/dashboard/attendance/activity` membaca langsung dari `/api/v1/hr/activities` dengan dukungan filter WIB dan drawer detail target.

---

## 5. Verifikasi Paska-Deployment (Smoke Verification)

Setelah deployment selesai:

1. **Verifikasi Hak Akses (RBAC)**:
   - Login menggunakan akun dengan role `hr_attendance` atau permission `attendance.view` -> pastikan menu *Riwayat Aktivitas HR* muncul di sidebar.
   - Login menggunakan akun `employee` biasa -> pastikan akses ke `/dashboard/attendance/activity` ditolak dengan status HTTP 403 atau dialihkan ke halaman unauthorized.
2. **Verifikasi Mutasi & Audit Event**:
   - Lakukan satu tindakan mutasi (misalnya: update jam kerja shift atau koreksi status absensi).
   - Buka menu *Riwayat Aktivitas HR*, pastikan event mutasi tersebut langsung muncul di urutan paling atas dengan timestamp WIB dan nama akun pelaku yang benar.
   - Buka drawer detail, pastikan perubahan field `before` dan `after` tertera jelas tanpa ada field kredensial/sensitif yang bocor.
3. **Verifikasi Append-Only Enforcement**:
   - Coba jalankan `DELETE FROM hr_audit_events WHERE id = ...;` menggunakan user runtime `ams_app`.
   - Pastikan query ditolak oleh trigger `trg_prevent_hr_audit_events_modification` atau permission privilege.

---

## 6. Prosedur Rollback

Jika ditemukan kendala kritis pada rilis:

1. **Prinsip Keselamatan Data**:
   - Tabel `hr_audit_events` dan `hr_audit_targets` **TIDAK BOLEH DI-DROP ATAU DI-TRUNCATE** saat rollback. Catatan yang sudah terlanjur tertulis adalah aset audit legal.
2. **Rollback Aplikasi**:
   - Revert deployment frontend ke commit sebelumnya.
   - Revert deployment backend ke commit sebelumnya.
3. **Catatan Penting**:
   - Jika backend di-revert ke versi yang belum memiliki audit server, mutasi HR yang dilakukan selama masa rollback tidak akan tercatat di audit trail server. Oleh karena itu, jika terjadi rollback, batasi akses mutasi operasional hanya untuk perbaikan darurat hingga patch rilis siap di-deploy kembali.
