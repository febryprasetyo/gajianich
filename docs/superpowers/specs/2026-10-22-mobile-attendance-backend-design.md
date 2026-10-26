# Design Spec: Mobile PWA Attendance Backend & Integration

**File:** `docs/superpowers/specs/2026-10-22-mobile-attendance-backend-design.md`  
**Status:** DRAFT / APPROVED FOR IMPLEMENTATION  
**Date:** 2026-10-22  
**Author:** AI System Architect & Engineering Team  
**Scope:** Backend API, Data Models, Free Map Architecture (OpenStreetMap & Leaflet), 7-Day Photo Retention, Shift-Based HRD Verification, User-Employee Linkage  

---

## 1. Summary & Problem Statement

Frontend Mobile PWA untuk presensi karyawan mandiri telah dibangun di antarmuka `frontend/src/app/m/...` (Beranda, Presensi, Profil, Face Attendance Sheet). Diperlukan backend API dan integrasi data lengkap dengan 4 pilar arsitektur dan integrasi peta gratis:

1. **Arsitektur Peta Gratis (OpenStreetMap + Leaflet + Nominatim)**:
   - **Visualisasi Peta**: Menggunakan **OpenStreetMap (OSM)** publik dan library ringan **Leaflet.js** untuk merender titik koordinat karyawan serta lingkaran radius geofence kantor (100m). Bebas biaya selamanya, tanpa API key, dan tanpa risiko biaya kartu kredit.
   - **Reverse Geocoding**: Menggunakan **OSM Nominatim** untuk mengubah koordinat GPS menjadi nama jalan dan wilayah di Indonesia secara otomatis.
   - **Tautan Verifikasi HRD**: Menyimpan koordinat presisi dan meng-generate 2 tautan instan:
     - Tautan OpenStreetMap: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
     - Tautan Google Maps: `https://www.google.com/maps?q=${lat},${lng}` (membuka lokasi langsung di Google Maps tanpa kena biaya API).
2. **Relasi User & Karyawan (Didaftarkan Admin IT)**:
   - Akun pengguna di tabel `users` wajib berelasi langsung dengan master data karyawan (`employees.id`) melalui `users.employeeId`.
   - Pendaftaran dan penautan akun dilakukan oleh Admin IT. Pengguna yang belum ditautkan oleh Admin IT tidak dapat melakukan presensi mobile.
3. **Retensi Foto Presensi 7 Hari (1 Minggu)**:
   - Foto swafoto/wajah hasil absensi disimpan berformat WebP dengan masa retensi 7 hari.
   - Layanan berkala / script pembersihan otomatis menghapus file foto fisik setelah 7 hari untuk menghemat storage server (`photoPurgedAt = NOW()`), sementara rekaman log kehadiran, timestamp, koordinat, dan status verifikasi tetap dipertahankan permanen.
4. **Verifikasi Absensi oleh HRD Berdasarkan Shift**:
   - **Karyawan Office (Kantor)**: HRD hanya perlu memverifikasi absensi masuk (`IN` status `PENDING`), sedangkan absensi pulang otomatis disetujui (`OUT` status `APPROVED`).
   - **Karyawan Produksi**: HRD wajib memverifikasi absensi masuk (`IN`) **dan** absensi keluar (`OUT`) (keduanya berstatus `PENDING` hingga disetujui HRD).
   - Penentuan tipe shift dilakukan otomatis via `resolveEmployeeShift` (`OFFICE` vs `PRODUCTION`).

---

## 2. Goals & Non-Goals

### Goals
- **Zero-Cost Map & Geocoding**: 100% menggunakan infrastruktur peta terbuka (OpenStreetMap tile server, Nominatim geocoder, dan link direct Google Maps).
- **Strict User-Employee Linkage**: Validasi bahwa `req.user.userId` terikat ke `users.employeeId` yang aktif. Tolak dengan pesan edukatif jika belum didaftarkan Admin IT.
- **Geofence & Map Coordinates**: Simpan data lokasi presisi dan sediakan URL peta verifikasi bagi HRD.
- **Photo Retention Policy**: Direktori penyimpanan `data/attendance-selfies/YYYY-MM/` dilengkapi fungsi utilitas `purgeExpiredAttendancePhotos(retentionDays = 7)` yang membersihkan foto > 7 hari.
- **Differentiated HRD Verification**: Logika verifikasi shift:
  - Office Shift: `IN` -> `PENDING`, `OUT` -> `APPROVED` (auto).
  - Production Shift: `IN` -> `PENDING`, `OUT` -> `PENDING`.
- **HRD Verification Endpoints**: Endpoint bagi HRD untuk melihat log yang memerlukan review dan menyetujui/menolak (`/api/v1/attendance/mobile/verifications`).
- **Sinkronisasi Atomik `attendance_records`**: Memperbarui status, jam masuk/keluar, dan kalkulasi keterlambatan di modul desktop HR secara instan.

### Non-Goals
- Tidak menggunakan Google Maps JavaScript SDK berbayar atau layanan peta berbasis langganan komersial.
- Tidak menghapus log tabular kehadiran saat file foto kadaluarsa (data numerik & koordinat absensi tetap abadi).

---

## 3. Data Model & Schema

### A. Tabel `attendance_self_logs` (`backend/src/db/schema/attendanceSelfLogs.ts`)
```typescript
export const attendanceSelfLogs = pgTable('attendance_self_logs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  eventType: varchar('event_type', { length: 10 }).notNull(), // 'IN' | 'OUT'
  workDate: varchar('work_date', { length: 10 }).notNull(),   // 'YYYY-MM-DD'
  scanTime: varchar('scan_time', { length: 10 }).notNull(),   // 'HH:mm:ss'
  shiftCode: varchar('shift_code', { length: 50 }).notNull(), // 'OFFICE' | 'PROD_6D' | etc.
  shiftCategory: varchar('shift_category', { length: 20 }).notNull(), // 'OFFICE' | 'PRODUCTION'
  
  // Koordinat & Peta OpenStreetMap untuk Verifikasi HRD
  latitude: varchar('latitude', { length: 30 }),
  longitude: varchar('longitude', { length: 30 }),
  accuracy: integer('accuracy'), // meter
  address: text('address'),
  mapUrl: text('map_url'),               // OSM Pinpoint: https://www.openstreetmap.org/?mlat=...&mlon=...
  googleMapsUrl: text('google_maps_url'), // Google Maps Shortcut: https://www.google.com/maps?q=...
  isWithinGeofence: boolean('is_within_geofence').default(true).notNull(),
  distanceMeters: integer('distance_meters'),

  // Retensi Foto (1 Minggu)
  photoUrl: text('photo_url'),       // Path file WebP di server
  photoPurgedAt: timestamp('photo_purged_at'), // Timestamp jika foto sudah dibersihkan setelah 7 hari
  
  // Audit Transaksi & Perangkat
  txHash: varchar('tx_hash', { length: 100 }).notNull(),
  deviceInfo: text('device_info'),
  notes: text('notes'),

  // Status Verifikasi HRD (Berdasarkan Aturan Shift)
  requiresVerification: boolean('requires_verification').default(true).notNull(),
  approvalStatus: varchar('approval_status', { length: 20 }).default('PENDING').notNull(), // 'PENDING' | 'APPROVED' | 'REJECTED'
  approvalNote: text('approval_note'),
  verifiedById: bigint('verified_by_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  verifiedAt: timestamp('verified_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### B. Tabel `attendance_face_profiles` (`backend/src/db/schema/attendanceFaceProfiles.ts`)
```typescript
export const attendanceFaceProfiles = pgTable('attendance_face_profiles', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employees.id, { onDelete: 'cascade' }).unique(),
  isEnrolled: boolean('is_enrolled').default(true).notNull(),
  faceDescriptorHash: varchar('face_descriptor_hash', { length: 128 }),
  samplePhotoUrl: text('sample_photo_url'),
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

---

## 4. Logika Bisnis & Peta

### A. Formula Peta & Generator URL
Di `backend/src/domain/geofence.ts`:
```typescript
export function buildMapLinks(latitude: number, longitude: number) {
  const osmUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  return { osmUrl, googleMapsUrl };
}
```

### B. Validasi Akun Karyawan oleh Admin IT
Saat request masuk ke endpoint presensi mobile:
```typescript
const user = await db.select().from(users).where(eq(users.id, req.user.userId)).limit(1);
if (!user[0] || !user[0].employeeId) {
  return res.status(403).json({
    error: 'Akun Anda belum dikaitkan dengan master data karyawan oleh Admin IT. Hubungi Admin IT untuk aktivasi akses presensi mobile.',
  });
}
```

### C. Aturan Verifikasi Berdasarkan Shift (Office vs Produksi)
1. Server menentukan shift karyawan untuk tanggal tersebut menggunakan `resolveEmployeeShift`.
2. Klasifikasi shift:
   - Jika `shift.code === 'OFFICE'` atau mengandung kata `"office"` -> Kategori: `'OFFICE'`
   - Jika `shift.code.includes('PROD')` atau mengandung kata `"produksi"` -> Kategori: `'PRODUCTION'`
3. Evaluasi Verifikasi:
   - **Karyawan Office**:
     - `eventType === 'IN'`: `requiresVerification = true`, `approvalStatus = 'PENDING'`, `approvalNote = 'Menunggu verifikasi masuk oleh HRD'`.
     - `eventType === 'OUT'`: `requiresVerification = false`, `approvalStatus = 'APPROVED'`, `approvalNote = 'Otomatis disetujui (Karyawan Office)'`.
   - **Karyawan Produksi**:
     - `eventType === 'IN'`: `requiresVerification = true`, `approvalStatus = 'PENDING'`, `approvalNote = 'Menunggu verifikasi masuk oleh HRD (Produksi)'`.
     - `eventType === 'OUT'`: `requiresVerification = true`, `approvalStatus = 'PENDING'`, `approvalNote = 'Menunggu verifikasi pulang oleh HRD (Produksi)'`.

### D. Retensi Foto 1 Minggu
1. Foto disimpan di: `data/attendance-selfies/YYYY-MM/{txHash}.webp`.
2. Utility `purgeExpiredAttendancePhotos(retentionDays = 7)`:
   - Mencari entri `attendance_self_logs` dengan `createdAt < NOW() - 7 hari` dan `photoUrl IS NOT NULL`.
   - Menghapus file gambar fisik dari disk (`fs.unlink`).
   - Mengupdate kolom `photoUrl = null`, `photoPurgedAt = NOW()`.
   - Kolom koordinat map, jam absen, dan riwayat verifikasi tetap utuh.

---

## 5. API Endpoints

### Karyawan Mobile (`/api/v1/attendance/mobile/`)
1. `GET /summary`: Rekap absensi hari ini, shift info, lokasi kantor, status approval, pendaftaran wajah.
2. `POST /clock`: Punch absensi (IN/OUT) dengan GPS, swafoto, map URL, dan evaluasi status shift.
3. `GET /history`: Riwayat absensi bulanan untuk tabel dan `DayDetailSheet` (termasuk link peta).
4. `POST /enroll-face`: Pendaftaran status biometrik wajah.

### HRD & Admin (`/api/v1/attendance/mobile/`)
5. `GET /verifications`: Mengambil daftar absensi mobile yang membutuhkan verifikasi HRD (difilter berdasarkan `approvalStatus = 'PENDING'`). Mengembalikan detail foto, peta lokasi map, nama karyawan, shift (Office/Produksi), dan jam scan.
6. `POST /verify`: Memverifikasi absensi (set `approvalStatus = 'APPROVED' | 'REJECTED'`, mencatat `verifiedById` dan `verifiedAt`).
