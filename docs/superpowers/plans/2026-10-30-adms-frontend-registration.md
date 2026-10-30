# Implementation Plan: Pendaftaran Mesin & Pengelolaan Allowlist ADMS dari Front End

- **Status**: Draft Plan (Menunggu Approval Pengguna)
- **Design Spec**: [2026-10-30-adms-frontend-registration-design.md](../specs/2026-10-30-adms-frontend-registration-design.md)
- **Tujuan**: Memungkinkan HR/Admin mendaftarkan mesin ke ADMS, mengelola IP allowlist (CIDR), dan mengubah tipe koneksi menjadi ADMS langsung dari Front End.

---

## Shared Interfaces

```typescript
// Shared Data Types untuk Frontend & Backend
export interface AdmsCandidateDevice {
  id: number;
  name: string;
  serialNumber: string | null;
  ip: string;
  connectionType: 'Ethernet' | 'ADMS';
  isEnabled: boolean;
  admsRegistered: boolean;
  admsEnabled: boolean;
  allowedNetwork: string | null;
  lastSeenAt: string | null;
}

export interface RegisterAdmsDeviceInput {
  deviceId: number;
  serial: string;
  sourceCidr: string;
  enabled?: boolean;
}

export interface ToggleAdmsDeviceInput {
  enabled: boolean;
}
```

---

## Phase-by-Phase Task Checklist

### Phase 1: Backend Service & Validation (TDD)
- [x] Buat file unit test `backend/src/services/admsRegistration.test.ts` untuk memverifikasi validasi input CIDR, serial, dan isolasi group scope.
- [x] Buat helper validator `backend/src/services/admsRegistration.ts`:
  - `parseSourceCidr(input: string): string` (normalisasi IP `192.168.1.1` $\rightarrow$ `192.168.1.1/32`, memvalidasi rentang mask `/16` s.d. `/32`, menolak `0.0.0.0/0`).
  - `registerAdmsDevice(pool, scope, input)`: Melakukan pengecekan kepemilikan group, update `attendance_devices.connection_type = 'ADMS'`, dan upsert `adms.devices`.
  - `toggleAdmsDevice(pool, scope, deviceId, enabled)`: Update status `adms.devices.enabled`.
  - `getAdmsCandidates(pool, scope)`: Query daftar kandidat perangkat beserta status registrasi ADMS-nya.
- [x] Verifikasi tes backend lulus: `npx tsx --test backend/src/services/admsRegistration.test.ts`.

### Phase 2: Backend Routes & Controller
- [x] Buat controller handler di `backend/src/controllers/admsMonitoringController.ts`:
  - `getAdmsCandidatesHandler`
  - `registerAdmsDeviceHandler`
  - `toggleAdmsDeviceHandler`
- [x] Daftarkan rute baru di `backend/src/routes/attendanceDeviceRoutes.ts` dengan proteksi middleware `requirePermission(['attendance.manage'])` dan `requireOrganizationScope('hr', 'write')`.
- [x] Jalankan typecheck backend: `npm run build --prefix backend`.

### Phase 3: Frontend Modal & Komponen Pengelolaan
- [x] Buat komponen Modal `frontend/src/components/attendance/AdmsRegistrationModal.tsx` menggunakan `ModalShell`:
  - Dropdown pemilihan mesin (menampilkan kandidat).
  - Input Nomor Seri dan Input IP Allowlist (CIDR) dengan validasi real-time.
  - Checkbox aktivasi.
  - Error alert dan status loading submit.
- [x] Tambahkan tombol aksi **"+ Registrasi Mesin ADMS"** di header halaman `frontend/src/app/dashboard/attendance/adms/page.tsx` (dikontrol izin `attendance.manage`).
- [x] Tambahkan tombol aksi baris `RowActionButton` (Edit Allowlist & Toggle Aktif) pada tabel "Koneksi mesin ADMS" di halaman review.
- [x] Perbarui helper di `frontend/src/lib/attendance/admsMonitor.ts` untuk fungsi validasi IP/CIDR di client-side.

### Phase 4: Automated Verification Loop & E2E Test
- [x] Tulis/jalankan unit test frontend: `npx tsx frontend/src/lib/attendance/admsMonitor.test.mjs`.
- [x] Jalankan typecheck frontend: `npm run build --prefix frontend` atau `npx tsc --noEmit --project frontend/tsconfig.json`.
- [x] Lakukan pengetesan fungsional: Daftarkan/ubah allowlist mesin, verifikasi perubahannya tersimpan di tabel `adms.devices` dan status koneksi perangkat berubah menjadi `ADMS`.

---

## Verification Commands
```bash
# 1. Backend test
npx tsx --test backend/src/services/admsRegistration.test.ts

# 2. Backend build check
npm run build --prefix backend

# 3. Frontend test
npx tsx frontend/src/lib/attendance/admsMonitor.test.mjs

# 4. Frontend typecheck
npx tsc --noEmit --project frontend/tsconfig.json
```

