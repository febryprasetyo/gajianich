# Design Specification: HR Attendance Employee Master Import & Export Integration

- **Feature Name**: `hr-attendance-employee-import-export`
- **Date**: 2026-09-30
- **Status**: Draft / Ready for Implementation
- **Target Surfaces**:
  - `backend/src/middleware/auth.ts` (RBAC support for multiple/fallback permission codes)
  - `backend/src/routes/employeeRoutes.ts` (Grant HR attendance roles permission to access employee endpoints)
  - `frontend/src/components/attendance/AttendanceDirectoryPage.tsx` (Add Import & Export actions for `mode === 'employees'`)
  - `frontend/src/lib/attendance/repository.ts` & `AttendanceWorkspace.tsx` (Live sync of database employees & departments with attendance dataset)

---

## 1. Background & Problem Statement

Fitur Import & Export Karyawan (format Talenta 33 kolom) sebelumnya telah berhasil diimplementasikan di halaman `Master Data -> Employees` (`/dashboard/master/employees`). Namun, tim HR yang beroperasi sehari-hari di modul **HR Attendance** mengakses data karyawan melalui menu:
`HR -> Master Data -> Karyawan Absensi` (`/dashboard/attendance/master/employees`).

Saat ini:
1. Halaman `/dashboard/attendance/master/employees` belum memiliki tombol **Import Excel** dan **Export Excel**.
2. Endpoint backend `/api/v1/employees/import/*` dan `/api/v1/employees/export` secara ketat membatasi akses hanya untuk pengguna dengan permission `master.view` dan `master.manage`. Pengguna dengan peran HR (`HR Attendance & Time`) hanya memiliki hak akses `attendance.view`, `attendance.import`, dan `attendance.manage`, sehingga akan tertolak dengan `403 Forbidden` jika mengakses endpoint tersebut.
3. Halaman modul HR Attendance saat ini menyimpan state karyawan di `sessionStorage` (berbasis data demo awal), sehingga karyawan yang baru diimpor ke database PostgreSQL belum otomatis terefleksi ke dalam direktori Karyawan Absensi dan pemetaan mesin absensi.

---

## 2. Goals & Non-Goals

### Goals
1. **HR Attendance UI Actions**:
   - Menambahkan tombol **Export Excel** dan **Import Excel** di header halaman `HR -> Master Data -> Karyawan Absensi` (`/dashboard/attendance/master/employees`) yang konsisten dengan estetika desain tema HR.
   - Membuka modal `EmployeeImportModal` yang sama dengan validasi 2-langkah, dropzone file Talenta, Bento stats preview, dan tombol unduh template resmi Talenta.
2. **RBAC Endpoint Authorization**:
   - Memperluas middleware `requirePermission` di backend agar mendukung otorisasi multi-permission (`requirePermission(['master.view', 'attendance.view'])` atau `requireAnyPermission`).
   - Mengizinkan peran HR (`attendance.view`, `attendance.import`, `attendance.manage`) mengunduh template, preview import, commit import, dan export data master karyawan.
3. **Data Synchronization**:
   - Mengintegrasikan pemuatan data karyawan real dari `/api/v1/employees` dan departemen dari `/api/v1/master/departments` ke dalam repositori attendance (`createAttendanceRepository`), sehingga setelah import berhasil di-commit, daftar karyawan absensi langsung diperbarui tanpa me-reset data absensi yang sudah ada.

### Non-Goals
- Mengubah skema database PostgreSQL (tabel `employees` dan `departments` sudah lengkap dengan 33 kolom Talenta).
- Mengubah format kolom file Talenta Excel (tetap menggunakan parser & generator 33 kolom yang sudah teruji).
- Menggantikan alur impor mesin absensi (*punch log* / *attendance biometrics*), karena itu merupakan fitur terpisah di `/dashboard/attendance/imports`.

---

## 3. Architecture & Technical Design

### A. Backend Route Authorization (RBAC)
Update `backend/src/middleware/auth.ts`:
```typescript
export function requirePermission(permissionCode: string | string[])
```
Jika `permissionCode` berupa array, user dianggap berwenang jika memiliki **setidaknya salah satu** permission yang terdaftar (OR logic) atau memiliki role `SuperAdmin`.

Update `backend/src/routes/employeeRoutes.ts`:
```typescript
const viewEmployee = requirePermission(['master.view', 'attendance.view']);
const manageEmployee = requirePermission(['master.manage', 'attendance.manage', 'attendance.import']);

router.get('/import/template', viewEmployee, downloadEmployeeTemplate);
router.post('/import/preview', manageEmployee, upload.single('file'), previewEmployeeImport);
router.post('/import/commit', manageEmployee, upload.single('file'), commitEmployeeImport);
router.get('/export', viewEmployee, exportEmployeesToExcel);
router.get('/', viewEmployee, getEmployees);
```

### B. Frontend Attendance Repository Sync
Di `frontend/src/lib/attendance/repository.ts`:
- Saat `load()` dipanggil, fetch data master karyawan dari `/api/v1/employees` dan departemen dari `/api/v1/master/departments`.
- Jika API berhasil merespons, sinkronkan daftar `employees` dan `departments` ke dalam `AttendanceDataset`, sambil mempertahankan data absensi, batched logs, dan identities yang ada.
- Tambahkan command baru di `AttendanceCommand`:
  `{ type: 'sync_employees'; employees: Employee[]; departments?: MasterItem[] }`
  sehingga setelah import selesai dikonfirmasi di `EmployeeImportModal`, UI dapat langsung memicu sinkronisasi tanpa reload penuh.

### C. UI Implementation on AttendanceDirectoryPage
Di `frontend/src/components/attendance/AttendanceDirectoryPage.tsx`:
- Import `EmployeeImportModal` dan `api` helper.
- Ketika `mode === 'employees'`:
  - Tampilkan tombol **Export Excel** (ikon `Download`, memanggil endpoint `/api/v1/employees/export`).
  - Tampilkan tombol **Import Excel** (ikon `Upload`, membuka `EmployeeImportModal`).
  - Saat commit import sukses, panggil sinkronisasi data karyawan dan tampilkan notifikasi toast sukses.

---

## 4. Security & Error Handling
- Validasi JWT token tetap berlaku untuk semua request.
- Role `HR Attendance & Time` mendapatkan hak impor & ekspor karyawan tanpa perlu membuka akses ke seluruh IT Asset Master (Locations, Vendors, Equipment Types tetap terlindungi).
- Transaksi import tetap *all-or-nothing rollback* dengan strict duplicate check pada level database.
