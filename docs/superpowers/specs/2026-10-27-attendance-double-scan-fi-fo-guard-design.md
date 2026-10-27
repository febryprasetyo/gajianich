# Design Spec: Guard Double Scan Presensi & FI - FO Resolution

**Tanggal:** 27 Oktober 2026  
**Status:** DRAFT (Menunggu Persetujuan Pengguna)  
**Dokumen Terkait:**  
- [Rencana Implementasi](../plans/2026-10-27-attendance-double-scan-fi-fo-guard.md)  
- [Spesifikasi Presensi Mobile Backend](./2026-10-22-mobile-attendance-backend-design.md)  
- [Spesifikasi Smart Clock Selection](./2026-10-23-smart-clock-selection-design.md)  
- [Panduan Desain Master](../../UI_DESIGN_SYSTEM_GUIDE.md)

---

## 1. Summary & Problem Statement

### Kasus Nyata (Contoh Kasus 50181 - Adam Putra Jaya, 26 Oktober 2026)
Pada tanggal 26 Oktober 2026, karyawan dengan nomor ID `50181` (Adam Putra Jaya):
1. Melakukan scan masuk pada pagi/siang hari (pukul 10:14).
2. Melakukan scan pulang saat jam kerja usai (pukul 17:05).
3. Namun, 1 menit kemudian (pukul 17:06), karyawan secara tidak sengaja membuka kembali aplikasi dan menekan tombol presensi.
4. **Hasil yang Terjadi:**
   - Karena karyawan sudah melakukan Masuk (`isCheckedIn: true`) dan Pulang (`isCheckedOut: true`), kalkulasi frontend mobile `isCheckOut = Boolean(isCheckedIn && !isCheckedOut)` mengevaluasi nilai menjadi `false`.
   - Frontend kemudian mengirim event presensi sebagai **`IN` (Absen Masuk)** pada pukul 17:06.
   - Di sisi backend, fungsi `projectApprovedLog` mengambil log `IN` dengan urutan `desc(id)` (terbaru), sehingga jam masuk karyawan ditimpa menjadi **17:06**, sementara jam pulang tetap **17:05**.
   - Di tabel `attendance_records`, data menjadi kacau: `scan_in: 17:06`, `scan_out: 17:05` (jam masuk tercatat setelah jam pulang!).

### Tujuan (Goals)
1. **Frontend Mobile Guard:**
   - Jika karyawan sudah melakukan absen masuk dan pulang di hari tersebut (`isCheckedIn && isCheckedOut`), tombol Presensi wajib dikunci menjadi status `"COMPLETED"` ("Selesai" / "Presensi Lengkap") dan berstatus `disabled` (tidak dapat ditekan kembali).
   - Dialog `FaceAttendanceSheet` tidak boleh memicu event `IN` saat pengguna sudah memiliki catatan masuk dan pulang.
2. **Backend Guard:**
   - Menolak request presensi `IN` jika karyawan telah memiliki pasangan log masuk dan pulang yang sah untuk hari kerja tersebut.
   - Mengembalikan pesan error validasi yang jelas: *"Presensi hari ini sudah lengkap (sudah absen masuk dan pulang)."*
3. **FI - FO (First In - Last Out) Resolution Policy:**
   - Dalam agregasi rekap kehadiran harian (`projectApprovedLog` dan `getMobileTodaySummary`):
     - **Scan In (First In):** Wajib selalu mengambil log `IN` paling awal (*earliest scan*) pada tanggal kerja tersebut.
     - **Scan Out (Last Out):** Wajib selalu mengambil log `OUT` paling akhir (*latest scan*) pada tanggal kerja tersebut jika ada lebih dari satu scan kepulangan.
4. **Koreksi Data Record 50181 (2026-10-26):**
   - Memulihkan data `attendance_records` id 36 milik karyawan 50181 tanggal 2026-10-26 agar `scan_in: '10:14'`, `scan_out: '17:05'`, dan log duplikat id 10 (17:06) ditandai sebagai `REJECTED` (duplikat tidak sengaja).

---

## 2. Analisis Blast Radius & Dampak Arsitektur

| Komponen | Lokasi File | Dampak Perubahan |
| :--- | :--- | :--- |
| **Mobile Web UI** | `frontend/src/app/m/presensi/page.tsx` | Status button terkunci `"COMPLETED"`, mencegah trigger `FaceAttendanceSheet`. |
| **Ring Button UI** | `frontend/src/components/mobile/PresensiRingButton.tsx` | Memastikan state disabled dan label "Selesai" konsisten dengan master design. |
| **Backend Service** | `backend/src/services/mobileAttendanceService.ts` | 1) Guard penolakan clock `IN` saat shift sudah lengkap.<br>2) Logika `inLog` menggunakan `First In` (sort ascending by occurredAt).<br>3) Logika `outLog` menggunakan `Last Out` (sort descending by occurredAt). |
| **Data Recovery** | Database `ams_dev_db` | Update record 50181 tanggal 2026-10-26 dan update self_log id 10. |

---

## 3. Data Model & Logika Resolusi (FI - FO)

### Resolusi FI - FO (First In - Last Out)
Dalam `projectApprovedLog` dan `getMobileTodaySummary`:
```ts
// Dapatkan semua log karyawan pada workDate yang bersangkutan
const approvedLogs = all.filter(l => l.approvalStatus === 'APPROVED');

// First In: Ambil log IN yang paling awal
const inLogs = approvedLogs
  .filter(l => l.eventType === 'IN')
  .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
const inLog = inLogs[0] ?? null;

// Last Out: Ambil log OUT yang paling akhir
const outLogs = approvedLogs
  .filter(l => l.eventType === 'OUT')
  .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
const outLog = outLogs[0] ?? null;
```

Dengan logika ini:
- Jika seorang karyawan melakukan scan masuk pukul 10:14, lalu scan pulang 17:05, dan ada scan masuk/pulang tak sengaja di 17:06, `scan_in` tetap aman menggunakan `10:14`.
- Tidak akan ada lagi kondisi `scan_in > scan_out` akibat penimpaan dari scan terakhir.

---

## 4. API Specifications & Validasi Backend

### Endpoint: `POST /api/v1/attendance/mobile/clock`
- **Validasi Guard:**
  ```ts
  const hasIn = logs.some(l => l.workDate === workDate && l.eventType === 'IN');
  const hasOut = logs.some(l => l.workDate === workDate && l.eventType === 'OUT');

  if (hasIn && hasOut && payload.eventType === 'IN') {
    throw new Error('Presensi hari ini sudah lengkap (sudah absen masuk dan pulang). Hubungi HRD jika memerlukan koreksi.');
  }
  ```
- **Error Code:** `400 Bad Request` / `409 Conflict`.
- **Response Format:**
  ```json
  {
    "success": false,
    "error": "Presensi hari ini sudah lengkap (sudah absen masuk dan pulang). Hubungi HRD jika memerlukan koreksi."
  }
  ```

---

## 5. UI/UX States pada Mobile Presensi

| Kondisi Presensi Karyawan | Label Ring Button | Sublabel | Status Button | Interaktivitas |
| :--- | :--- | :--- | :--- | :--- |
| Belum Scan Masuk & Belum Pulang | **Absen Masuk** | Verifikasi Wajah | `NOT_CHECKED_IN` | Aktif (buka kamera) |
| Sudah Scan Masuk, Belum Pulang | **Absen Pulang** | Verifikasi Wajah | `CHECKED_IN` | Aktif (buka kamera) |
| Sudah Scan Masuk & Sudah Pulang | **Selesai** | Presensi Lengkap | `COMPLETED` | **Disabled** (tidak dapat diklik) |

- **Feedback Visual:** Ring tombol berubah menjadi warna tenang/selesai dengan teks "Presensi Lengkap", mencegah karyawan salah menekan.
- **Accessibility:** Tombol dinonaktifkan (`aria-disabled="true"`, `disabled`), label pembaca layar: *"Presensi hari ini telah lengkap"*.

---

## 6. Koreksi Data untuk Kasus 50181 (26 Okt 2026)

Query koreksi yang akan dijalankan:
1. Update `attendance_self_logs` id `10`:
   - `approval_status`: `'REJECTED'`
   - `approval_note`: `'Dibatalkan sistem: Duplikasi scan setelah presensi pulang selesai.'`
2. Update `attendance_self_logs` id `8` (scan in 10:14):
   - Pastikan disetujui (`'APPROVED'`) jika sebelumnya `PENDING` karena luar geofence (atau diproyeksikan sebagai First In).
3. Update `attendance_records` id `36` (work_date `'2026-10-26'`, employee_id `103`):
   - `scan_in`: `'10:14'`
   - `raw_scan_in`: `'10:14'`
   - `scan_out`: `'17:05'`
   - `raw_scan_out`: `'17:05'`
   - `late_minutes`: `134` (dari jadwal 08:00 ke 10:14)
   - `early_minutes`: `0`
   - `attendance_status`: `'PRESENT'`

---

## 7. Rencana Pengujian (Test Matrix)

1. **Unit Test Backend (`mobileAttendanceService.test.ts`):**
   - Test FI - FO: Diberikan rentetan scan `[IN 08:00, OUT 17:00, IN 17:01]`, proyeksi harus menghasilkan `scanIn: 08:00` dan `scanOut: 17:00`.
   - Test Guard: Mencoba `POST clock` dengan `IN` saat log hari ini sudah memiliki `IN` dan `OUT` harus melempar error penolakan.
2. **E2E / Integration Verification:**
   - Jalankan `npm test` di backend untuk memastikan semua test lulus.
   - Verifikasi langsung data database untuk karyawan 50181.
