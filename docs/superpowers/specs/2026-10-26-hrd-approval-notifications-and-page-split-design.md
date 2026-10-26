# Design Spec: Notifikasi HRD & Pemisahan Halaman Persetujuan (Approval & Pengaturan)

**Tanggal:** 2026-10-26  
**Status:** Draft / Menunggu Review Pengguna  
**Modul:** Attendance & HR Operations (`backend/src/routes/mobileApprovalRoutes.ts`, `frontend/src/components/attendance/`)

---

## 1. Summary & Problem Statement

### 1.1 Latar Belakang
Modul Presensi HR saat ini menggabungkan tiga fitur yang berbeda karakternya ke dalam satu halaman tab tunggal di `/dashboard/attendance/approvals`:
1. **Persetujuan Log Absensi**: Peninjauan harian absensi mobile karyawan (status `PENDING` karena di luar geofence atau shift tanpa auto-approve).
2. **Persetujuan Foto Wajah**: Verifikasi biometrik pembaruan foto profil/wajah karyawan baru.
3. **Pengaturan Persetujuan Shift**: Konfigurasi global aturan auto-approve per shift.

Penggabungan ini menyebabkan antarmuka padat, tata kelola izin akses kurang modular, dan navigasi menu tidak mencerminkan pemisahan tugas operasional harian vs konfigurasi kebijakan.

Selain itu, belum ada indikator peringatan atau notifikasi visual (*in-app notification*) bagi staf HRD/Admin ketika ada permohonan baru yang masuk. HRD harus proaktif memeriksa halaman approval secara manual, sehingga berisiko menunda persetujuan kehadiran atau pembaruan foto karyawan.

### 1.2 Masalah yang Diselesaikan
1. Tidak adanya pemberitahuan proaktif bagi staf HRD mengenai adanya antrean permohonan absensi & foto biometrik yang belum diproses.
2. Tercampurnya antrean operasional harian (*approvals*) dengan konfigurasi kebijakan (*settings*) dalam satu URL.
3. Tercampurnya verifikasi kehadiran (transaksi harian) dengan verifikasi identitas foto biometrik (master data profil).

---

## 2. Goals & Non-Goals

### Goals
- **G-1 (Notifikasi Lonceng In-App)**: Menyediakan tombol lonceng notifikasi di header dashboard dengan badge angka dinamis berwarna merah/amber yang menunjukkan jumlah total antrean `PENDING` (absensi + foto wajah).
- **G-2 (Popover Ringkas)**: Menyediakan dropdown popover saat lonceng diklik yang menampilkan rincian:
  - Jumlah pengajuan absensi pending (dengan link langsung ke `/dashboard/attendance/approvals`).
  - Jumlah verifikasi foto wajah pending (dengan link langsung ke `/dashboard/attendance/approvals/photos`).
- **G-3 (Endpoint Counter Ringan)**: Membuat endpoint backend `GET /api/v1/attendance/mobile/badge-count` yang menghitung agregasi antrean pending secara cepat dan hemat resource.
- **G-4 (Pemisahan Halaman Mandiri)**:
  - `/dashboard/attendance/approvals`: Khusus **Persetujuan Absensi** (log kehadiran mobile).
  - `/dashboard/attendance/approvals/photos`: Khusus **Persetujuan Foto Wajah** (verifikasi biometrik profil wajah).
  - `/dashboard/attendance/settings`: Khusus **Pengaturan** (kebijakan auto-approve per shift dan aturan absensi).
- **G-5 (Penyelarasan Menu Sidebar)**: Menyusun menu navigasi di bawah grup Presensi:
  - *Persetujuan Absensi* (`/dashboard/attendance/approvals`)
  - *Persetujuan Foto Wajah* (`/dashboard/attendance/approvals/photos`)
  - *Pengaturan* (`/dashboard/attendance/settings`)
- **G-6 (Kepatuhan Master Desain)**: Bebas dari tombol refresh manual, token warna Emerald Enterprise, responsif mobile/desktop, dan aksesibel (WCAG 2.2 AA).

### Non-Goals
- Tidak mengimplementasikan Web Push Service Worker atau SMS/WhatsApp gateway eksternal pada fase ini (fokus pada in-app badge & dropdown header).
- Tidak mengubah skema data tabel `attendance_self_logs`, `attendance_face_requests`, atau `attendance_shifts` (hanya memanfaatkan status `PENDING` yang sudah ada).
- Tidak menghapus permission `attendance.mobile.verify` yang sudah ada; kedua halaman approval menggunakan permission yang sama.

---

## 3. Data Model & Architecture Diffs

Tidak ada perubahan skema database (Zero Migration Diffs). Fitur ini memanfaatkan tabel yang sudah berjalan:
- `attendance_self_logs`: filter `approval_status = 'PENDING'`.
- `attendance_face_requests`: filter `status = 'PENDING'`.
- `attendance_shifts`: kolom `auto_approve_in`, `auto_approve_out`.

---

## 4. API Specifications

### Endpoint Baru: `GET /api/v1/attendance/mobile/badge-count`
- **Tujuan**: Mengambil total antrean persetujuan pending untuk ikon lonceng header.
- **Autentikasi**: Wajib Bearer Token dengan permission `attendance.mobile.verify`.
- **Query Execution**: Menjalankan 2 query count paralel via `Promise.all`:
  ```ts
  const [pendingAttendance, pendingPhotos] = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(attendanceSelfLogs)
      .where(eq(attendanceSelfLogs.approvalStatus, 'PENDING')),
    db.select({ count: sql<number>`count(*)` })
      .from(attendanceFaceRequests)
      .where(eq(attendanceFaceRequests.status, 'PENDING'))
  ]);
  ```
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "pendingAttendance": 3,
      "pendingPhotos": 1,
      "totalPending": 4
    }
  }
  ```
- **Cache Header**: `Cache-Control: private, no-cache, no-store, must-revalidate` (selalu data terkini).

---

## 5. Frontend & UI/UX Specifications

### 5.1 Komponen `NotificationBell` di Header Dashboard
- Diletakkan di header [DashboardLayout.tsx](file:///home/fastpec/code/ams-app/frontend/src/components/layout/DashboardLayout.tsx) tepat sebelum avatar/nama pengguna.
- Menampilkan ikon `Bell` (`lucide-react`) berukuran `w-5 h-5 text-slate-600 hover:text-slate-900`.
- Jika `totalPending > 0`: Menampilkan badge bulat merah/rose (`bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-white`).
- Polling: Dipanggil setiap 60 detik jika tab browser aktif (`document.visibilityState === 'visible'`) dan dibersihkan saat unmount.
- Popover Card (Glass/Shadow):
  - Header: "Notifikasi Persetujuan" & badge total pending.
  - Item 1: "Persetujuan Absensi" (Ikon `CalendarCheck`, badge jumlah pending, tombol tautan ke `/dashboard/attendance/approvals`).
  - Item 2: "Persetujuan Foto Wajah" (Ikon `ScanFace`, badge jumlah pending, tombol tautan ke `/dashboard/attendance/approvals/photos`).
  - State Kosong: "Semua pengajuan telah diproses" dengan ikon centang hijau lembut.

### 5.2 Pemisahan Halaman
1. **Halaman Persetujuan Absensi** (`/dashboard/attendance/approvals`):
   - Header: "Persetujuan Absensi Mobile" dengan deskripsi "Verifikasi antrean log absensi mandiri karyawan yang membutuhkan peninjauan manual HRD."
   - Menampilkan tabel/kartu log absensi, preview foto bukti saat absensi, peta titik koordinat GPS, dan modal persetujuan/penolakan dengan catatan.
2. **Halaman Persetujuan Foto Wajah** (`/dashboard/attendance/approvals/photos`):
   - Header: "Persetujuan Foto Wajah" dengan deskripsi "Verifikasi permohonan pembaruan foto biometrik profil karyawan."
   - Menampilkan kartu komparasi: Foto Lama vs Foto Baru, nama karyawan, tanggal pengajuan, dan tombol aksi Verifikasi / Tolak.
3. **Halaman Pengaturan** (`/dashboard/attendance/settings`):
   - Menambahkan section "Aturan Persetujuan Shift Otomatis" untuk mengaktifkan/menonaktifkan `autoApproveIn` dan `autoApproveOut` per shift secara mandiri.

---

## 6. Security, RBAC & Accessibility (a11y)

- **RBAC**: Endpoint `badge-count`, `verifications`, `face-requests`, dan `approval-settings` dilindungi permission `attendance.mobile.verify`. Pengguna tanpa izin ini tidak akan menjalankan polling lonceng notifikasi (bebas network overhead).
- **Keyboard Navigation**: Tombol lonceng mendukung `Enter`/`Space` untuk membuka popover, tombol `Esc` untuk menutup popover, dan `aria-expanded` / `aria-haspopup="dialog"`.
- **Master Desain**: Mengikuti palet GAJIANICH / Emerald Enterprise, font sans default Inter/Roboto, tanpa efek neon atau glassmorphism gelap.
