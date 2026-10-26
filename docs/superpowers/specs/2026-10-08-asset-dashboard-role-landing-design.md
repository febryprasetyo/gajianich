# Asset Management Dashboard & Role-Based Super App Landing — Design Specification

**Tanggal:** 2026-10-08  
**Status:** DRAFT (Awaiting User Review & Approval)  
**Dokumen:** `docs/superpowers/specs/2026-10-08-asset-dashboard-role-landing-design.md`  
**Target URL Admin & IT:** `/dashboard/assets/overview`  
**Target URL HR:** `/dashboard/attendance/overview`  
**Target URL Employee:** `/dashboard/employee/overview`  
**Target URL Management:** `/dashboard/management/overview`  
**Referensi Inspirasi:** `docs/dashboard-asset-management.md` (SmartHR Asset Dashboard Pattern)

---

## 1. Summary & Problem Statement

Saat ini di AMS App:
1. Setelah login atau ketika mengakses root URL (`/` atau `/dashboard`), pengguna role Admin dan IT secara default di-redirect ke `/dashboard/master/departments` yang merupakan tabel data master mentah, bukan halaman beranda analitik.
2. Modul aset hanya memiliki halaman inventaris berbasis tabel (`/dashboard/assets`), belum memiliki halaman ringkasan analitik (KPI, tren pengadaan, distribusi departemen, distribusi kategori aset) seperti yang sudah dimiliki oleh modul HR (`/dashboard/attendance/overview`).
3. Belum ada pengalaman "Super App" yang mulus: sidebar belum memiliki menu tunggal "Dashboard" yang cerdas dan beradaptasi secara dinamis dengan role yang sedang aktif.
4. Role non-IT/HR seperti `Employee` dan `Management` belum memiliki rute overview dedicated, sehingga ketika fitur peran tersebut dikembangkan di kemudian hari, struktur URL harus diubah kembali jika tidak dipersiapkan dari awal.

### Solusi yang Diusulkan:
1. **Dynamic "Super App" Direct Routing**:
   - Setelah login atau membuka `/` / `/dashboard`, sistem secara otomatis mengarahkan user ke dashboard overview spesifik per-role.
   - **Admin & IT (`super_admin`, `it_admin`, `it_staff`)** $\rightarrow$ `/dashboard/assets/overview`.
   - **HR (`hr_attendance`)** $\rightarrow$ `/dashboard/attendance/overview`.
   - **Employee (`employee`)** $\rightarrow$ `/dashboard/employee/overview`.
   - **Management (`management`)** $\rightarrow$ `/dashboard/management/overview`.
   - **Role Kustom / Fallback** $\rightarrow$ `/dashboard/welcome`.
2. **Contextual "Dashboard" Menu di Sidebar**:
   - Di bagian paling atas sidebar ditambahkan item menu utama tunggal berlabel **"Dashboard"** (icon `LayoutDashboard`).
   - Link menu ini otomatis mengarah ke rute overview milik role yang sedang login. Dengan demikian, setiap role merasa aplikasi dibuat eksklusif untuk peran mereka (*tailored workspace*).
3. **Dedicated Asset Management Dashboard (`/dashboard/assets/overview`)**:
   - Mengacu pada dokumen acuan [docs/dashboard-asset-management.md](file:///home/fastpec/code/ams-app/docs/dashboard-asset-management.md) dengan penyesuaian data operasional riil:
     - **4 Top KPI Cards**: Total Aset, Aset Terpakai (Assigned), Aset Tersedia (Available), Aset Perbaikan/Rusak (Under Maintenance & Damaged).
     - **Tren Pengadaan Aset (Acquisition/Purchase Trend)**: Grafik bar/line bulanan berdasarkan riwayat pengadaan.
     - **Distribusi Aset per Departemen (Assets by Department)**: Bar distribusi persentase & jumlah kepemilikan aset di tiap departemen (IT, HR, Finance, Ops, dll).
     - **Distribusi Aset per Kategori (Assets by Category)**: Proporsi kategori perangkat (Laptop, Desktop, Monitor, Peripherals, dll).
     - **Tabel Ringkasan Aset Terkini (Recent Active Assets)**: 10 aset aktif terbaru dengan kode aset, merek/tipe, pemegang (custodian/employee), garansi, status, dan tombol aksi detail.
4. **Reusable Welcome Workspace untuk Role Lain**:
   - Komponen modular `RoleWelcomeWorkspace.tsx` yang menampilkan sapaan personal hangat (*welcome greeting*), badge role, status akun, dan placeholder modul siap pakai untuk `/dashboard/employee/overview` dan `/dashboard/management/overview`.
5. **Skema Database & Backend API**:
   - Menambahkan kolom operasional `purchase_date` dan `warranty_expiry` (tanpa kolom harga beli/depresiasi finansial sesuai arahan pengguna).
   - API `GET /api/assets/dashboard-summary` untuk menyajikan data agregasi analitik dengan query SQL yang cepat dan teroptimasi.

---

## 2. Goals & Non-Goals

### Goals
- [x] Menyediakan rute baru `/dashboard/assets/overview` sebagai dashboard utama Admin & IT.
- [x] Memperbarui `frontend/src/app/page.tsx`, `frontend/src/app/dashboard/page.tsx`, dan `frontend/src/lib/access/routes.ts` agar auto-redirect bekerja akurat untuk setiap role.
- [x] Menambahkan item menu dinamis "Dashboard" pada sidebar `DashboardLayout.tsx` yang link tujuannya menyesuaikan role aktif.
- [x] Menyiapkan dedicated landing page untuk role lain: `/dashboard/employee/overview` dan `/dashboard/management/overview` dengan komponen sambutan seragam yang elegan dan modular.
- [x] Membuat endpoint backend `GET /api/assets/dashboard-summary` dengan penghitungan KPI riil, tren waktu, distribusi departemen, distribusi kategori, dan daftar aset aktif terkini.
- [x] Menambahkan kolom `purchase_date` dan `warranty_expiry` pada skema tabel `assets` secara aman dan backward-compatible.

### Non-Goals
- **Tidak mencatat harga pembelian (purchase price) atau kalkulasi nilai depresiasi finansial**: Ditiadakan karena data harga tidak di-share oleh purchasing dan inventaris eksisting tidak memiliki data harga.
- **Tidak menggantikan halaman `/dashboard/assets`**: Halaman tabel inventaris tetap utuh untuk kebutuhan CRUD, filter multi-kolom, impor Excel, dan pagination.
- **Tidak mengubah izin akses fungsional modul lain**: Pengaturan RBAC untuk modul attendance, tickets, licenses, dll tetap mengikuti izin yang sudah berlaku.

---

## 3. Data Model & Schema Diffs

### Perubahan Skema Drizzle (`backend/src/db/schema/assets.ts`)
Tambahan 2 kolom operasional baru pada tabel `assets`:
```typescript
export const assets = pgTable('assets', {
  // ... kolom eksisting (id, assetCode, name, categoryId, locationId, currentCustodianId, assignedToEmployeeId, serialNumber, status, condition, notes, createdAt, updatedAt) ...
  purchaseDate: timestamp('purchase_date'),
  warrantyExpiry: timestamp('warranty_expiry'),
});
```

### Strategi Migrasi Database
- File migrasi SQL / script Drizzle untuk menambahkan kolom `purchase_date` (timestamp NULL) dan `warranty_expiry` (timestamp NULL) pada tabel `assets`.
- Menambahkan fallback logic pada backend: jika `purchase_date` bernilai null, backend menggunakan `created_at` sebagai tanggal registrasi/akuisisi aset sehingga grafik tren waktu tetap terisi dari data riil.

---

## 4. API Specifications

### Endpoint: `GET /api/assets/dashboard-summary`
- **Method**: `GET`
- **Auth**: Bearer JWT Token
- **Permission**: `assets.view`
- **Response Format (200 OK)**:
```json
{
  "success": true,
  "data": {
    "kpis": {
      "totalAssets": 128,
      "assignedAssets": 94,
      "availableAssets": 28,
      "maintenanceAssets": 4,
      "damagedAssets": 2,
      "assignedPercentage": 73.4
    },
    "purchaseTrend": [
      { "month": "2026-05", "label": "Mei 2026", "count": 12 },
      { "month": "2026-06", "label": "Jun 2026", "count": 18 },
      { "month": "2026-07", "label": "Jul 2026", "count": 8 },
      { "month": "2026-08", "label": "Agu 2026", "count": 24 },
      { "month": "2026-09", "label": "Sep 2026", "count": 31 },
      { "month": "2026-10", "label": "Okt 2026", "count": 15 }
    ],
    "byDepartment": [
      { "departmentId": 1, "departmentName": "Information Technology", "count": 42, "percentage": 32.8 },
      { "departmentId": 2, "departmentName": "Finance & Accounting", "count": 28, "percentage": 21.9 },
      { "departmentId": 3, "departmentName": "Human Resources", "count": 20, "percentage": 15.6 },
      { "departmentId": 4, "departmentName": "Operations & Logistics", "count": 18, "percentage": 14.1 },
      { "departmentId": null, "departmentName": "Belum Ditetapkan / Pool", "count": 20, "percentage": 15.6 }
    ],
    "byCategory": [
      { "categoryId": 1, "categoryName": "Laptop", "count": 55, "percentage": 43.0 },
      { "categoryId": 2, "categoryName": "Desktop PC", "count": 30, "percentage": 23.4 },
      { "categoryId": 3, "categoryName": "Monitor", "count": 25, "percentage": 19.5 },
      { "categoryId": 4, "categoryName": "Aksesoris & Lainnya", "count": 18, "percentage": 14.1 }
    ],
    "recentAssets": [
      {
        "id": 101,
        "assetCode": "AST-2026-001",
        "name": "MacBook Pro 14 M3",
        "categoryName": "Laptop",
        "assignedTo": "Sarah Jenkins",
        "departmentName": "Information Technology",
        "status": "Assigned",
        "condition": "Good",
        "purchaseDate": "2026-08-15T00:00:00.000Z",
        "warrantyExpiry": "2028-08-15T00:00:00.000Z"
      }
    ]
  }
}
```

---

## 5. Frontend & Super App UX

### 1. Struktur Rute Navigasi Baru
```text
frontend/src/app/
├── page.tsx                             (Root Redirect -> Role Dashboard)
├── dashboard/
│   ├── page.tsx                         (Dashboard Index Redirect -> Role Dashboard)
│   ├── assets/
│   │   ├── page.tsx                     (Tabel Inventaris Eksisting)
│   │   └── overview/
│   │       └── page.tsx                 (NEW: Asset Management Dashboard)
│   ├── attendance/
│   │   └── overview/
│   │       └── page.tsx                 (HR Attendance Overview Eksisting)
│   ├── employee/
│   │   └── overview/
│   │       └── page.tsx                 (NEW: Dedicated Employee Landing Workspace)
│   ├── management/
│   │   └── overview/
│   │       └── page.tsx                 (NEW: Dedicated Management Landing Overview)
│   └── welcome/
│       └── page.tsx                     (NEW: Universal Fallback Welcome Page)
```

### 2. Contextual Sidebar Navigation (`DashboardLayout.tsx`)
- Grup menu teratas menampilkan:
  - **Dashboard**: Mengarah ke `getDashboardHrefForUser(user)` dengan icon `LayoutDashboard`.
  - Item ini aktif jika user berada di overview miliknya.
- Menu **Asset Lifecycle** di sidebar:
  - `Ringkasan Aset` $\rightarrow$ `/dashboard/assets/overview` (Icon: `LayoutDashboard` / `BarChart3`).
  - `Inventaris Aset` $\rightarrow$ `/dashboard/assets` (Icon: `HardDrive`).
  - `Hardware Audits` $\rightarrow$ `/dashboard/hardware-audits`.
  - `Software Licenses` $\rightarrow$ `/dashboard/licenses`.

### 3. Komponen Asset Dashboard (`/dashboard/assets/overview`)
- **Header / Hero Section**:
  - Sapaan kontekstual waktu (*"Selamat Pagi/Siang/Sore, [Nama Admin]"*).
  - Badge role aktif (*"IT Administrator Workspace"*).
  - Tombol aksi cepat: `+ Tambah Aset` (buka modal form aset) dan `Buka Inventaris Penuh` (tautan ke `/dashboard/assets`).
- **Baris KPI Cards (4 Cards)**:
  - **Total Aset**: Jumlah total unit terdata di sistem.
  - **Aset Terpakai (Assigned)**: Jumlah aset yang sedang dipegang pegawai/custodian + persentase utilisasi.
  - **Aset Tersedia (Available)**: Jumlah aset ready stock di gudang/pool.
  - **Perlu Perhatian (Maintenance / Damaged)**: Jumlah aset dalam status perbaikan atau rusak.
- **Baris Analitik Tengah (2 Kolom)**:
  - **Kolom Kiri - Tren Pengadaan Aset (Acquisition Trend)**: Bar chart modern (CSS grid bar / SVG interaktif yang ringan dan responsif) yang menunjukkan pergerakan pengadaan per bulan.
  - **Kolom Kanan - Distribusi Departemen (Assets by Department)**: Progress horizontal bar per departemen dengan persentase dan label jumlah unit.
- **Baris Analitik Bawah (2 Kolom / Grid)**:
  - **Distribusi Kategori Aset**: Card proporsi kategori dengan progress bar persentase (Laptop, PC, Monitor, Printer, dll).
  - **Tabel Ringkas Aset Terkini (Recent Active Assets)**: 8-10 aset terbaru dengan status badge warna-warni semantik, garansi, dan tombol direct link ke detail aset.

### 4. Komponen Modular `RoleWelcomeWorkspace.tsx`
- Digunakan bersama oleh `/dashboard/employee/overview/page.tsx` dan `/dashboard/management/overview/page.tsx`.
- Desain *clean, premium, anti-slop*:
  - Card sapaan ramah dengan nama user, email, dan tanggal hari ini.
  - Role badge yang kontras dan elegan.
  - Info ringkasan hak akses yang dimiliki akun.
  - Slot kontainer modul masa depan (dengan layout grid cards terstruktur sehingga siap diisi modul saat ada pengembangan lanjutan).

---

## 6. Security, RBAC & Middleware Rules

### Aturan Rute pada `routes.ts` & `middleware.ts`:
1. `/dashboard/assets/overview`:
   - Hak akses: role IT / Admin (`super_admin`, `it_admin`, `it_staff`, `management`) atau permission `assets.view`.
2. `/dashboard/employee/overview`:
   - Terbuka untuk seluruh user yang sudah terotentikasi (khususnya role `employee`).
3. `/dashboard/management/overview`:
   - Hak akses: role `management`, `super_admin`, atau permission manajerial.
4. Auto-redirect logic `getDefaultRedirectForUser(user)`:
```typescript
if (normRole === 'superadmin' || normRole === 'super_admin' || normRole.includes('itadmin') || normRole.includes('itstaff')) {
  return '/dashboard/assets/overview';
}
if (normRole.includes('hr') || normRole.includes('attendance') || perms.includes('attendance.view')) {
  return '/dashboard/attendance/overview';
}
if (normRole === 'management') {
  return '/dashboard/management/overview';
}
if (normRole === 'employee') {
  return '/dashboard/employee/overview';
}
return '/dashboard/welcome';
```

---

## 7. Verification & Testing Standards

1. **Backend Integration & Unit Tests**:
   - Test suite baru: `backend/src/controllers/assetDashboardController.test.ts` untuk memverifikasi kalkulasi agregasi KPI, pengelompokan departemen, kategori, tren bulanan, dan penanganan nilai null.
   - Endpoint test: HTTP 200 dengan payload JSON yang valid dan HTTP 401/403 jika token tidak valid.
2. **Frontend Typecheck & Linting**:
   - `npm run lint` dan `npx tsc --noEmit` di direktori frontend untuk memastikan tidak ada type mismatch.
3. **E2E / Flow Verification**:
   - Verifikasi login dengan role SuperAdmin / ITAdmin $\rightarrow$ berhasil mendarat di `/dashboard/assets/overview`.
   - Verifikasi login dengan role HR $\rightarrow$ berhasil mendarat di `/dashboard/attendance/overview`.
   - Verifikasi login dengan role Employee $\rightarrow$ berhasil mendarat di `/dashboard/employee/overview`.
   - Verifikasi klik menu sidebar "Dashboard" membuka overview yang sesuai dengan role yang sedang aktif.
