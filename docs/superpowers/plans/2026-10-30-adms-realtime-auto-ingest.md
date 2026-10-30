# Task Plan: ADMS Real-Time Auto-Ingest to Attendance

## Implementation Checklist

### Phase 1: Database Migration
- [ ] Buat file migration Drizzle/SQL `0039_adms_realtime_trigger.sql` (atau migration runner):
  - Tambah kolom `ingested_at timestamptz` pada `adms.review_logs`.
  - Buat partial index `idx_adms_review_logs_uningested` untuk optimasi sweep query.
  - Buat trigger function `adms.notify_new_punch()` dan pasang trigger `AFTER INSERT ON adms.review_logs`.
- [ ] Jalankan migrasi pada database pengujian/dev dan verifikasi skema.

### Phase 2: Ingestion Service Enhancement
- [ ] Modifikasi `backend/src/services/admsAttendanceSync.ts`:
  - Tambahkan update `ingested_at = now()` pada batch ID `adms.review_logs` yang berhasil diproses.
  - Tambahkan parameter `onlyUningested?: boolean` pada `IngestOptions` agar worker efisien memproses row baru saja.
  - Perbarui unit test `admsAttendanceSync.test.ts`.

### Phase 3: Real-Time Listener & Worker
- [ ] Buat `backend/src/services/admsRealtimeListener.ts`:
  - Dedicated client connection dengan handler `notification` pada channel `adms_new_punch`.
  - Batching / debouncing queue (150ms buffer) agar multiple tap berdekatan diproses dalam satu batch efisien.
  - Periodic background sweep (setiap 30-60 detik) sebagai failsafe self-healing jika listener reconnect.
  - Pasang graceful start & stop pada server lifecycle (`backend/src/server.ts`).

### Phase 4: Verification & Automated Tests
- [ ] Buat unit test & integration test untuk listener dan trigger.
- [ ] Jalankan test suite (`npm run test` di backend).
- [ ] Verifikasi integrasi end-to-end:
  - Simulasikan baris baru di `adms.review_logs`.
  - Pastikan dalam < 1 detik, baris tersebut memiliki `ingested_at IS NOT NULL`, masuk ke `attendance_device_raw_logs`, dan meng-update `attendance_records`.
- [ ] Commit perubahan dengan conventional commit.
