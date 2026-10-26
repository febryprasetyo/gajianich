# Design Spec: Master Cuti, Pengaturan Cuti Bersama Tahunan & Rekap Saldo Cuti Karyawan

## 1. Ringkasan & Latar Belakang Masalah
Perusahaan memerlukan pengelolaan cuti yang tersentralisasi dan otomatis dengan antarmuka berbahasa Indonesia yang seragam dengan modul-modul lain di sistem AMS. Setiap awal tahun kalender, HR menetapkan konfigurasi hak cuti dasar tahunan (default 12 hari) dan jumlah Cuti Bersama tahunan (misal 4 atau 5 hari). Jumlah cuti bersama ini secara regulasi memotong jatah hak cuti tahunan karyawan.

Selain itu, perusahaan membutuhkan fitur pembawaan sisa cuti tahun lalu (carry-forward) yang dapat diaktifkan atau dinonaktifkan secara global, dengan proteksi koreksi manual (manual override) agar perlakuan khusus pada karyawan tertentu tidak tertimpa saat sinkronisasi massal dijalankan ulang.

### Goals
1. **Pengaturan Cuti Bersama Tahunan**: HR dapat mengonfigurasi total cuti bersama, kuota dasar default, status carry-forward dan batas maksimalnya, serta catatan kebijakan/SKB 3 Menteri per tahun kalender.
2. **Sinkronisasi Otomatis & Proteksi Saldo Karyawan**: Bulk-sync transaksional ke seluruh karyawan aktif dengan proteksi isolasi variabel:
   - Karyawan baru diinisialisasi dengan nilai default.
   - Perubahan cuti bersama memperbarui potongan cuti bersama tanpa merusak custom quota atau custom carry-forward karyawan.
   - Carry-forward dihitung otomatis dari sisa cuti tahun $(N-1)$ jika diaktifkan.
3. **Rekap Saldo Cuti Karyawan**: Tabel komprehensif seluruh karyawan aktif beserta rincian: Hak Dasar, Cuti Bersama, Hak Bersih, Carry Over, Cuti Diambil, dan Sisa Cuti dengan indikator warna visual.
4. **Modal Koreksi Saldo Individual**: HR dapat mengubah kuota dasar maupun carry-over khusus karyawan dengan pratinjau instan.
5. **Standar Antarmuka SmartHR Berbahasa Indonesia**: Struktur navigasi dan tata letak mengadopsi standar SmartHR, dengan seluruh penamaan menu dan label menggunakan Bahasa Indonesia yang konsisten dan rapi.

### Non-Goals
1. Tidak mengubah alur persetujuan (approval workflow) multi-level berjenjang di luar peran HR/Admin yang sudah ada.
2. Tidak memodifikasi struktur cetak formulir F4 eksisting selain mengonsumsi sisa kuota yang telah terkalkulasi secara akurat.

---

## 2. Struktur Navigasi & Bahasa (Bahasa Indonesia)

Pada sidebar navigasi (kelompok **HR**), modul cuti distrukturkan:
- **Attendance**:
  - Ringkasan HR (`/dashboard/attendance/overview`)
  - Data Absensi (`/dashboard/attendance`)
  - **Pengajuan Cuti** (`/dashboard/leaves`):
    - Tampilan rekap permohonan cuti (stat card ringkasan, filter pencarian, tabel permohonan, aksi cetak formulir standar F4, dan tombol pengajuan cuti baru).
  - **Pengaturan Cuti** (`/dashboard/leaves/settings`):
    - Halaman master konfigurasi Cuti Bersama Tahunan dan tabel rekap saldo cuti seluruh karyawan aktif (hak akses: `attendance.manage`).
  - Impor Absensi, Kartu Absensi, Laporan Absensi, Aktivitas Absensi.

---

## 3. Data Model & Skema Database

### A. Tabel Baru: `annual_leave_configs`
Menyimpan konfigurasi master cuti per tahun kalender.

```typescript
// backend/src/db/schema/leaves.ts
export const annualLeaveConfigs = pgTable("annual_leave_configs", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  year: integer("year").notNull().unique(), // Satu konfigurasi per tahun kalender
  baseQuota: integer("base_quota").default(12).notNull(), // Kuota hak cuti dasar default
  collectiveLeaveDays: integer("collective_leave_days").default(0).notNull(), // Total cuti bersama tahunan
  allowCarryForward: boolean("allow_carry_forward").default(false).notNull(), // Izinkan pengalihan sisa cuti tahun lalu
  maxCarryForwardDays: integer("max_carry_forward_days").default(0).notNull(), // Maksimal hari yang dialihkan
  notes: text("notes"), // Catatan kebijakan / SKB 3 Menteri
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### B. Perluasan Tabel: `leave_balances`
Menambahkan flag penanda custom override untuk melindungi integritas saldo karyawan:

```typescript
// backend/src/db/schema/leaves.ts
export const leaveBalances = pgTable("leave_balances", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  employeeId: bigint("employee_id", { mode: "number" }).notNull().references(() => employees.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  baseQuota: integer("base_quota").default(12).notNull(),
  collectiveLeaveDeduction: integer("collective_leave_deduction").default(0).notNull(),
  usedQuota: integer("used_quota").default(0).notNull(),
  carriedOverQuota: integer("carried_over_quota").default(0).notNull(),
  isCustomQuota: boolean("is_custom_quota").default(false).notNull(), // Menandai jika baseQuota di-override manual oleh HR
  isCustomCarryForward: boolean("is_custom_carry_forward").default(false).notNull(), // Menandai jika carry-over di-override manual oleh HR
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

*Integritas Data:*
- Unique constraint pada pasangan `(employee_id, year)`.

---

## 4. Rumus Domain & Aturan Bisnis Kalkulasi

Implementasi pada `backend/src/domain/leaveCalculation.ts`:

1. **Hak Bersih (Net Entitlement)**:
   $$\text{cleanAnnualQuota} = \max(0, \text{baseQuota} - \text{collectiveLeaveDeduction})$$
2. **Total Hak Cuti Aktif (Total Entitlement Before Usage)**:
   $$\text{availableBefore} = \max(0, \text{cleanAnnualQuota} + \text{carriedOverQuota} - \text{usedQuota})$$
3. **Sisa Cuti Bersih (Remaining Balance)**:
   $$\text{remainingAfter} = \max(0, \text{availableBefore} - \text{requestedDays})$$
4. **Auto-Rollover Carry Forward dari Tahun $(N-1)$**:
   $$\text{prevRemaining} = \max(0, \text{prev.baseQuota} + \text{prev.carriedOverQuota} - \text{prev.collectiveLeaveDeduction} - \text{prev.usedQuota})$$
   $$\text{autoCarry} = \min(\text{prevRemaining}, \text{config.maxCarryForwardDays})$$

---

## 5. Spesifikasi API Backend

### 1. `GET /api/v1/leaves/master/config?year=YYYY`
Mengambil konfigurasi master tahun berjalan atau yang dipilih.
- **Permission**: `attendance.view` atau `attendance.manage`
- **Response 200**:
  ```json
  {
    "id": 1,
    "year": 2026,
    "baseQuota": 12,
    "collectiveLeaveDays": 4,
    "allowCarryForward": true,
    "maxCarryForwardDays": 6,
    "notes": "SKB 3 Menteri Cuti Bersama 2026"
  }
  ```

### 2. `POST /api/v1/leaves/master/config`
Menyimpan konfigurasi dan memicu bulk-sync transaksional.
- **Permission**: `attendance.manage`
- **Request Body (Zod Validation)**:
  ```json
  {
    "year": 2026,
    "baseQuota": 12,
    "collectiveLeaveDays": 4,
    "allowCarryForward": true,
    "maxCarryForwardDays": 6,
    "notes": "SKB 3 Menteri Cuti Bersama 2026"
  }
  ```
- **Alur Bisnis Database (`db.transaction`)**:
  1. Upsert record pada `annual_leave_configs`.
  2. Ambil seluruh karyawan aktif (`employees.status = "Active"`).
  3. Ambil data saldo tahun berjalan dan tahun sebelumnya $(N-1)$ untuk seluruh karyawan aktif.
  4. Untuk setiap karyawan:
     - Jika belum ada record saldo tahun $N$: buat baru dengan `baseQuota = config.baseQuota`, `collectiveLeaveDeduction = config.collectiveLeaveDays`, `carriedOverQuota = autoCarry`, `usedQuota = 0`.
     - Jika sudah ada record saldo tahun $N$:
       - Perbarui `collectiveLeaveDeduction = config.collectiveLeaveDays`.
       - Jika `!isCustomQuota` dan `baseQuota` master diubah: perbarui `baseQuota = config.baseQuota`.
       - Jika `!isCustomCarryForward`:
         - Jika `config.allowCarryForward`: perbarui `carriedOverQuota = autoCarry`.
         - Jika `!config.allowCarryForward`: perbarui `carriedOverQuota = 0`.
       - Jika `isCustomQuota` atau `isCustomCarryForward`: pertahankan nilai custom.
  5. Return 200 dengan status dan count karyawan yang disinkronisasi.

### 3. `GET /api/v1/leaves/master/balances?year=YYYY&departmentId=...&search=...`
Mengambil data rekap saldo seluruh karyawan untuk tabel.
- **Permission**: `attendance.view` atau `attendance.manage`
- **Response 200**:
  ```json
  {
    "year": 2026,
    "totalEmployees": 150,
    "totalAllocatedQuota": 1800,
    "averageRemainingDays": 6.8,
    "totalUsedDays": 420,
    "balances": [
      {
        "balanceId": 101,
        "employeeId": 12,
        "employeeCode": "CMC-012",
        "fullName": "Budi Santoso",
        "department": "IT Support",
        "position": "Staff IT",
        "year": 2026,
        "baseQuota": 12,
        "collectiveLeaveDeduction": 4,
        "cleanAnnualQuota": 8,
        "carriedOverQuota": 2,
        "totalEntitlement": 10,
        "usedQuota": 3,
        "remainingQuota": 7,
        "isCustomQuota": false,
        "isCustomCarryForward": false
      }
    ]
  }
  ```

### 4. `PUT /api/v1/leaves/master/balances/:id`
Koreksi manual saldo individual.
- **Permission**: `attendance.manage`
- **Request Body**:
  ```json
  {
    "baseQuota": 14,
    "carriedOverQuota": 3
  }
  ```
- Menetapkan `isCustomQuota = true` jika `baseQuota` diisi dan `isCustomCarryForward = true` jika `carriedOverQuota` diisi.

---

## 6. Antarmuka Pengguna & Komponen UI (Bahasa Indonesia & Standar SmartHR)

### Halaman Pengaturan Cuti (`/dashboard/leaves/settings`)
1. **Header & Breadcrumbs**:
   - Judul: **Pengaturan Cuti**
   - Breadcrumb: `Absensi > Pengajuan Cuti > Pengaturan Cuti`
2. **Form Master Cuti Tahunan**:
   - Pemilih Tahun (Dropdown atau input angka).
   - Hak Cuti Dasar Default (Hari).
   - Total Cuti Bersama Tahunan (Hari) dengan info: *"Otomatis memotong hak cuti bersih seluruh karyawan aktif"*.
   - Toggle Izinkan Bawa Sisa Cuti (Carry Forward) dan Input Batas Maksimal Hari.
   - Catatan Kebijakan HR (Textarea).
   - Tombol **[Simpan & Terapkan Saldo]** dengan konfirmasi dialog.
3. **Statistik Saldo Cuti (Widget Card)**:
   - Total Karyawan Aktif
   - Rata-rata Sisa Cuti
   - Total Cuti Terpakai
   - Total Hak Kuota Diterbitkan
4. **Tabel Rekap Saldo Cuti Karyawan**:
   - Toolbar: Pencarian (Nama/NIP), Filter Departemen, Filter Status Saldo (Semua, Aman $\ge 4$, Menipis $1-3$, Habis $0$).
   - Kolom:
     - Karyawan (Nama, NIP, Departemen/Jabatan)
     - Hak Dasar (Hari)
     - Cuti Bersama (-Hari)
     - Hak Bersih (Hari)
     - Carry Over (+Hari)
     - Terpakai (-Hari)
     - Sisa Cuti (Badge: Hijau jika $\ge 4$, Kuning jika $1-3$, Merah jika $0$)
     - Aksi: Tombol Edit Saldo Karyawan.
5. **Modal Edit Saldo Individual**:
   - Modal dialog dengan form input kuota dasar dan carry over, menampilkan kalkulasi pratinjau instan sisa cuti sebelum disimpan.

---

## 7. Keamanan & Hak Akses
- Endpoint mutasi master (`POST /api/v1/leaves/master/config` dan `PUT /api/v1/leaves/master/balances/:id`) dilindungi middleware `requirePermission(["attendance.manage"])`.
- Halaman `/dashboard/leaves/settings` dilindungi `PermissionGuard` dengan hak `attendance.manage`.
- Semua transaksi database dijalankan terisolasi dalam `db.transaction()`.

---

## 8. Rencana Pengujian & Verifikasi
1. **Unit Test Backend**:
   - Test kalkulasi `calculateLeaveBalances` dan `calculateRolloverCarryForward`.
   - Test bulk-sync: inisialisasi karyawan baru, pembaruan cuti bersama, proteksi custom quota & custom carry forward.
   - Test manual override via `PUT /api/v1/leaves/master/balances/:id`.
2. **Frontend Typecheck & Build**:
   - `npx tsc --noEmit` pada frontend dan backend.
   - Verifikasi navigasi dan aksesibilitas tab, form, serta modal.
