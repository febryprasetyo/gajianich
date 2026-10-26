# Design Spec: HR Reconciliation Manual User/Employee Filter & Selection

## 1. Summary & Problem Statement

Halaman HR Reconciliation (`/dashboard/master/asset-custodians/reconciliation`) saat ini mencantumkan kartu rekonsiliasi (`ReconciliationCandidateCard`) untuk setiap pemegang aset yang belum terverifikasi (*unverified custodians*). Setiap kartu saat ini hanya menampilkan daftar saran otomatis (*suggested HR matches*) yang dihasilkan oleh algoritma fuzzy ranking.

Jika pemegang aset unverified memiliki nama yang jauh berbeda dari data HR (misalnya nama panggilan, singkatan, penulisan nama yang tidak lazim, atau hasil saran bernilai 0 match), staf/admin IT tidak dapat melakukan pencarian dan penautan secara manual langsung di kartu tersebut. Mereka terpaksa keluar atau tidak dapat merekonsiliasi entri tersebut ke data karyawan HR resmi.

Fitur ini melengkapi alur rekonsiliasi dengan menambahkan kontrol **Pencarian Manual Karyawan HR (Manual User/Employee Filter & Selection)** di setiap kartu rekonsiliasi, memungkinkan filter nama/NIP secara interaktif, pemilihan karyawan yang sesuai, serta deteksi cerdas apakah karyawan tersebut sudah memiliki profil custodian aktif (mengarahkan ke alur *Merge* jika sudah ada profil).

---

## 2. Goals & Non-Goals

### Goals
1. **Dua Mode Seleksi (Tab/Toggle)**:
   - Tab 1: **Suggested Matches (N)** — Menampilkan saran otomatis seperti eksisting.
   - Tab 2: **Cari Karyawan Manual** — Memungkinkan pencarian dan penyaringan data karyawan aktif dari direktori HR.
2. **Filter Interaktif Berdasarkan Nama / NIP**:
   - Kolom pencarian responsif untuk menyaring nama karyawan (`fullName`), kode karyawan (`employeeCode`), maupun departemen.
   - Menampilkan hasil filter secara efisien dengan batas tinggi scrollable dan indikator visual status kelayakan.
3. **Deteksi Konflik Profil (Smart Merge Advisory)**:
   - Jika karyawan yang dipilih manual **belum** memiliki profil custodian: tombol "Link to selected employee" aktif dan siap dieksekusi.
   - Jika karyawan yang dipilih manual **sudah** memiliki profil custodian aktif (`custodianId` sudah terdaftar): tampilkan peringatan informatif bahwa karyawan sudah memiliki holder aktif, serta sediakan tombol pintas ("Beralih ke Merge") untuk secara otomatis memilih custodian tersebut di dropdown Merge dan memfokuskan aksi Merge.
4. **Preservasi State & Aksesibilitas**:
   - Input pencarian aman, keyboard navigation compliant (WCAG 2.2 AA), accessible labels, dan mobile-responsive.

### Non-Goals
- Tidak mengubah skema database (`schema/assetCustodians.ts` atau `schema/employees.ts`), karena endpoint API dan relasi data saat ini sudah mendukung payload employeeId.
- Tidak menghapus fitur "Suggested Matches" atau "Merge into Another Holder" yang sudah ada.
- Tidak mengubah batasan otorisasi peran (tetap terbatas untuk SuperAdmin dan ITAdmin).

---

## 3. Data Model & Schema Diffs

- **Skema Database**: Tidak ada migrasi database baru yang diperlukan (`No Schema Changes`).
- Relasi database eksisting:
  - `asset_custodians.employee_id` me-reference `employees.id`.
  - Satu karyawan hanya boleh terhubung dengan maksimal satu active custodian (aturan integritas canonical). Jika sudah ada, backend mengembalikan status HTTP `409` dengan pesan: *"Employee already has an active custodian; merge into that record"*. Fitur UI baru ini menangani skenario ini di awal (client-side advisory).

---

## 4. API Specifications

### 4.1. Memperoleh Data Karyawan (Employees Directory)
- **Endpoint**: `GET /api/asset-custodians?status=ACTIVE`
- **Response Shape**:
  ```json
  {
    "custodians": [ ... ],
    "employees": [
      {
        "id": 101,
        "employeeCode": "EMP-001",
        "fullName": "Budi Santoso",
        "locationId": 1,
        "locationName": "Head Office",
        "departmentName": "Information Technology",
        "custodianId": 24
      }
    ]
  }
  ```
- Catatan: Endpoint ini sudah dipanggil di `CustodianReconciliationPage`, namun sebelumnya hanya field `custodians` yang disimpan di state. Kita akan menyimpan `employees` di state dan mendistribusikannya ke masing-masing `ReconciliationCandidateCard`.

### 4.2. Penautan Karyawan (Link Employee)
- **Endpoint**: `POST /api/asset-custodians/:id/link-employee`
- **Request Body**:
  ```json
  {
    "employeeId": 101
  }
  ```
- **Response**: `200 OK` dengan objek custodian yang telah diperbarui (`verificationStatus: "VERIFIED"`).
- **Error Codes**:
  - `404`: Custodian atau employee tidak ditemukan.
  - `409`: Karyawan sudah memiliki active custodian lain (disarankan merge).

### 4.3. Penggabungan Holder (Merge Custodian)
- **Endpoint**: `POST /api/asset-custodians/:id/merge`
- **Request Body**:
  ```json
  {
    "targetCustodianId": 24
  }
  ```
- **Response**: `200 OK` dengan entitas custodian sumber yang berstatus `MERGED`.

---

## 5. Frontend & Mobile UX

### 5.1. Komponen & Hirarki
- `CustodianReconciliationPage` (`frontend/src/app/dashboard/master/asset-custodians/reconciliation/page.tsx`):
  - Memperbarui `loadData` untuk menampung `allEmployees: EmployeeCandidate[]`.
  - Mengoper props `allEmployees` ke setiap `ReconciliationCandidateCard`.
- `ReconciliationCandidateCard` (`frontend/src/components/custodians/ReconciliationCandidateCard.tsx`):
  - Mengelola tab state internal: `'suggested' | 'manual'` (default: `'suggested'` jika terdapat matches, atau otomatis `'manual'` jika `matches.length === 0`).
  - Menambahkan bar tab switcher yang intuitif di atas kontainer HR matching.
  - **Tab 'Suggested Matches'**: Menampilkan daftar radio matches bawaan.
  - **Tab 'Cari Karyawan Manual'**:
    - Search input dengan ikon Search, placeholder *"Cari nama atau NIP karyawan..."*, serta tombol clear (X).
    - Daftar scrollable (maksimal tinggi 200px) berisi hasil filter nama/NIP real-time.
    - Setiap item menampilkan:
      - Radio button seleksi.
      - Nama lengkap, NIP, Departemen, dan Lokasi.
      - Badge status: jika sudah terhubung ke custodian lain, tampilkan label/badge abu-abu *"Sudah ada holder (#id)"*.
    - Jika karyawan yang dipilih sudah memiliki `custodianId`:
      - Muncul notice alert (amber) bertuliskan: *"Karyawan ini sudah memiliki profil holder aktif. Gunakan tombol di bawah untuk menggabungkan (Merge)."*
      - Tombol aksi *"Beralih ke Merge Karyawan Ini"* yang otomatis mengatur pilihan Merge ke ID custodian tersebut.
    - Jika karyawan yang dipilih belum memiliki custodian:
      - Tombol *"Link to selected employee"* aktif dan dapat diklik.

### 5.2. UI States
- **Loading State**: Spinner saat memuat data awal kandidat rekonsiliasi.
- **Empty State pada Filter Pencarian**: Pesan *"Tidak ada karyawan yang cocok dengan pencarian"* bila filter tidak menemukan nama.
- **Action Busy State**: Spinner dan disable button pada tombol aksi saat mutasi `link-employee` atau `merge` sedang diproses.

### 5.3. Aksesibilitas & Responsivitas
- Label ARIA pada tab switcher (`role="tablist"`, `aria-selected`).
- Semantic radio groups untuk opsi pemilihan.
- Tap target minimal 44x44px untuk penggunaan mobile dan tablet.
- Desain konsisten dengan tema desain TailwindCSS dan Slate/Emerald yang digunakan sistem.

---

## 6. Security & Integrity

- **Role-Based Access Control (RBAC)**: Fitur tetap terbatas bagi user dengan hak akses admin (`SuperAdmin` atau `ITAdmin`).
- **Validasi Integritas**: Memvalidasi `employeeId` berupa integer positif yang valid sebelum mengirim request API.
- **Audit Logging**: Backend secara otomatis mencatat riwayat audit penautan (`LINK_EMPLOYEE`) dan penggabungan (`MERGE`) termasuk identitas user pelaksana.
