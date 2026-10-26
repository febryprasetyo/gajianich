# Design Spec: Smart Clock Selection (Pilihan Masuk vs Pulang)

**Tanggal:** 26 Oktober 2026  
**Status:** APPROVED (Telah Dikonfirmasi & Disetujui Pengguna)  
**Dokumen Terkait:**  
- [Rencana Implementasi](../plans/2026-10-23-smart-clock-selection.md)  
- [Spesifikasi Presensi Mobile Backend](./2026-10-22-mobile-attendance-backend-design.md)  
- [Panduan Desain Master](../../UI_DESIGN_SYSTEM_GUIDE.md)

---

## 1. Summary & Problem Statement

Pada aplikasi presensi mobile PWA saat ini:
- Jika karyawan belum absen sama sekali hari itu (`checkedIn: false`), sistem secara sekuensial hanya menampilkan tombol **"Absen Masuk" (`IN`)**.
- Backend `recordMobileClock` memvalidasi `if (payload.eventType === 'OUT' && !entry) throw new Error('Belum melakukan presensi masuk.')`.
- **Masalah:** Jika karyawan hadir bekerja sejak pagi (misal jadwal shift 08:00 – 17:00), tetapi **lupa melakukan absen masuk di pagi hari**, lalu baru membuka aplikasi saat hendak pulang (misal pukul 16:06):
  1. Karyawan terpaksa melakukan absen masuk di jam 16:06 (tercatat sangat terlambat 8 jam).
  2. Karyawan harus melakukan absen untuk kedua kalinya agar jam pulangnya tercatat.
  3. Laporan rekap harian menjadi rancu (tercatat masuk 16:06 dan keluar 16:07, durasi 1 menit).

**Solusi yang Dirancang:**  
Implementasi **Smart Clock Selection**: Jika waktu server saat ini sudah memasuki paruh kedua shift / sore hari (`currentTime >= scheduleIn + 5 jam`), dan karyawan belum melakukan absen masuk, sistem tidak memaksakan event `IN`. Sebaliknya, sistem mendeteksi situasi ini dan menampilkan modal interaktif pilihan:
1. **Absen Masuk (Terlambat)**: Untuk karyawan yang memang baru hadir di sore hari.
2. **Langsung Absen Pulang (Lupa Absen Masuk)**: Untuk karyawan yang sudah hadir sejak pagi namun lupa absen masuk, sehingga langsung mencatat jam kepulangan tanpa perlu absen 2x.

---

## 2. Keputusan Desain & Spesifikasi Arsitektur (Hasil Konfirmasi Pengguna)

1. **Ambang Batas Waktu Cerdas (Smart Window Threshold):**
   - Formula: `currentTime >= scheduleIn + 5 jam` (contoh: Shift Office 08:00 – 17:00 mulai aktif pada pukul **13:00**; shift Sabtu/lainnya beradaptasi secara otomatis).
   - Dihitung di backend dan disertakan pada metadata `getMobileTodaySummary`:
     `attendance.isLateAfternoon = true`, `shiftWindow.canDirectOut = true`.

2. **Dukungan Absen Pulang Tunggal (`DIRECT_OUT`):**
   - Backend mengizinkan event `OUT` tanpa `IN` jika `isDirectOut === true`.
   - Status approval otomatis dipaksa `'PENDING'` (wajib verifikasi HRD, mengabaikan pengaturan `autoApproveOut`).
   - Penanda otomatis pada catatan log: `[DIRECT_OUT] ${notes}`.
   - Kolom keterangan/catatan (**wajib diisi**) oleh karyawan saat memilih langsung absen pulang sebagai klarifikasi alasan tidak ada absensi masuk.

3. **Proyeksi Database `attendanceRecords` saat HRD Menyetujui:**
   - Jika hanya ada rekam `OUT` (tanpa `IN`), guard pada `projectApprovedLog` diperbarui untuk tetap memproyeksikan rekam kehadiran:
     - `scanIn: null` (kosong)
     - `scanOut: outLog.scanTime`
     - `rawScanIn: null`
     - `rawScanOut: outLog.scanTime`
     - `lateMinutes: 0` (tidak ada jam masuk)
     - `attendanceStatus: approved.some(l => !l.isWithinGeofence) ? 'DINAS_LUAR' : 'PRESENT'`

4. **Pengaturan Kebijakan Presensi (Strict vs Multi-Clocking):**
   - Tersedia opsi pengaturan sistem `attendance_mobile_strict_clock`:
     - **Default Mode (`false`):** Karyawan dapat melakukan absensi berkali-kali (misal absen pulang 3 kali di jam berbeda). Seluruh absensi dicatat sebagai log mandiri dengan status `PENDING`. Saat HRD memilih untuk menyetujui salah satu absensi (misal absen ke-3), jam absensi yang disetujui itulah yang disimpan/diproyeksikan ke `attendanceRecords`.
     - **Strict Mode (`true`):** Setelah absensi dilakukan, tombol presensi langsung non-aktif (karyawan dicegah absen berulang).

5. **Penanda Reviewer (Audit Trail):**
   - Pada antrean verifikasi HRD (`MobileApprovalsPage.tsx`) dan detail riwayat karyawan (`AttendanceEventDetails.tsx`):
     Ditampilkan badge penanda khusus: **"Langsung Pulang (Tanpa Masuk)"** dengan varian warna Amber/Indigo.

---

## 3. Data Model & Schema Diffs

### A. Tabel `attendanceSelfLogs`
Tidak memerlukan perubahan skema kolom baru; kolom yang sudah ada (`eventType`, `notes`, `reviewHistory`, `approvalStatus`) sudah sangat memadai:
- `eventType`: `'OUT'`
- `notes`: Catatan karyawan dengan tag otomatis `[DIRECT_OUT] ${notes}`.
- `approvalStatus`: Selalu `'PENDING'`.

### B. Tabel `systemSettings`
Memanfaatkan tabel `systemSettings` yang sudah ada untuk toggle kebijakan:
- `key`: `'attendance_mobile_strict_clock'`
- `value`: `false` (default: false / multi-clocking diizinkan)
- `description`: `'Jika true, tombol presensi mobile dinonaktifkan setelah presensi berhasil.'`

### C. Proyeksi Rekam Kehadiran (`attendanceRecords`)
Saat HRD menyetujui log `OUT` tanpa `IN`:
- `scanIn`: `null`
- `scanOut`: jam presensi (misal `16:06`)
- `attendanceStatus`: `'PRESENT'` (atau `'DINAS_LUAR'` jika luar radius kantor).

---

## 4. API Specifications

### A. `GET /api/v1/attendance/mobile/summary`
Menambahkan metadata kalkulasi shift helper dan konfigurasi strict pada respons attendance:
```json
{
  "attendance": {
    "checkedIn": false,
    "checkedOut": false,
    "workDate": "2026-10-26",
    "isLateAfternoon": true,
    "strictClock": false,
    "shiftWindow": {
      "scheduleIn": "08:00",
      "scheduleOut": "17:00",
      "canDirectOut": true
    }
  }
}
```

### B. `POST /api/v1/attendance/mobile/clock`
**Payload Request:**
```json
{
  "eventType": "OUT",
  "isDirectOut": true,
  "latitude": -8.65,
  "longitude": 115.22,
  "accuracy": 15,
  "notes": "Hadir dari jam 08:00, lupa tap masuk di HP",
  "photoBase64": "data:image/jpeg;base64,..."
}
```

**Validasi Backend:**
- `isDirectOut`: boolean opsional (default `false`).
- Jika `isDirectOut === true`:
  - `eventType` wajib `'OUT'`.
  - `notes` **wajib diisi** (minimal 3 karakter non-whitespace). Jika kosong, kembalikan HTTP 400: *"Keterangan wajib diisi untuk absensi pulang tanpa jam masuk."*
  - `approvalStatus` dipaksa `'PENDING'` (mengabaikan auto-approve shift).
  - `notes` otomatis diformat: `"[DIRECT_OUT] " + payload.notes.trim()`.
- Pemeriksaan multi-clock vs strict:
  - Jika `strictClock === true` dan sudah ada presensi pada tanggal kerja tersebut dengan eventType sama: tolak dengan HTTP 409.
  - Jika `strictClock === false` (default): izinkan pencatatan log baru untuk ditinjau HRD.

---

## 5. Frontend & Mobile UX

### A. Pemicu Tombol di Beranda & Halaman Presensi:
1. **Pagi hari / Sebelum Ambang Batas (`currentTime < scheduleIn + 5 jam`):**
   - Tombol cincin: **"Absen Masuk"** (langsung membuka pemindai wajah).
2. **Sore hari / Mendekati Jam Pulang (`currentTime >= scheduleIn + 5 jam` & `checkedIn === false`):**
   - Tombol cincin: **"Presensi Sekarang"** (dengan subtitle: *"Pilih Masuk atau Pulang"*).
   - Saat diklik: Muncul **SmartClockSelectionModal**.
3. **Karyawan yang sudah `checkedIn === true`:**
   - Tombol cincin tetap: **"Absen Pulang"** (langsung membuka pemindai wajah).
4. **Pasca-Absensi (Berdasarkan Mode Strict):**
   - Jika `strictClock === true`: Tombol cincin menjadi disabled ("Selesai").
   - Jika `strictClock === false` (default): Tombol tetap memungkinkan presensi susulan dengan konfirmasi.

### B. Desain `SmartClockSelectionModal`:
Modal berbasis `ModalShell`:
- **Judul:** Konfirmasi Kehadiran Hari Ini
- **Deskripsi:** Jam saat ini menunjukkan waktu sore/pulang kerja. Anda belum memiliki catatan absen masuk hari ini.
- **Pilihan 1: Absen Masuk (Terlambat)**
  - *Ikon:* `LogIn` (Emerald)
  - *Teks:* "Saya baru tiba di lokasi kantor sekarang."
  - *Aksi:* Membuka pemindai wajah dengan target `eventType: 'IN'`, `isDirectOut: false`.
- **Pilihan 2: Langsung Absen Pulang (Lupa Masuk Pagi)**
  - *Ikon:* `LogOut` (Amber / Indigo)
  - *Teks:* "Saya sudah hadir sejak pagi, ingin langsung absen pulang."
  - *Field Catatan (Wajib):* Textarea alasan/jam estimasi hadir pagi.
  - *Aksi:* Membuka pemindai wajah dengan target `eventType: 'OUT'`, `isDirectOut: true`, dan membawa catatan pengguna.

---

## 6. Reviewer HRD & Antrean Approval

1. **Anti-Bypass Approval:** Setiap log kepulangan langsung (`DIRECT_OUT`) wajib bernilai `PENDING` dan harus direview oleh HRD.
2. **Multiple Submissions Resolution:** Jika karyawan mengirim absensi berkali-kali (misal 3 kali log pulang), HRD dapat melihat seluruh log. Saat HRD menyetujui salah satu log (misal log ke-3), `projectApprovedLog` secara otomatis memperbarui `attendanceRecords` menggunakan data dari log yang baru disetujui tersebut.
3. **Badge Audit:** Tampilan antrean menyematkan tag `[DIRECT_OUT]` dan badge khusus *"Langsung Pulang (Tanpa Masuk)"*.
