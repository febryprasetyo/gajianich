# Design Spec: Pembatasan Role ADMS (Admin & IT Admin) & Alur Registrasi Mesin

## 1. Summary & Problem Statement
Pengguna memerlukan perlindungan akses yang ketat pada pengelolaan mesin absensi:
- **Hanya SuperAdmin dan ITAdmin** yang diizinkan untuk menambah mesin, mengubah konfigurasi, menghapus mesin, dan mendaftarkan perangkat ke sistem ADMS.
- Pengguna lain (seperti HR Attendance, Staff, Karyawan) harus **ditolak aksesnya (HTTP 403 Forbidden)**.
- Ditemukan masalah di mana **"list Pilih Mesin Absensi tidak muncul saat registrasi"** karena:
  1. Endpoint `/attendance/devices/adms/candidates` sebelumnya dilindungi oleh permission `attendance.manage`, padahal role `ITAdmin` tidak memiliki permission tersebut (sehingga IT Admin mendapat 403 saat memanggil list kandidat).
  2. Filter grup organisasi membatasi kandidat hanya pada kelompok organisasi yang dipilih. Jika kelompok organisasi tersebut belum memiliki mesin (misal MGM / group 2), dropdown menjadi kosong.
  3. Tidak adanya fitur input mesin baru secara langsung di modal registrasi ADMS menyebabkan pengguna tidak dapat mendaftarkan mesin baru yang belum di-input ke sistem secara manual sebelumnya.

## 2. Goals & Non-Goals
### Goals:
1. **Role Enforcement**:
   - Pasang pembatasan role `requireRoles('SuperAdmin', 'ITAdmin')` pada seluruh endpoint CRUD mesin absensi dan registrasi ADMS di backend.
   - Sembunyikan dan nonaktifkan aksi penambahan/registrasi mesin di frontend bagi pengguna di luar SuperAdmin dan ITAdmin.
2. **Penyempurnaan List Kandidat Mesin**:
   - Perkaya endpoint `GET /attendance/devices/adms/candidates` agar mencakup metadata grup (`groupName` & `groupId`) dan mengembalikan seluruh kandidat mesin yang dapat diakses oleh IT Admin & Super Admin.
   - Tambahkan fetch langsung di modal registrasi saat dibuka agar pengguna tidak perlu menunggu polling background.
3. **Dukungan Registrasi Mesin Baru Langsung (Zero-Friction)**:
   - Dukung pembuatan mesin fisik baru langsung dari modal registrasi ADMS (Mode "Mesin Baru": Nama Mesin, Kelompok Organisasi, IP, Port, Serial Number, Subnet Allowlist).
   - Simpan mesin ke `attendance_devices` dan daftarkan ke `adms.devices` dalam 1 transaksi atomik PostgreSQL.

### Non-Goals:
- Mengubah skema log `adms.review_logs` atau mencampur data ADMS dengan `attendance_device_raw_logs` (payroll). Isolasi tetap terjaga.
- Mengubah fungsi review log kehadiran atau monitoring umum yang dapat dilihat oleh staf HR untuk keperluan verifikasi absensi.

## 3. Data Model & Architecture Diffs
- Tabel `attendance_devices`:
  - Kolom `connection_type` diisi `'ADMS'` saat didaftarkan ke ADMS.
  - Record baru dapat dibuat langsung saat registrasi ADMS jika mesin belum terdaftar sebelumnya.
- Tabel `adms.devices`:
  - Menyimpan `serial`, `device_id`, `group_id`, `allowed_network`, dan `enabled`.

## 4. API Contract & Security
### Endpoint Permissions:
| Endpoint | Method | Role Allowed | Deskripsi |
|---|---|---|---|
| `/api/v1/attendance/devices/` | POST | `SuperAdmin`, `ITAdmin` | Buat mesin absensi fisik baru |
| `/api/v1/attendance/devices/:id` | PUT | `SuperAdmin`, `ITAdmin` | Edit mesin absensi |
| `/api/v1/attendance/devices/:id` | DELETE | `SuperAdmin`, `ITAdmin` | Hapus mesin absensi |
| `/api/v1/attendance/devices/adms/candidates` | GET | `SuperAdmin`, `ITAdmin` | Ambil kandidat mesin untuk ADMS |
| `/api/v1/attendance/devices/adms/register` | POST | `SuperAdmin`, `ITAdmin` | Daftarkan mesin ke ADMS (existing atau baru) |
| `/api/v1/attendance/devices/adms/:id/toggle` | PATCH | `SuperAdmin`, `ITAdmin` | Toggle aktif/nonaktif mesin ADMS |

### Payload `POST /api/v1/attendance/devices/adms/register`:
**Opsi 1 (Mesin yang Sudah Ada):**
```json
{
  "deviceId": 1,
  "serial": "WAE4242900026",
  "sourceCidr": "192.168.10.224/32",
  "enabled": true
}
```
**Opsi 2 (Mesin Baru Langsung):**
```json
{
  "name": "Absensi Office Baru",
  "groupId": 1,
  "ip": "192.168.10.250",
  "port": 4370,
  "serial": "WAE9999999999",
  "sourceCidr": "192.168.10.250/32",
  "enabled": true
}
```

## 5. UI/UX Specifications
- Modal Registrasi ADMS (`AdmsRegistrationModal.tsx`):
  - Tab 1: **"Pilih Mesin Terdaftar"** — Menampilkan dropdown mesin dengan label `[Nama] · [IP] · [Perusahaan/Unit]`. Jika kosong, menampilkan notifikasi edukatif.
  - Tab 2: **"Daftarkan Mesin Baru"** — Form lengkap dengan input nama, unit perusahaan, IP LAN, port, SN, dan allowlist.
  - Feedback visual yang jelas saat loading atau error.
- Halaman ADMS Monitor (`page.tsx`):
  - Hanya menampilkan tombol aksi registrasi dan toggle untuk SuperAdmin & ITAdmin.

