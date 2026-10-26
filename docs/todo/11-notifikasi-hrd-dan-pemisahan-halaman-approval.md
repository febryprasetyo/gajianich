# Todo 11: Notifikasi HRD & Pemisahan Halaman Persetujuan (Approval & Pengaturan)

Dokumen ini merinci rencana teknis pembuatan **sistem notifikasi bagi HRD** untuk permohonan yang membutuhkan persetujuan, serta **pemisahan antarmuka** antara persetujuan absensi, persetujuan foto wajah, dan halaman pengaturan.

---

## 1. Latar Belakang & Kebutuhan

Saat ini, pada modul Presensi HR:
1. Alur persetujuan absensi mobile (`logs`), permohonan foto profil/wajah baru (`photos`), dan konfigurasi auto-approve shift (`settings`) masih disatukan dalam satu halaman tab tunggal di `/dashboard/attendance/approvals`. Hal ini membuat navigasi kurang fokus dan menyulitkan pemantauan antrean.
2. Belum ada sistem notifikasi langsung di dashboard HRD ketika ada karyawan yang mengirimkan permohonan absensi (misal: clock-in di luar radius, shift tanpa auto-approve) atau perubahan foto wajah yang menunggu review. HRD harus secara manual membuka halaman approval untuk memeriksa apakah ada antrean.

---

## 2. Ruang Lingkup & Keputusan Desain

### A. Saluran Notifikasi HRD
- **Tipe**: *In-app notification badge / lonceng* di header dashboard (`DashboardLayout.tsx`).
- **Indikator**: Badge counter angka dinamis merah/amber yang menunjukkan total permohonan pending yang belum diproses (`pendingAttendanceCount + pendingPhotoCount`).
- **Mekanisme**: Polling interval berkala (misal tiap 60 detik) saat tab aktif, dengan endpoint ringkas `GET /api/v1/attendance/approvals/badge-count` yang hemat query & token.
- **Dropdown Preview**: Saat ikon lonceng diklik, muncul flyout popover ringkas berisi:
  - Jumlah pengajuan absensi yang menunggu persetujuan (dengan tautan langsung ke halaman *Persetujuan Absensi*).
  - Jumlah permohonan foto wajah baru yang menunggu verifikasi (dengan tautan langsung ke halaman *Persetujuan Foto Wajah*).

### B. Pemisahan Halaman Navigasi
Memecah halaman tunggal `/dashboard/attendance/approvals` menjadi halaman mandiri yang terfokus:

1. **Persetujuan Absensi** (`/dashboard/attendance/approvals`):
   - Khusus menangani permohonan log absensi mobile karyawan (status `PENDING`).
   - Dilengkapi detail foto bukti saat absensi, peta GPS koordinat, status shift, dan aksi Setujui / Tolak dengan alasan penolakan.
   - Bebas dari tombol refresh manual (data termuat reaktif & refetch otomatis setelah aksi).
2. **Persetujuan Foto Wajah** (`/dashboard/attendance/approvals/photos`):
   - Khusus menangani permohonan pembaruan foto biometrik wajah (status `PENDING`).
   - Menampilkan perbandingan foto lama vs foto baru karyawan, alasan pembaruan, dan aksi Verifikasi / Tolak.
   - Menggunakan penamaan menu yang bersih dan jelas pada sidebar dashboard.
3. **Pengaturan** (`/dashboard/attendance/settings`):
   - Khusus menangani konfigurasi aturan persetujuan otomatis per shift (`autoApproveIn`, `autoApproveOut`), integrasi mesin/sumber data, dan aturan toleransi presensi.
   - Dipisahkan secara tegas dari antrean transaksi harian.

---

## 3. Rencana Tahapan Eksekusi (Phased Tasks)

### Fase 1: Backend API & Notification Counter
- [ ] Buat endpoint ringan `GET /api/v1/attendance/approvals/badge-count` (memerlukan permission `attendance.mobile.verify`).
  - Menghitung count `attendance_mobile_logs` dengan status `PENDING`.
  - Menghitung count `attendance_face_profiles` / `attendance_face_requests` dengan status `PENDING`.
  - Mengembalikan JSON: `{ pendingAttendance: number, pendingPhotos: number, totalPending: number }`.
- [ ] Unit & Integration Test untuk endpoint badge counter.

### Fase 2: Pemisahan Halaman Frontend (Dashboard)
- [ ] Refactor [MobileApprovalsPage.tsx](file:///home/fastpec/code/ams-app/frontend/src/components/attendance/MobileApprovalsPage.tsx):
  - Ekstrak sub-komponen `AttendanceApprovalsView` untuk log absensi.
  - Ekstrak sub-komponen `FacePhotoApprovalsView` untuk verifikasi foto wajah.
  - Pindahkan tab settings ke halaman `/dashboard/attendance/settings`.
- [ ] Buat rute baru [frontend/src/app/dashboard/attendance/approvals/photos/page.tsx](file:///home/fastpec/code/ams-app/frontend/src/app/dashboard/attendance/approvals/photos/page.tsx).
- [ ] Perbarui rute [frontend/src/app/dashboard/attendance/settings/page.tsx](file:///home/fastpec/code/ams-app/frontend/src/app/dashboard/attendance/settings/page.tsx) agar memuat pengaturan persetujuan shift secara mandiri.
- [ ] Sesuaikan struktur navigasi sidebar di [DashboardLayout.tsx](file:///home/fastpec/code/ams-app/frontend/src/components/layout/DashboardLayout.tsx):
  - `Persetujuan Absensi` (`/dashboard/attendance/approvals`)
  - `Persetujuan Foto Wajah` (`/dashboard/attendance/approvals/photos`)
  - `Pengaturan` (`/dashboard/attendance/settings`)

### Fase 3: Komponen Notifikasi Lonceng di Header Dashboard
- [ ] Tambahkan komponen `NotificationBadge` di header [DashboardLayout.tsx](file:///home/fastpec/code/ams-app/frontend/src/components/layout/DashboardLayout.tsx) (di samping profile user):
  - Ikon `Bell` dengan badge counter dinamis (tersembunyi jika 0).
  - Popover dropdown ringkas yang memisahkan jumlah antrean absensi dan foto wajah.
  - Polling reaktif berbasis SWR / interval timer bersih dengan cleanup saat unmount.

### Fase 4: Pengujian & Verifikasi Menyeluruh
- [ ] Verifikasi kepatuhan Master Desain GAJIANICH / Emerald Enterprise (tanpa tombol refresh manual, token warna konsisten, modal a11y).
- [ ] Typecheck frontend & backend (`npx tsc --noEmit`).
- [ ] Eksekusi automated unit test suite.
- [ ] Build Next.js (`npm run build`).
