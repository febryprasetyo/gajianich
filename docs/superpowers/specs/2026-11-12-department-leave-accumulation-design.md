# Design Spec: Fitur Khusus Akumulasi Cuti Karyawan Berdasarkan Departemen (Unlimited Roll-Over)

## 1. Summary & Problem Statement
Sistem pengelolaan cuti GAJIANICH saat ini memiliki mekanisme hak cuti dasar (default 12 hari) dan potongan cuti bersama pemerintah per tahun kalender. Pada sistem eksisting, carry-forward bersifat global dan dibatasi oleh `maxCarryForwardDays`.

Manajemen membutuhkan fleksibilitas kebijakan ketenagakerjaan:
1. **Fasilitas Akumulasi Khusus Departemen**: Tidak semua karyawan berhak mendapatkan akumulasi sisa cuti. Hanya karyawan yang berada di bawah **departemen tertentu yang di-assign oleh HR** yang cutinya diakumulasikan.
2. **Karakteristik Akumulasi**:
   - **Unlimited (Tanpa Batas Maksimal)**: Seluruh sisa cuti yang belum terpakai diakumulasikan penuh ke tahun berikutnya.
   - **Kumulatif Multi-Tahun**: Sisa cuti sejak karyawan pertama kali masuk kerja terakumulasi berkesinambungan tanpa tanggal kedaluwarsa.
3. **Default Reset Tahunan**: Untuk departemen yang tidak di-assign, sisa cuti tahun lalu otomatis hangus / di-reset menjadi 0 saat pergantian tahun kalender.

---

## 2. Goals & Non-Goals

### Goals
1. Menyediakan pengaturan penugasan departemen yang berhak mendapatkan akumulasi cuti pada Master Pengaturan Cuti (`/dashboard/leaves/settings`).
2. Menerapkan kalkulasi rollover otomatis tanpa batas (unlimited) untuk karyawan di departemen terdaftar saat sinkronisasi tahunan dijalankan.
3. Memastikan karyawan di departemen non-akumulasi secara default di-reset sisa cutinya (`carriedOverQuota = 0`).
4. Mempertahankan proteksi override manual (`isCustomCarryForward`) agar perlakuan khusus personal tidak tertimpa.
5. Menyediakan transparansi visual di tabel rekap saldo cuti (badge status akumulasi per karyawan).

### Non-Goals
1. Tidak mengubah skema approval permohonan cuti (alur F4 tetap 4 tahap).
2. Tidak mengubah logika kuota dasar cuti bersama pemerintah.

---

## 3. Data Model & Schema Diffs

### Database Table: `leave_accumulated_departments`
```typescript
// backend/src/db/schema/leaves.ts
export const leaveAccumulatedDepartments = pgTable('leave_accumulated_departments', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  year: integer('year').notNull(),
  departmentId: bigint('department_id', { mode: 'number' })
    .notNull()
    .references(() => departments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('leave_accumulated_depts_year_dept_unique').on(table.year, table.departmentId),
]);
```

---

## 4. API Specifications

### `GET /api/leaves/master/config?year=YYYY`
Response menyertakan:
```json
{
  "year": 2026,
  "baseQuota": 12,
  "collectiveLeaveDays": 4,
  "accumulatedDepartmentIds": [1, 3]
}
```

### `POST /api/leaves/master/config`
Request payload:
```json
{
  "year": 2026,
  "baseQuota": 12,
  "collectiveLeaveDays": 4,
  "notes": "Kebijakan Cuti 2026",
  "accumulatedDepartmentIds": [1, 3]
}
```

### `GET /api/leaves/master/balances?year=YYYY`
Setiap item menyertakan properti:
```json
{
  "employeeId": 10,
  "fullName": "Budi Santoso",
  "departmentId": 1,
  "isAccumulationActive": true,
  "carriedOverQuota": 8
}
```

---

## 5. Security & Integrity
- Akses mutasi konfigurasi dibatasi permission `attendance.manage` dan role HR/Admin.
- Transaksi database atomic (`db.transaction`) saat menyimpan konfigurasi dan memperbarui seluruh saldo karyawan.
