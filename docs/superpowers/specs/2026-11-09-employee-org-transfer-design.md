# Design Specification: Transfer Karyawan Antar Organisasi / Kelompok (CMC <-> MGM)

## 1. Summary & Problem Statement
Sistem GAJIANICH saat ini telah menerapkan multi-organization scope (`organization_groups`: `CMC` dan `MGM`). Setiap karyawan terikat ke departemen (`employees.department_id`), di mana departemen tersebut dipetakan ke kelompok organisasi via `department_organization_mappings`.
Saat ini belum ada alur dan fitur khusus bagi **Admin (SuperAdmin / Global Administrator)** yang memiliki hak akses RBAC untuk mentransfer karyawan lintas organisasi/kelompok (contoh kasus: karyawan seperti "Rifa Fitrina" dipindahkan dari kelompok `MGM` ke `CMC`).
Selain itu, histori transfer, alasan mutasi, tanggal efektif, dan audit log perpindahan organisasi belum tercatat secara formal dalam model transfer log.

Tujuan dari fitur ini adalah menyediakan mekanisme transfer karyawan antar kelompok organisasi yang aman, terisolasi dengan RBAC, tercatat dalam riwayat audit (audit trail) dan tabel histori transfer, serta menyinkronkan data relasi karyawan, departemen, dan hak akses user akun terkait.

---

## 2. Goals & Non-Goals

### Goals:
1. **RBAC Khusus Transfer**:
   - Menambahkan permission `employees.transfer` ("Transfer Employee Organization") pada modul `master` / `attendance`.
   - Mengonfigurasi hak akses default: hanya role dengan wewenang admin (khususnya `super_admin` dan `it_admin` atau global administrator) yang dapat mengeksekusi transfer antar kelompok organisasi. Role staff atau non-admin ditolak (403 Forbidden).
2. **Transfer Validation & Integrity**:
   - Validasi bahwa target departemen benar-benar berada di bawah kelompok organisasi tujuan (misal: target kelompok `CMC` harus memilih departemen yang dimapping ke `CMC`).
   - Opsional: jika lokasi juga perlu disesuaikan dengan lokasi organisasi tujuan, sediakan opsi pembaruan lokasi.
   - Jika karyawan memiliki user akun di sistem (`users.employee_id`), sinkronkan `user_organization_group_access` sehingga akun pengguna mendapatkan akses ke kelompok baru (dan menghapus/menyesuaikan kelompok lama bila akun tersebut adalah akun non-global single group).
3. **Audit Trail & Histori Transfer**:
   - Menyimpan riwayat transfer ke tabel baru `employee_organization_transfers` (employeeId, fromGroupId, toGroupId, fromDepartmentId, toDepartmentId, reason, effectiveDate, transferredBy, createdAt).
   - Menulis event ke sistem audit `hr_audit_events` dengan action `UPDATE` / summary transfer.
   - Cache invalidation untuk modul auth org-access, master data, dan employee cache.
4. **UI/UX Enterprise Rapi & Selaras**:
   - Menambahkan tombol transfer pada direktori/detail karyawan (ikon transfer/arrow-right-left) yang hanya muncul jika pengguna memiliki izin `employees.transfer` atau merupakan SuperAdmin.
   - Modal transfer karyawan interaktif: menampilkan info asal (Organisasi & Departemen saat ini), pilihan Organisasi Tujuan (dropdown kelompok aktif: CMC / MGM), pilihan Departemen Tujuan yang otomatis terfilter sesuai kelompok baru, pilihan Lokasi baru (opsional), Catatan/Alasan Transfer, dan Tanggal Efektif.
   - Tab / panel Riwayat Transfer di halaman detail karyawan.

### Non-Goals:
- Tidak mengubah log absensi masa lalu (absensi historis tetap berada di tanggal kejadian asli sebelum tanggal transfer).
- Tidak menghapus akun pengguna saat transfer; hanya memperbarui relasi karyawan dan grup organisasi.
- Tidak mengizinkan user non-admin / staff biasa melakukan mutasi organisasi.

---

## 3. Data Model & Schema Diffs

### Database Schema Baru: `employee_organization_transfers`
Tabel Drizzle ORM: `backend/src/db/schema/organizations.ts` (atau file terpisah `backend/src/db/schema/employeeTransfers.ts`):

```typescript
export const employeeOrganizationTransfers = pgTable('employee_organization_transfers', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  employeeId: bigint('employee_id', { mode: 'number' })
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  fromGroupId: bigint('from_group_id', { mode: 'number' })
    .notNull()
    .references(() => organizationGroups.id, { onDelete: 'restrict' }),
  toGroupId: bigint('to_group_id', { mode: 'number' })
    .notNull()
    .references(() => organizationGroups.id, { onDelete: 'restrict' }),
  fromDepartmentId: bigint('from_department_id', { mode: 'number' })
    .notNull()
    .references(() => departments.id, { onDelete: 'restrict' }),
  toDepartmentId: bigint('to_department_id', { mode: 'number' })
    .notNull()
    .references(() => departments.id, { onDelete: 'restrict' }),
  fromLocationId: bigint('from_location_id', { mode: 'number' })
    .references(() => locations.id, { onDelete: 'set null' }),
  toLocationId: bigint('to_location_id', { mode: 'number' })
    .references(() => locations.id, { onDelete: 'set null' }),
  effectiveDate: date('effective_date').notNull(),
  reason: text('reason').notNull(),
  transferredBy: bigint('transferred_by', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('employee_transfers_employee_idx').on(t.employeeId),
  index('employee_transfers_created_idx').on(t.createdAt.desc()),
]);
```

---

## 4. RBAC & Security Contract

### Permission Baru:
- **Code**: `employees.transfer`
- **Name**: `Transfer Employee Organization`
- **Module**: `master` (atau `attendance`)
- **Description**: `Mentransfer karyawan antar organisasi/kelompok kerja (CMC / MGM)`

### Default Role Matrix:
- `super_admin`: `['*']` (otomatis include)
- `it_admin`: ditambahkan `employees.transfer`
- `ga_staff`, `it_staff`, `employee`, `management`, `hr_attendance`: **TIDAK MEMILIKI** permission `employees.transfer`.

### Guard Middleware di Endpoint:
`requirePermission('employees.transfer')` + validasi `requireGlobalAdministrator` atau permission check admin pada route:
`POST /api/employees/:id/transfer`

---

## 5. API Specifications

### 1. `POST /api/employees/:id/transfer`
- **Headers**: `Authorization: Bearer <token>`
- **Permissions**: `employees.transfer` (Role SuperAdmin / Admin yang berwenang)
- **Request Body (JSON)**:
```json
{
  "targetGroupId": 2,
  "targetDepartmentId": 14,
  "targetLocationId": 5,
  "effectiveDate": "2026-11-09",
  "reason": "Rotasi kerja operasional dari MGM ke CMC atas instruksi manajemen"
}
```
- **Response Success (200 OK)**:
```json
{
  "success": true,
  "message": "Karyawan berhasil ditransfer ke organisasi CMC",
  "transfer": {
    "id": 1,
    "employeeId": 12,
    "fromGroupId": 1,
    "toGroupId": 2,
    "fromDepartmentId": 8,
    "toDepartmentId": 14,
    "effectiveDate": "2026-11-09",
    "reason": "Rotasi kerja operasional dari MGM ke CMC atas instruksi manajemen"
  },
  "employee": {
    "id": 12,
    "employeeCode": "EMP-0012",
    "fullName": "Rifa Fitrina",
    "departmentId": 14,
    "locationId": 5
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Validation gagal (misal: target department tidak berada di target organization group).
  - `403 Forbidden`: User bukan admin atau tidak memiliki izin `employees.transfer`.
  - `404 Not Found`: Karyawan atau departemen tujuan tidak ditemukan.

### 2. `GET /api/employees/:id/transfers`
- **Permissions**: `attendance.view` atau `master.view`
- **Response Success (200 OK)**:
  - Mengembalikan daftar riwayat transfer karyawan beserta nama grup asal & tujuan, nama departemen, tanggal, nama pemindah (transferredBy), dan alasan.

### 3. `GET /api/master/organizations/groups` (atau endpoint pendukung)
- Mengembalikan daftar `organization_groups` aktif beserta departemen terkait untuk pilihan dropdown form transfer.

---

## 6. Frontend & Mobile UX

1. **Aksi Tombol di Directory & Detail Page**:
   - Di tabel `EmployeeDirectoryPage`, untuk user dengan izin `employees.transfer`, tampilkan ikon transfer `ArrowRightLeft` pada kolom aksi.
   - Di halaman detail karyawan `[id]/page.tsx`, sediakan tombol khusus "Transfer Organisasi" dengan badge status grup saat ini (misal badge `MGM` atau `CMC`).
2. **Modal Transfer Karyawan (`EmployeeTransferModal`)**:
   - Header: Emerald Enterprise style dengan ikon `ArrowRightLeft`.
   - Menampilkan card profil ringkas karyawan: NIK, Nama (e.g. *Rifa Fitrina*), Departemen saat ini, dan Kelompok saat ini (e.g. *MGM*).
   - Dropdown **Kelompok Organisasi Baru** (Pilihan kelompok selain kelompok saat ini, misal *CMC*).
   - Dropdown **Departemen Baru** (Secara dinamis terfilter hanya departemen yang terikat ke kelompok tujuan).
   - Dropdown **Lokasi Baru** (Opsional atau terfilter sesuai lokasi yang tersedia).
   - Input **Tanggal Efektif** (Default: hari ini).
   - Textarea **Alasan Transfer** (Wajib diisi untuk kepatuhan audit HR).
   - Tombol "Batal" dan tombol "Konfirmasi Transfer Karyawan" (Emerald primary).
3. **Tab / Bagian Riwayat Transfer**:
   - Menampilkan timeline riwayat mutasi antar organisasi: kapan dipindahkan, dari organisasi mana ke mana, alasan, dan siapa admin pelaksananya.

---

## 7. Security & Integrity

- **Database Transaction (`db.transaction`)**: Pembaruan karyawan, pencatatan log transfer, penyesuaian akses user, dan audit HR dilakukan dalam satu boundary transaksi atomik.
- **Cache Invalidation**: Membersihkan redis cache `auth:org-access:*`, `ref:master:*`, dan `kpi:*` saat transfer berhasil dilakukan.
- **Audit Logging**: Mencatat aktor admin pelaksana, timestamp, perubahan state sebelum dan sesudah transfer.

