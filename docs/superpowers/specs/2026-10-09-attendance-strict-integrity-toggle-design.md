# Design Spec: Opsi Toggle Integritas Data Ketat (Strict Integrity) pada Impor Absensi

## 1. Summary & Problem Statement
Pada modul impor absensi karyawan (*attendance import review*), sistem menerapkan aturan integritas ketat (*Strict Integrity*):
- Setiap baris data hasil impor yang berstatus `NEEDS_REVIEW` (misalnya karena scan dinormalisasi otomatis oleh parser BIFF/Excel) atau `BLOCKED` (karena scan sepihak atau karyawan belum terpetakan) akan mengunci tombol **"Simpan absensi"**.
- Untuk melakukan penyimpanan, tim HR/QA harus meninjau (*review*) setiap baris satu per satu.
- Pada skenario pengujian dengan ribuan baris data (seperti file `21-7.xls` yang berisi 3.261 baris dengan 205 perlu review dan 92 terblokir), proses review manual satu per satu sangat menghambat alur kerja pengujian (*development & testing*).

Fitur ini menyediakan kontrol **Toggle Integritas Data Ketat (Strict Integrity Mode)** pada halaman Review Impor Absensi:
- **Strict Integrity ON (Default):** Seluruh baris harus berstatus `READY` atau `SKIPPED` sebelum bisa disimpan.
- **Strict Integrity OFF (Lenient / Fast Import Mode):** Melewati keharusan review manual satu per satu. Seluruh data baris yang terupload dan terpetakan ke karyawan dapat langsung disimpan ke database absensi final, **kecuali data yang ganda/duplikat** yang akan otomatis dilewati (*SKIPPED*) guna menjaga keunikan catatan kehadiran harian.

---

## 2. Goals & Non-Goals

### Goals
- **Toggle Strict Integrity di UI:** Menyediakan switch interaktif di halaman [Review Impor Absensi](frontend/src/components/attendance/AttendanceImportsPage.tsx) untuk menyalakan/mematikan mode *Strict Integrity*.
- **Default Aman (Strict ON):** Secara bawaan (*default*), Strict Integrity tetap menyala (`true`) untuk menjaga kualitas data absensi produksi.
- **Bypass Review & Normalisasi saat OFF:**
  - Baris dengan status `NEEDS_REVIEW` (hasil normalisasi parser) langsung diizinkan untuk disimpan tanpa mengharuskan HR membuka modal review satu per satu.
  - Baris yang tidak memiliki pemetaan karyawan (`employeeId === null`) otomatis ditandai `SKIPPED` (dilewati) agar tidak memblokir batch.
- **Pencegahan Data Ganda Tetap Berlaku (Kecuali Duplikat):**
  - Baris absensi yang memiliki duplikasi tanggal untuk karyawan yang sama (baik terhadap catatan final yang sudah ada maupun duplikat di dalam file impor) **tetap tidak boleh disimpan ganda**, melainkan otomatis dilewati (*SKIPPED*) dengan alasan jelas: *"Dilewati otomatis karena catatan kehadiran ganda pada tanggal yang sama."*
- **Aktivasi Tombol Simpan Absensi:** Ketika mode Strict dimatikan, tombol **"Simpan absensi"** langsung aktif (*enabled*) selama terdapat minimal 1 baris data valid yang siap disimpan.
- **Unit Test Komprehensif:** Menguji alur penyimpanan batch baik dalam kondisi Strict ON maupun Strict OFF di `commands.test.mjs` / `domain.test.mjs`.

### Non-Goals
- Tidak mengizinkan penyimpanan ganda (2 record absensi untuk 1 karyawan pada tanggal yang sama). Integritas tanggal tunggal (*unique employeeId + workDate*) tetap dipertahankan.
- Tidak menghapus fitur review manual (pengguna tetap bisa meninjau manual jika diinginkan).

---

## 3. Data Model & Command Contract

### Perubahan Interface:
Pada [`frontend/src/lib/attendance/types.ts`](frontend/src/lib/attendance/types.ts):

1. **ImportBatch:**
```typescript
export interface ImportBatch {
  id: number;
  filename: string;
  sourceId: number;
  fileHash?: string;
  createdAt: string;
  status: 'DRAFT' | 'COMMITTED' | 'CANCELLED';
  rows: ImportRow[];
  strictIntegrity?: boolean; // Default: true (jika undefined dianggap true)
}
```

2. **AttendanceCommand:**
Memperluas perintah `batch` atau menambahkan perintah toggle integritas:
```typescript
export type AttendanceCommand =
  | ...
  | { 
      type: 'batch'; 
      batchId: number; 
      action: 'commit' | 'cancel' | 'reopen'; 
      strictIntegrity?: boolean; 
    }
  | { 
      type: 'toggle_strict_integrity'; 
      batchId: number; 
      enabled: boolean; 
    };
```

---

## 4. Business Logic (`frontend/src/lib/attendance/commands.ts`)

### Saat `action: 'commit'` dengan `strictIntegrity === false`:
1. Filter baris yang bukan `SKIPPED`.
2. Lakukan deduplikasi dan resolusi otomatis:
   - Jika `row.employeeId === null` -> tandai `reviewStatus = 'SKIPPED'`, note = *"Dilewati otomatis (karyawan tidak terdaftar di master data)"*.
   - Jika sudah ada catatan di `data.records` dengan `employeeId` dan `workDate` yang sama, ATAU sudah ada di baris batch sebelumnya -> tandai `reviewStatus = 'SKIPPED'`, note = *"Dilewati otomatis karena tanggal ganda / duplikat"*.
   - Baris lainnya yang memiliki `employeeId` dan tanggal valid (meskipun sebelumnya berstatus `NEEDS_REVIEW` atau `normalized`) -> langsung disetujui sebagai `READY` dan dimasukkan ke `data.records`.
3. Set status batch menjadi `'COMMITTED'`.
4. Catat ke audit trail dengan keterangan: *"Impor disimpan (Mode Fleksibel / Strict Integrity Nonaktif)"*.

---

## 5. UI/UX Specification

### Halaman Review Impor Absensi (`AttendanceImportsPage.tsx`)
1. **Komponen Toggle Strict Integrity:**
   - Diletakkan di bagian atas tabel di samping info statistik atau banner review.
   - Menggunakan switch interaktif:
     - **Aktif (Strict ON):**
       - Badge: *"Integritas Ketat Aktif"* (Wajib selesaikan review & pemetaan semua baris).
     - **Nonaktif (Strict OFF):**
       - Badge: *"Mode Cepat / Uji Coba"* (Review dilewati, baris tanpa karyawan atau ganda otomatis dilewati).
2. **Kondisi Tombol "Simpan absensi":**
   ```typescript
   const canCommit = strictIntegrity
     ? !blocking && batch.rows.some(r => r.reviewStatus === 'READY')
     : batch.rows.some(r => r.reviewStatus !== 'SKIPPED' && r.employeeId !== null);
   ```
3. **Banner Informasi Dinamis:**
   - Ketika Strict OFF: Menampilkan banner bernada informatif (amber/biru) yang menerangkan bahwa data yang diunggah akan langsung disimpan, baris yang tidak terpetakan atau tanggal duplikat akan dilewati secara otomatis.

---

## 6. Security & Data Integrity
- **Role-based Access Control (RBAC):** Hanya `HR_ADMIN` dan `HR_STAFF` (yang memiliki hak `canWrite`) yang dapat mengubah toggle dan menyimpan absensi.
- **Deduplikasi Mutlak:** Sistem tidak akan pernah mengizinkan dua data absensi aktif pada karyawan dan tanggal yang sama, sehingga rekap bulanan dan payroll terbebas dari tabrakan data ganda.

## 7. Refinement: Menu Pengaturan Khusus Admin (Bukan di Tampilan HR)
Berdasarkan umpan balik pengguna:
- Tombol sakelar (*toggle*) dihilangkan dari tampilan HR pada [Review Impor Absensi](frontend/src/components/attendance/AttendanceImportsPage.tsx).
- Kontrol pengaturan dipusatkan di menu khusus sisi admin: `/dashboard/attendance/settings` (Pengaturan Absensi), hanya dapat diakses oleh akun admin (`permission: attendance.manage` / `HR_ADMIN`).
- Memuat teks spesifik:
  - Judul: **Integritas Data Ketat (Strict Integrity)**
  - Status: **Aktif (Produksi)** / **Nonaktif (Uji Coba / Cepat)**
  - Deskripsi: **"Wajib menyelesaikan review semua baris bermasalah atau terblokir sebelum absensi dapat disimpan."**
- Nilai pengaturan disimpan di tingkat sistem (`data.meta.strictIntegrity`), sehingga berlaku menyeluruh bagi proses impor absensi.
