# Task Plan: Pembaruan Pendaftaran Mesin ADMS Berbasis Domain Name (Tanpa IP Address)

- **Status**: Completed
- **Design Spec**: [2026-11-03-adms-domain-registration-design.md](../specs/2026-11-03-adms-domain-registration-design.md)
- **Tujuan**: Memperbarui flow pendaftaran mesin ADMS agar berbasis nama domain tanpa mewajibkan IP address atau CIDR allowlist.

---

## Shared Interfaces

```typescript
// Shared Types untuk Registrasi ADMS Domain-Based
export type RegisterAdmsInput =
  | {
      mode: 'existing';
      deviceId: number;
      serial: string;
      sourceCidr?: string;
      enabled: boolean;
    }
  | {
      mode: 'new';
      name: string;
      ip?: string;
      port?: number;
      groupId?: number;
      serial: string;
      sourceCidr?: string;
      enabled: boolean;
    };
```

---

## Phase-by-Phase Task Checklist

### Phase 1: Backend Service & Validation (TDD)
- [x] Perbarui `backend/src/services/admsRegistration.test.ts`:
  - Tambahkan test case pendaftaran mesin baru mode `new` tanpa field `ip` atau `sourceCidr`.
  - Tambahkan test case pendaftaran mesin mode `existing` tanpa `sourceCidr` (harus default ke `0.0.0.0/0`).
  - Verifikasi query insert dan upsert menggunakan fallback IP domain `adms-${serial}` dan CIDR `0.0.0.0/0`.
- [x] Perbarui `backend/src/services/admsRegistration.ts`:
  - Modifikasi `parseSourceCidr`: Dukung `0.0.0.0/0` atau sediakan fallback default `0.0.0.0/0`.
  - Modifikasi `parseRegisterInput`:
    - Pada `mode === 'new'`, jadikan `ip` opsional. Jika tidak ada, default ke `adms-${serial}`.
    - Jadikan `sourceCidr` opsional, default ke `0.0.0.0/0`.
    - Pada `mode === 'existing'`, jadikan `sourceCidr` opsional, default ke `0.0.0.0/0`.
  - Pada query `INSERT INTO public.attendance_devices`, pastikan nilai `ip` yang diinsert unik (misal `adms-${input.serial}` atau IP domain).
  - Pada query upsert `adms.devices`, simpan `0.0.0.0/0` sebagai `allowed_network`.
- [x] Jalankan verifikasi tes unit backend: `npx tsx --test backend/src/services/admsRegistration.test.ts`.

### Phase 2: Frontend Validasi & Test (TDD)
- [x] Perbarui `frontend/src/lib/attendance/admsMonitor.ts`:
  - Perbarui fungsi `validateNewAdmsDevice(groupId, name, serial)`: hapus parameter/kewajiban `ip` dan `sourceCidr` untuk mesin ADMS.
  - Perbarui `validateAdmsRegistration(groupId, deviceId, serial, sourceCidr?)`: jadikan `sourceCidr` opsional.
- [x] Perbarui `frontend/src/lib/attendance/admsMonitor.test.mjs`:
  - Sesuaikan pengujian `validateNewAdmsDevice` dan `validateAdmsRegistration` dengan aturan baru tanpa IP/CIDR.
- [x] Jalankan verifikasi test unit frontend: `npx tsx frontend/src/lib/attendance/admsMonitor.test.mjs`.

### Phase 3: Frontend UI Components
- [x] Perbarui `frontend/src/components/attendance/AdmsRegistrationModal.tsx`:
  - Hapus field input IP, Port, dan Allowlist CIDR pada Tab "Daftarkan Mesin Baru".
  - Hapus field input Allowlist IP/CIDR pada Tab "Daftarkan Mesin yang Ada".
  - Berikan alert informasi ramah pengguna: *"Mesin absensi akan terhubung otomatis ke server ADMS menggunakan nama domain yang sudah disetel pada perangkat."*
  - Sesuaikan payload submit ke `/attendance/devices/adms/register`.
- [x] Perbarui `frontend/src/components/attendance/AttendanceDevicesPage.tsx`:
  - Pada form tambah mesin tab **Mesin Cloud ADMS**, hapus field input Alamat IP dan input Allowlist CIDR.
  - Perbarui payload pemanggilan API pendaftaran ADMS mode `new`.
  - Sesuaikan kolom tabel ADMS agar menampilkan indikator Domain Push yang jelas tanpa label IP kosong.

### Phase 4: Full Verification Loop
- [x] Jalankan typecheck backend: `npm run build --prefix backend`.
- [x] Jalankan automated test suite backend & frontend:
  - `npx tsx --test backend/src/services/admsRegistration.test.ts`
  - `npx tsx frontend/src/lib/attendance/admsMonitor.test.mjs`
  - `npm test --prefix adms-server`
  - `npm test --prefix frontend` (239 tests pass)
- [x] Pastikan seluruh test dan typecheck lulus tanpa error.

---

## Verification Commands
```bash
# 1. Backend admsRegistration unit test
npx tsx --test backend/src/services/admsRegistration.test.ts

# 2. Frontend admsMonitor unit test
npx tsx frontend/src/lib/attendance/admsMonitor.test.mjs

# 3. ADMS Server unit test
npm test --prefix adms-server

# 4. Typecheck frontend & backend
npx tsc --noEmit --project backend/tsconfig.json
npx tsc --noEmit --project frontend/tsconfig.json
```

