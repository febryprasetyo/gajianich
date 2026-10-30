# Design Spec: Pendaftaran Mesin & Pengelolaan Allowlist ADMS dari Front End

- **Status**: Draft Spec (Menunggu Approval Pengguna)
- **Tanggal**: 2026-10-30
- **Penulis**: AI Engineer / Gemini 3.8 Flash
- **Referensi Desain**: `UI_DESIGN_SYSTEM_GUIDE.md`, `DESIGN.md`

---

## 1. Summary & Problem Statement

Saat ini, pendaftaran mesin absensi ke layanan ADMS receiver (`adms.devices`) dan pengaturan IP allowlist (`allowed_network`) masih harus dijalankan secara manual melalui terminal CLI server:
```bash
docker compose exec adms node src/cli.mjs register --device-id <ID> --serial <SN> --source-cidr <IP>/32
```
Hal ini menyulitkan tim HR/Admin dan berisiko salah ketik di lingkungan operasional harian. Selain itu, pengguna membutuhkan pembedaan tegas antara mesin dengan koneksi **Fisik (Tarik Ethernet Manual)** vs **ADMS (Cloud Server Push Otomatis)**, sehingga mesin ADMS terlindung dari tarikan manual kabel LAN dan siap untuk transisi penuh saat jaringan ADMS stabil.

---

## 2. Goals & Non-Goals

### Goals
1. **Pendaftaran Mesin ADMS dari Front End**: Menyediakan antarmuka modal interaktif pada halaman **Review ADMS** (`/dashboard/attendance/adms`) untuk mendaftarkan perangkat ke skema ADMS tanpa perlu membuka terminal CLI.
2. **Pengelolaan Allowlist Jaringan (CIDR)**: Memungkinkan penambahan dan pembaruan IP / CIDR mesin yang diizinkan (misal `192.168.10.224` atau `192.168.10.0/24`) secara aman.
3. **Toggle Aktivasi ADMS**: Memungkinkan Admin mengaktifkan atau menonaktifkan penerimaan data ADMS (`enabled: true/false`) per perangkat.
4. **Diferensiasi Tipe Koneksi**: Memastikan `connection_type` perangkat diperbarui menjadi `'ADMS'`, sehingga endpoint penarikan TCP socket manual secara otomatis diproteksi.
5. **Keamanan & Isolasi Multitenant**: Memvalidasi hak akses `attendance.manage` dengan HR scope write, isolasi `group_id`, serta sanitasi format IP/CIDR yang ketat (menolak `0.0.0.0/0` atau IP publik liar).
6. **Kepatuhan Desain Master**: Menggunakan `ModalShell`, warna emerald baku (`bg-emerald-600`), icon aksi representatif (`RowActionButton`), tanpa tombol refresh manual (data termuat reaktif).

### Non-Goals
1. Tidak mengubah protokol ZKTeco IClock atau file listener HTTP port 8081 (`adms-server/src/*`).
2. Tidak mencampurkan data scan ADMS ke tabel absensi kalkulasi payroll utama (`public.attendance_device_raw_logs`); data scan ADMS tetap diisolasi ke `adms.review_logs`.
3. Tidak menghapus kemampuan penarikan Ethernet TCP bagi mesin yang memang belum siap ADMS.

---

## 3. Data Model & Database Operations

Tabel yang digunakan sudah tersedia di database PostgreSQL:
- **`public.attendance_devices`**:
  - `id`: bigint (PK)
  - `name`: varchar(150)
  - `serial_number`: varchar(100)
  - `ip`: varchar(50)
  - `port`: integer
  - `group_id`: bigint (FK `organization_groups.id`)
  - `connection_type`: varchar(50) (`'Ethernet'` | `'ADMS'`)
  - `is_enabled`: boolean
- **`adms.devices`**:
  - `serial`: varchar(100) (PK)
  - `device_id`: bigint (UNIQUE, FK `attendance_devices.id`)
  - `group_id`: bigint (FK `organization_groups.id`)
  - `allowed_network`: cidr (NOT NULL)
  - `enabled`: boolean (NOT NULL DEFAULT true)
  - `attlog_stamp`: varchar(100) (DEFAULT '0')
  - `last_seen_at`: timestamptz
  - `last_data_at`: timestamptz

### Database Transaction Boundary (Saat Registrasi):
```sql
BEGIN;
-- 1. Verifikasi kepemilikan perangkat di grup aktif
SELECT id, group_id, serial_number, is_enabled FROM public.attendance_devices WHERE id = $deviceId AND group_id = $groupId FOR UPDATE;

-- 2. Update status koneksi perangkat ke ADMS dan serial jika ada
UPDATE public.attendance_devices 
SET connection_type = 'ADMS', serial_number = coalesce(nullif($serial, ''), serial_number), updated_at = now()
WHERE id = $deviceId;

-- 3. Upsert allowlist dan status pada adms.devices
INSERT INTO adms.devices (serial, device_id, group_id, allowed_network, enabled)
VALUES ($serial, $deviceId, $groupId, $sourceCidr::cidr, $enabled)
ON CONFLICT (serial) DO UPDATE SET 
  allowed_network = EXCLUDED.allowed_network,
  enabled = EXCLUDED.enabled
WHERE adms.devices.device_id = EXCLUDED.device_id AND adms.devices.group_id = EXCLUDED.group_id;

COMMIT;
```

---

## 4. API Specification

Semua endpoint dilindungi oleh `authenticateToken`, `requirePermission(['attendance.manage'])`, dan `requireOrganizationScope('hr', 'write')`.

### 1. `GET /api/v1/attendance/devices/adms/candidates`
Mengambil daftar perangkat dalam grup aktif yang tersedia untuk registrasi atau edit ADMS.

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Absensi Office",
      "serialNumber": "WAE4242900026",
      "ip": "192.168.10.224",
      "connectionType": "ADMS",
      "isEnabled": true,
      "admsRegistered": true,
      "admsEnabled": true,
      "allowedNetwork": "192.168.10.224/32",
      "lastSeenAt": "2026-10-30T05:41:24.058Z"
    },
    {
      "id": 2,
      "name": "Absensi Produksi",
      "serialNumber": "WAE4242300038",
      "ip": "192.168.10.4",
      "connectionType": "Ethernet",
      "isEnabled": true,
      "admsRegistered": false,
      "admsEnabled": false,
      "allowedNetwork": null,
      "lastSeenAt": null
    }
  ]
}
```

### 2. `POST /api/v1/attendance/devices/adms/register`
Mendaftarkan atau memperbarui registrasi mesin ADMS beserta allowlist IP-nya.

**Request Body:**
```json
{
  "deviceId": 2,
  "serial": "WAE4242300038",
  "sourceCidr": "192.168.10.4/32",
  "enabled": true
}
```
*Aturan Validasi:*
- `deviceId`: Integer positif, wajib ada di grup organisasi aktor.
- `serial`: String alfanumerik `^[A-Za-z0-9_-]{1,100}$`.
- `sourceCidr`: IPv4 atau format CIDR valid (misal `192.168.10.4` otomatis menjadi `192.168.10.4/32`). Subnet mask antara `/16` s.d. `/32` (menolak subnet terlalu luas seperti `0.0.0.0/0`).
- `enabled`: Boolean opsional (default `true`).

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Mesin ADMS berhasil didaftarkan dan allowlist diperbarui.",
  "data": {
    "deviceId": 2,
    "serial": "WAE4242300038",
    "allowedNetwork": "192.168.10.4/32",
    "enabled": true
  }
}
```

### 3. `PATCH /api/v1/attendance/devices/adms/:deviceId/toggle`
Mengaktifkan / menonaktifkan penerimaan data ADMS tanpa mengubah konfigurasi IP.

**Request Body:**
```json
{
  "enabled": false
}
```

---

## 5. Frontend & UI/UX Specification

### Penempatan di Halaman `Review ADMS` (`/dashboard/attendance/adms`):
1. **Tombol Header (PageHeader Action)**:
   - Tombol primer emerald: **`+ Registrasi Mesin ADMS`** (hanya tampil jika user memiliki permission `attendance.manage`).
2. **Kolom Aksi pada Tabel Koneksi Mesin ADMS**:
   - Kolom "Aksi" dengan `RowActionButton`:
     - Tombol `Edit` (ikon pensil): Membuka modal edit allowlist IP dan serial.
     - Tombol `Toggle` (ikon Power / Check): Mengaktifkan/menonaktifkan penerimaan ADMS secara cepat.
3. **Komponen Modal `AdmsRegistrationModal`**:
   - Memakai `ModalShell`.
   - Dropdown memilih mesin dari daftar kandidat (jika belum terdaftar).
   - Input Serial Number (terisi otomatis dari data mesin, dapat diperbaiki jika salah).
   - Input Alamat IP Mesin / CIDR Allowlist: dilengkapi helper text ramah:
     > *"Masukkan IP socket mesin absensi di LAN (misal: 192.168.10.224). Gunakan /32 untuk satu IP spesifik atau /24 untuk satu subnet kantor."*
   - Checkbox status: *"Aktifkan penerimaan data ADMS segera"*.
   - Tombol "Batal" & Tombol primer "Simpan & Daftarkan".

---

## 6. Security, Validation & Verification

1. **RBAC & Authorization**:
   - Wajib memiliki role/izin `attendance.manage`. HR viewer atau operator tanpa izin kelola akan ditolak dengan HTTP 403.
2. **Sanitasi Input Jaringan**:
   - Validasi ketat parser IPv4 & CIDR regex.
   - Larangan penggunaan `0.0.0.0/0` untuk mencegah bypass allowlist.
3. **Automated Tests**:
   - Backend unit & integration test:
     - Mendaftarkan mesin baru dengan CIDR valid $\rightarrow$ Sukses 200.
     - Mencoba mendaftarkan mesin dari kelompok/grup lain $\rightarrow$ Ditolak 404 / 403.
     - Format CIDR invalid atau serial invalid $\rightarrow$ Ditolak 400.
     - Toggle status enabled/disabled $\rightarrow$ Sukses memperbarui `adms.devices.enabled`.
   - Frontend test:
     - Form validation, modal close/open, feedback error/success.

