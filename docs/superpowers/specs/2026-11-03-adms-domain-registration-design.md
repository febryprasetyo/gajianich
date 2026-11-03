# Design Spec: Pembaruan Pendaftaran Mesin ADMS Berbasis Domain Name (Tanpa IP Address)

- **Status**: Draft Spec (Menunggu Approval Pengguna)
- **Tanggal**: 2026-11-03
- **Fitur**: Pembaruan Pendaftaran Mesin ADMS (Domain-Based Push, No IP Required)
- **Referensi Desain**: `UI_DESIGN_SYSTEM_GUIDE.md`, `DESIGN.md`

---

## 1. Summary & Problem Statement

Sebelumnya, sistem pendaftaran mesin absensi ADMS mengharuskan input **Alamat IP** mesin dan **IP/CIDR Allowlist** (`allowed_network`), dengan asumsi mesin berada di jaringan IP statis tertentu dan koneksi diverifikasi berdasarkan IP pengirim (socket address).

Saat ini, seluruh mesin ADMS telah dikonfigurasi untuk terhubung ke server menggunakan **nama domain** (FQDN). Mesin-mesin absensi tersebut berada di berbagai cabang/lokasi dengan IP publik dinamis (dynamic IP/DHCP/ISP seluler) yang terus berubah, sehingga pembatasan IP statis / CIDR allowlist menjadi kendala (blokir koneksi) dan input Alamat IP saat pendaftaran mesin baru menjadi tidak relevan.

Pendaftaran mesin ADMS perlu diperbarui agar:
1. Pendaftaran mesin ADMS cukup menggunakan **Nama Mesin**, **Nomor Seri Mesin (SN)**, dan **Kelompok Organisasi (Unit/Cabang)** tanpa meminta Alamat IP mesin maupun IP allowlist.
2. Pada mode mesin yang sudah ada (existing device), tidak lagi mewajibkan pengisian CIDR allowlist.
3. ADMS Receiver mengizinkan request dari mesin yang terdaftar secara valid berdasarkan kecocokan Nomor Seri (`serial`) dan status aktif (`enabled = true`), dengan network allowlist dibuat terbuka (`0.0.0.0/0` / any) secara default untuk mesin ADMS domain-based.
4. Mesin tipe fisik/Ethernet LAN konvensional (tarik TCP manual port 4370) tetap mempertahankan Alamat IP karena dibutuhkan untuk penarikan langsung lewat LAN internal.

---

## 2. Goals & Non-Goals

### Goals
1. **Pendaftaran Mesin Baru ADMS Tanpa IP**: Form registrasi mesin baru untuk tipe ADMS di modal ADMS (`AdmsRegistrationModal`) maupun modal tambah mesin di Halaman Perangkat Presensi (`AttendanceDevicesPage`) hanya memerlukan:
   - Nama Mesin (wajib)
   - Nomor Seri / SN (wajib)
   - Kelompok Unit/Cabang Organisasi (wajib)
   - Status Aktif (checkbox)
   - Lokasi Mesin (opsional di halaman perangkat)
   - Menghapus input Alamat IP, Port, dan CIDR Allowlist untuk registrasi ADMS.
2. **Registrasi Mesin Existing Tanpa CIDR**: Registrasi mesin yang sudah ada ke ADMS cukup memilih mesin dan mengonfirmasi nomor seri (SN) tanpa mewajibkan input CIDR allowlist (otomatis set `0.0.0.0/0` atau mempertahankan allowlist bila ingin diisi spesifik).
3. **Penyelarasan Backend (`admsRegistration.ts` & `attendanceDeviceController.ts`)**:
   - `parseRegisterInput` tidak lagi melempar error saat `ip` atau `sourceCidr` tidak disertakan pada mesin ADMS.
   - Kolom `ip` di tabel `public.attendance_devices` untuk mesin ADMS domain-based diisi fallback placeholder `adms.domain` atau `adms-${serial}` guna menjaga keunikan index `(ip, port)`.
   - `adms.devices.allowed_network` diisi default `0.0.0.0/0` untuk pendaftaran mesin ADMS baru, sehingga koneksi push dari domain/IP manapun diterima selama SN cocok dan perangkat terdaftar aktif.
4. **Pembaruan ADMS Receiver (`adms-server`)**:
   - Memastikan `adms-server/src/store.mjs` menerima koneksi dari network `0.0.0.0/0` (PostgreSQL `inet <<= cidr` berjalan sempurna dengan `0.0.0.0/0`).
5. **UI/UX Bersih Sesuai Master Desain**:
   - Menghilangkan field IP & allowlist yang membingungkan bagi pengguna saat mendaftarkan mesin ADMS.
   - Kolom tabel ADMS yang sebelumnya menampilkan IP/CIDR disesuaikan menjadi informasi koneksi berbasis Domain/Cloud Push.

### Non-Goals
1. Tidak mengubah mesin bertipe **Ethernet (Koneksi Fisik Lokal LAN)**; mesin Ethernet tetap memerlukan IP & Port lokal karena aplikasi GAJIANICH menarik data TCP secara direct.
2. Tidak mengubah format transmisi log ADMS (`/iclock/cdata`, `/iclock/getrequest`, `/iclock/devicecmd`).
3. Tidak menghapus isolasi tenant multitenant (`group_id`) dan proteksi role RBAC (`attendance.manage`).

---

## 3. Data Model & Database Operations

### Schema Impact
- **`public.attendance_devices`**: Kolom `ip` bertipe `varchar(50) NOT NULL`. Untuk mesin ADMS yang didaftarkan tanpa IP, nilai `ip` disimpan sebagai `adms.domain` atau `adms-${serial}` guna menjaga keunikan index `(ip, port)`.
- **`adms.devices`**: Kolom `allowed_network` bertipe `cidr NOT NULL`. Untuk mesin ADMS berbasis domain publik dinamis, nilai `allowed_network` diset ke `0.0.0.0/0`.

### Database Operations (Registrasi ADMS):
```sql
BEGIN;
-- Mode Mesin Baru:
INSERT INTO public.attendance_devices(code, name, ip, port, serial_number, connection_type, is_enabled, group_id)
VALUES ($code, $name, $autoAdmsIp, 4370, $serial, 'ADMS', true, $groupId)
RETURNING id;

-- Upsert ke adms.devices dengan allowed_network = '0.0.0.0/0' (menerima semua IP asal mesin):
INSERT INTO adms.devices(serial, device_id, group_id, allowed_network, enabled)
VALUES ($serial, $deviceId, $groupId, '0.0.0.0/0'::cidr, $enabled)
ON CONFLICT (serial) DO UPDATE SET
  allowed_network = EXCLUDED.allowed_network,
  enabled = EXCLUDED.enabled
WHERE adms.devices.device_id = EXCLUDED.device_id AND adms.devices.group_id = EXCLUDED.group_id;
COMMIT;
```

---

## 4. API Specifications

### 1. `POST /api/v1/attendance/devices/adms/register`
**Payload Mode Baru (New Device):**
```json
{
  "mode": "new",
  "name": "Absensi Kantor Pusat",
  "serial": "WAE4242900026",
  "groupId": 1,
  "enabled": true
}
```
*(Tidak ada field `ip` atau `sourceCidr` yang diwajibkan)*

**Payload Mode Existing:**
```json
{
  "mode": "existing",
  "deviceId": 2,
  "serial": "WAE4242900026",
  "enabled": true
}
```
*(Field `sourceCidr` menjadi opsional, default `0.0.0.0/0`)*

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Mesin ADMS \"Absensi Kantor Pusat\" berhasil didaftarkan berbasis nama domain.",
  "data": {
    "deviceId": 5,
    "serial": "WAE4242900026",
    "enabled": true
  }
}
```

---

## 5. Frontend UI/UX Flow

1. **Modal Registrasi Mesin ADMS (`AdmsRegistrationModal.tsx`)**:
   - Tab 1: **Daftarkan Mesin yang Ada**:
     - Pilih Mesin dari dropdown.
     - Nomor Seri Mesin (SN) (auto-fill / dapat diedit).
     - Input Allowlist IP/CIDR dihilangkan (otomatis diset default `0.0.0.0/0`).
     - Checkbox "Aktifkan penerimaan data ADMS".
   - Tab 2: **Daftarkan Mesin Baru**:
     - Nama Mesin (wajib).
     - Kelompok Unit/Cabang (wajib).
     - Nomor Seri Mesin (SN) (wajib).
     - Keterangan info domain: *"Mesin ini akan terhubung secara otomatis ke server ADMS melalui nama domain yang telah disetel pada mesin absensi."*
     - Field IP, Port, dan Allowlist CIDR dihilangkan.
     - Checkbox "Langsung aktifkan penerimaan presensi ADMS".

2. **Modal Tambah Mesin di Halaman Mesin Presensi (`AttendanceDevicesPage.tsx`)**:
   - Jika tab **Mesin Cloud ADMS** dipilih:
     - Hanya menampilkan Nama Mesin, Nomor Seri (SN), Lokasi (opsional), dan Unit/Cabang.
     - Menghapus input Alamat IP dan input Allowlist CIDR.

3. **Tabel Tampilan Mesin ADMS**:
   - Mengubah kolom tabel yang sebelumnya menampilkan IP/CIDR menjadi badge status koneksi Domain Push.

