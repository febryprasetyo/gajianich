# Design Spec: ADMS Real-Time Auto-Ingest to Attendance

## 1. Summary & Problem Statement
Sebelumnya, log absensi dari mesin Cloud ADMS (Port 8081) langsung masuk ke tabel `adms.review_logs` dalam 1-2 detik, namun tertahan di tabel penampung tersebut dan tidak langsung masuk ke tabel presensi (`attendance_device_raw_logs` dan `attendance_records`). Hal ini menyebabkan delay lebih dari 1 menit karena sistem harus menunggu HR menekan tombol sinkronisasi manual atau menunggu kalkulasi batch.

Pengguna menginginkan agar data masuk secara **real-time**: begitu karyawan tap di mesin absensi, dalam 1-3 detik status presensi langsung masuk dan terhitung ke daftar absensi karyawan secara otomatis tanpa perlu tindakan manual.

## 2. Goals & Non-Goals
### Goals:
1. **Real-time Event-Driven Ingestion (< 200 ms latency di database)**: Memanfaatkan PostgreSQL `LISTEN/NOTIFY` trigger pada tabel `adms.review_logs`. Begitu data baru di-insert oleh ADMS receiver, event `adms_new_punch` langsung diterima oleh backend listener.
2. **Instant Attendance Calculation**: Backend listener segera mengeksekusi pipeline pembersihan (debounce 60s), resolusi shift, dan FIFO calculation ke `attendance_records` untuk tanggal dan grup organisasi terkait.
3. **Audit Tracking & Idempotency**:
   - Menambahkan kolom `ingested_at timestamptz` pada tabel `adms.review_logs` sebagai status tracking log yang sudah masuk ke presensi.
   - Tetap menjamin zero duplicates via `ON CONFLICT (ingestion_key) DO NOTHING` dan `mergeAttendanceScans`.
4. **Failsafe / Self-Healing Background Sweep**:
   - Menjalankan periodic worker ringan (setiap 30 detik) untuk memeriksa apakah ada row dengan `ingested_at IS NULL AND employee_id IS NOT NULL` sebagai pencegahan jika koneksi websocket/LISTEN sempat terputus saat backend restart.
5. **Preserve Manual Action & Unmapped Resolution**:
   - HR tetap dapat melakukan re-kalkulasi manual atau memetakan PIN yang belum terdaftar (unmapped) kapan saja.

### Non-Goals:
- Mengubah protokol komunikasi mesin fisik ke port 8081 (protokol HTTP ZKTeco ADMS tetap standar).
- Mengizinkan PIN yang belum terdaftar (`employee_id IS NULL`) langsung masuk ke rekap absensi karyawan (tetap harus melalui verifikasi/pemetaan).

## 3. Data Model & Schema Diffs
1. Tambah kolom `ingested_at` pada tabel `adms.review_logs`:
   ```sql
   ALTER TABLE adms.review_logs ADD COLUMN IF NOT EXISTS ingested_at timestamptz;
   CREATE INDEX IF NOT EXISTS idx_adms_review_logs_uningested 
     ON adms.review_logs(group_id, punched_at) 
     WHERE ingested_at IS NULL;
   ```
2. Trigger fungsi `adms.notify_new_punch()`:
   ```sql
   CREATE OR REPLACE FUNCTION adms.notify_new_punch() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN
     PERFORM pg_notify('adms_new_punch', json_build_object(
       'id', NEW.id,
       'group_id', NEW.group_id,
       'employee_id', NEW.employee_id,
       'work_date', to_char(NEW.punched_at, 'YYYY-MM-DD')
     )::text);
     RETURN NEW;
   END;
   $$;

   DROP TRIGGER IF EXISTS trg_adms_new_punch ON adms.review_logs;
   CREATE TRIGGER trg_adms_new_punch
     AFTER INSERT ON adms.review_logs
     FOR EACH ROW
     EXECUTE FUNCTION adms.notify_new_punch();
   ```

## 4. Architecture & Workflow
```text
[ Karyawan Tap di Mesin ] (misal jam 16:08:51)
           │ (1-2 detik via HTTP Push Port 8081)
           ▼
[ ADMS Receiver (Port 8081) ]
           │ INSERT INTO adms.review_logs
           ▼
[ PostgreSQL Trigger `trg_adms_new_punch` ]
           │ pg_notify('adms_new_punch', { group_id, date, ... }) (< 5ms)
           ▼
[ Backend Realtime Listener (`admsRealtimeListener.ts`) ]
           │ Debounced Batch Queue (150ms buffer to group burst taps)
           ▼
[ `cleanseAndIngestAdmsLogs()` ]
           ├─ 1. Debounce accidental double taps (< 60s)
           ├─ 2. Ingest ke `attendance_device_raw_logs` (ON CONFLICT DO NOTHING)
           ├─ 3. FIFO / Shift calculation ke `attendance_records`
           └─ 4. UPDATE adms.review_logs SET ingested_at = now() WHERE id IN (...)
           ▼
[ Data Presensi Karyawan Terbit Real-time ] (< 1 detik setelah tap mendarat di server)
```

## 5. Security & Blast Radius
- Zero external attack surface: Trigger berjalan di dalam database PostgreSQL internal, backend berkomunikasi via koneksi lokal TCP PostgreSQL.
- Transaksional & Terisolasi: Jika ada kalkulasi satu grup yang gagal, error ditangkap di worker dan tidak mengganggu proses penerimaan port 8081.
- Role boundary: ADMS Server port 8081 tetap unprivileged (hanya write ke `adms.review_logs`), logic payroll tetap di backend.
