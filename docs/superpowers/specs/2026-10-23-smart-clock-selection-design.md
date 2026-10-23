# Design Spec: Smart Clock Selection (Pilihan Masuk vs Pulang)

**Tanggal:** 23 Oktober 2026  
**Status:** DRAFT (Menunggu Persetujuan Pengguna)  
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
Implementasi **Smart Clock Selection**: Jika waktu server saat ini sudah memasuki paruh kedua shift atau mendekati jam pulang (misal `>= scheduleIn + 4 jam` atau `currentTime >= 14:00` pada shift kantor normal), dan karyawan belum melakukan absen masuk, sistem tidak memaksakan event `IN`. Sebaliknya, sistem mendeteksi situasi ini dan menampilkan modal interaktif pilihan:
1. **Absen Masuk (Terlambat)**: Untuk karyawan yang memang baru hadir di sore hari.
2. **Langsung Absen Pulang (Lupa Absen Masuk)**: Untuk karyawan yang sudah hadir sejak pagi namun lupa absen masuk, sehingga langsung mencatat jam kepulangan tanpa perlu absen 2x.

---

## 2. Goals & Non-Goals

### Goals
1. **Smart Detection Window**: Mendeteksi secara cerdas kapan dialog pemilihan perlu muncul (hanya saat belum ada `IN` dan waktu saat ini sudah melewati ambang batas siang/sore shift kerja).
2. **Dukungan Absen Pulang Tunggal (`DIRECT_OUT`)**: Backend mengizinkan pencatatan `eventType: 'OUT'` meskipun belum ada rekam `IN`, dengan ketentuan:
   - Status approval otomatis berstatus `PENDING` (wajib ditinjau oleh HRD).
   - Kolom catatan (`notes` / `reason`) dapat diisi alasan lupa absen masuk (opsional/rekomendasi).
   - Proyeksi ke `attendanceRecords`: `scanIn = null`, `scanOut = jam keluar`, `status = 'NO_CLOCK_IN'` / `NEEDS_REVIEW`.
3. **Penyelarasan UX & Aksesibilitas**: Menggunakan dialog pilihan yang ramah mobile, sesuai panduan desain GAJIANICH / Emerald Enterprise, dengan tombol aksi yang jelas dan kontras tinggi.
4. **Audit Trail**: Mencatat flag dan log bahwa absensi ini merupakan "Absen Pulang Tanpa Absen Masuk" di riwayat verifikasi HRD.

### Non-Goals
1. Tidak mengubah alur normal pagi hari (pukul 06:00 – 12:00 tetap langsung "Absen Masuk" satu klik).
2. Tidak mengubah alur karyawan yang sudah memiliki rekam masuk (tetap langsung "Absen Pulang").
3. Tidak melakukan auto-approve untuk kasus `DIRECT_OUT` (wajib manual review oleh HRD demi integritas data kehadiran).

---

## 3. Data Model & Schema Diffs

### A. Tabel `attendanceSelfLogs`
Tidak memerlukan perubahan skema kolom baru; kolom yang sudah ada (`eventType`, `notes`, `reviewHistory`, `approvalStatus`) sudah sangat memadai:
- `eventType`: `'OUT'`
- `notes`: Catatan karyawan (misal: *"Lupa absen masuk pagi, hadir pukul 08:00"* atau tag sistem `[DIRECT_OUT]`).
- `approvalStatus`: Selalu `'PENDING'`.

### B. Proyeksi Rekam Kehadiran (`attendanceRecords`)
Saat HRD menyetujui log `OUT` tanpa `IN`:
- `scanIn`: `null`
- `scanOut`: jam presensi (misal `16:06`)
- `attendanceStatus`: `'PRESENT'` (atau `'NO_CLOCK_IN'` jika belum disetujui, sesuai aturan rekap Talenta).

---

## 4. API Specifications

### A. `GET /api/v1/attendance/mobile/summary`
Menambahkan metadata kalkulasi shift helper pada respons attendance:
```json
{
  "attendance": {
    "checkedIn": false,
    "checkedOut": false,
    "workDate": "2026-10-23",
    "isLateAfternoon": true,
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
  "notes": "Lupa absen masuk pagi, hadir pukul 08:00",
  "photo": "data:image/webp;base64,..."
}
```

**Validasi Backend:**
- Jika `eventType === 'OUT'` dan `entry === undefined`:
  - Jika `isDirectOut === true`: **Diizinkan**.
  - `approvalStatus` dipaksa menjadi `'PENDING'` (tidak berlaku auto-approval shift).
  - Catatan log otomatis ditambahkan penanda verifikasi: `"[DIRECT_OUT] Pulang tanpa absen masuk"`.
  - Jika `isDirectOut` tidak dikirim / `false`: Error `Belum melakukan presensi masuk.` tetap dipertahankan untuk integritas request standar.

---

## 5. Frontend & Mobile UX

### A. Kondisi Pemicu Tombol di Beranda & Halaman Presensi:
1. **Pagi hari / Awal Shift (`currentTime < ambang batas sore`, misal < 13:00 / 14:00):**
   - Tombol utama: **"Absen Masuk"** (langsung membuka pemindai wajah).
2. **Sore hari / Mendekati Jam Pulang (`currentTime >= ambang batas` & `checkedIn === false`):**
   - Tombol utama: **"Presensi Sekarang"** (dengan subtitle: *"Pilih Masuk atau Pulang"*).
   - Saat diklik: Muncul modal pilihan elegan (**Smart Clock Selection Modal**).

### B. Desain Smart Clock Selection Modal:
Modal berbasis `ModalShell`:
- **Judul:** Konfirmasi Kehadiran Hari Ini
- **Deskripsi:** Jam saat ini menunjukkan **16:06 WITA** (mendekati jam pulang kerja). Anda belum memiliki catatan absen masuk hari ini.
- **Kartu Pilihan 1: Absen Masuk (Terlambat)**
  - *Ikon:* `LogIn` (Emerald)
  - *Teks:* "Saya baru tiba di kantor sekarang."
  - *Aksi:* Membuka pemindai wajah dengan target `eventType: 'IN'`.
- **Kartu Pilihan 2: Langsung Absen Pulang (Lupa Masuk Pagi)**
  - *Ikon:* `LogOut` (Amber / Indigo)
  - *Teks:* "Saya sudah hadir sejak pagi, ingin langsung absen pulang."
  - *Field opsional:* Input catatan singkat ("Jam hadir pagi").
  - *Aksi:* Membuka pemindai wajah dengan target `eventType: 'OUT'` dan `isDirectOut: true`.

---

## 6. Security, Integrity & Edge Cases

1. **Anti-Bypass Approval:** Setiap log kepulangan langsung (`DIRECT_OUT`) wajib bernilai `PENDING` dan harus direview oleh HRD. Shift yang mengaktifkan `autoApproveOut: true` **tidak boleh** meng-auto-approve log `DIRECT_OUT`.
2. **Pencegahan Double-Out:** Setelah `DIRECT_OUT` berhasil, `checkedOut: true` sehingga karyawan tidak dapat melakukan clock out ganda.
3. **Face & GPS Tetap Wajib:** Verifikasi biometrik wajah dan koordinat GPS tetap diproses 100% sama dengan presensi biasa.
