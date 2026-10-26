# AMS Attendance Migration Implementation Plan

> **Untuk pelaksana:** Gunakan `superpowers:executing-plans` untuk implementasi task-by-task. `superpowers:subagent-driven-development` dapat digunakan jika metode delegasi dipilih pada sesi implementasi. Checklist di bawah belum dieksekusi.

**Goal:** Memindahkan fitur absensi Gajianich menjadi modul web dengan login/layout AMS yang sama, tetapi seluruh data bisnis dan master karyawannya terisolasi dalam tabel `attendance_*`.

**Architecture:** Port domain Rust ke TypeScript di backend Express. Next.js menggunakan shell, login dan API client AMS. PostgreSQL boleh satu database, tetapi master karyawan/departemen/lokasi, grant akses modul, draft, record, revisi dan audit semuanya berada pada tabel `attendance_*` tanpa FK/join ke tabel bisnis AMS. Migrasi historis memakai snapshot SQLite dan rekonsiliasi yang dapat diulang.

**Tech Stack:** Stack AMS existing: Next.js 16.2.12, React 19.2.4, Tailwind 4, Express, TypeScript, Drizzle/PostgreSQL, Zod, Multer, node:test/tsx. Tidak ada upgrade framework yang diminta.

**Spec:** [Spesifikasi migrasi](../specs/2026-09-25-ams-attendance-migration-design.md).

**Status:** Rencana implementasi. Path file baru di bawah adalah target yang belum dibuat. Semua path relatif terhadap root `ams-app` kecuali disebut sumber Gajianich.

**Penajaman kebutuhan 25 September 2026:** pengguna menetapkan attendance tanpa potongan akibat ketidakhadiran. Dua hasil rekap utama adalah total durasi keterlambatan dan total durasi lembur per karyawan/periode. Referensi gambar Data Absensi menjadi arah susunan halaman. Sebelum task implementasi halaman, selaraskan desain halaman utama, sumber jadwal/shift, dan penguncian periode ke schema/API/route; rincian tersebut belum ditetapkan oleh gambar. Plan ini belum menyatakan fitur-fitur tersebut siap dieksekusi.

## Global Constraints

- Branch usulan: `feat/attendance-migration`; periksa status dan instruksi repository sebelum membuat branch/worktree.
- Satu aplikasi web AMS, tanpa runtime Tauri/Rust produksi atau database SQLite operasional baru.
- Tidak membuat menu Absence deduction, denda keterlambatan, potongan ketidakhadiran, atau kalkulasi nominal lembur. Rekap menjumlahkan menit final per karyawan/periode; durasi bukan nominal uang.
- Autentikasi, `DashboardLayout`, `ModalShell`, `StatusBadge`, dan `api.ts` existing digunakan ulang. Tabel employees/master/audit/assets AMS tidak digunakan ulang.
- Master baru `attendance_employees`, `attendance_departments`, dan `attendance_locations` berdiri sendiri; tidak ada lookup, FK, join, sinkronisasi, atau deduplikasi terhadap master AMS.
- Actor menggunakan snapshot principal dari login bersama, tanpa FK ke users AMS. Grant domain berada pada `attendance_access_grants`, bukan roles/users AMS.
- Tidak auto-create karyawan dari file, tidak auto-merge nama, tidak memetakan nomor mesin langsung ke employeeCode.
- Angka nol di depan nomor mesin dipertahankan; source menjadi namespace identitas.
- Limit 20 MiB per file, 50.000 baris; pagination default 50, maksimum 100; rentang laporan maksimum 366 hari.
- Record unik per karyawan/tanggal; commit dan koreksi bersama audit wajib atomik; stale write ditolak 409.
- Role HR tidak mewarisi izin IT. Actor berasal dari akun yang terautentikasi dan masih aktif.
- Journal Drizzle wajib; dilarang `db:push`. Migrations additive, kompatibel dengan aplikasi lama selama cutover.
- TypeScript tanpa `any`; kontrak API camelCase. Tidak menyalin monolit App.tsx atau fallback data contoh.
- Ikuti page override terang-merah sesuai dashboard aktual; tidak mengubah tema global.
- Perintah backend dijalankan dari `backend/`, frontend dari `frontend/`, scripts tingkat root dari root AMS.
- Tes database wajib memakai database uji terpisah. Jangan menjalankan suite integration pada database operasional.
- Commit hanya file milestone yang selesai diverifikasi. Push, merge, dan deployment mengikuti instruksi sesi implementasi dan runbook release AMS.

## Review Focus

| Kegagalan yang mudah terlewat | Perilaku yang diwajibkan | Task |
|---|---|---|
| Fixture BIFF hilang/berubah atau file parsial | Tes gagal eksplisit; byte rusak tidak dianggap file sukses parsial | 2 |
| Mapping berubah setelah reviewer membuka draft | Commit memeriksa identity revision; 409 tanpa write parsial | 3–4 |
| Response commit hilang atau dua HR menyimpan bersamaan | Receipt retry tetap; hanya satu record employee/date | 4 |
| Akun masih membawa JWT lama setelah grant dicabut | Status akun login dan grant absensi terkini menentukan akses | 3 |
| Modal diperbaiki tetapi pemakai existing rusak di mobile | Header/footer dan fokus aman pada absensi serta modal aset/karyawan/lisensi | 6–7 |

Tambahkan gate isolasi pada task 1, 3, dan 8: ID/nama/kode yang sama di master AMS dan absensi tidak saling terhubung, serta seluruh FK absensi hanya menuju attendance_*.

## 1. Peta file dan batas tanggung jawab

| File/direktori target | Tanggung jawab |
|---|---|
| `backend/src/db/schema/attendance.ts` | Tabel, FK, unique/index/check constraints pada spec. |
| `backend/drizzle/` | SQL migration, snapshot, journal yang dihasilkan CLI. |
| `backend/src/domain/attendanceTypes.ts` | DTO publik murni tanpa import runtime atau dependency server. |
| `backend/src/domain/attendanceNormalization.ts` | Parser durasi/tanggal dan fungsi normalisasi murni. |
| `backend/src/domain/attendanceAccess.ts` | Matriks izin domain. |
| `backend/src/services/attendanceBiff.ts` | Validasi bytes dan parsing raw BIFF. |
| `backend/src/services/attendanceIdentity.ts` | Source, pemetaan, validasi identity revision. |
| `backend/src/services/attendanceMaster.ts` | CRUD master karyawan/departemen/lokasi absensi, tanpa import schema master AMS. |
| `backend/src/services/attendanceAudit.ts` | Append audit domain attendance dan actor snapshot. |
| `backend/src/services/attendanceImport.ts` | Upload, persist raw rows, draft, konflik dan review. |
| `backend/src/services/attendanceCommit.ts` | Transaksi commit dan receipt idempotent. |
| `backend/src/services/attendanceRecords.ts` | Penciptaan manual dan koreksi dengan revisi. |
| `backend/src/services/attendanceReporting.ts` | Kartu, rekap, summary, dan CSV. |
| `backend/src/services/attendanceMigration.ts` | Dry-run, apply, resume/no-op dan rekonsiliasi legacy. |
| `backend/src/middleware/attendanceAccess.ts` | Periksa akun login aktif melalui adapter auth dan grant attendance aktual. |
| `backend/src/services/attendanceGrants.ts` | Pengelolaan grant domain oleh SuperAdmin AMS tanpa mengubah role login. |
| `backend/src/controllers/attendanceController.ts` | Validasi transport dan mapping response; pecah import/report controller jika tanggung jawab membesar. |
| `backend/src/routes/attendanceRoutes.ts` | Middleware, upload dan daftar endpoint spec. |
| `backend/src/app.ts` | Mount `/api/v1/attendance`. |
| `backend/src/scripts/migrateGajianich.ts` | CLI migrasi historis, tidak dijalankan saat server startup. |
| `backend/src/testing/attendanceFixtures.ts` | Builder fixture sintetis dan utilitas integration test. |
| `scripts/export-gajianich.py` | Ekspor read-only snapshot SQLite memakai Python stdlib. |
| `scripts/sync-attendance-contracts.mjs` | Sinkronisasi DTO publik backend ke frontend, mode `--check`. |
| `frontend/src/lib/attendance/types.ts` | Salinan generated DTO; tidak diedit manual. |
| `frontend/src/lib/attendance/api.ts` | Adapter tipis API client existing dengan timeout. |
| `frontend/src/lib/attendance/presentation.ts` | Label status, satuan, filter dan aturan enable action. |
| `frontend/src/hooks/attendance/` | Hook data/mutation per workflow, tanpa JSX. |
| `frontend/src/components/attendance/` | Tabel, toolbar, upload, review, konflik, correction, dan history. |
| `frontend/src/app/dashboard/attendance/` | Page composition untuk seluruh route di spec. |
| `design-system/pages/attendance*.md` | Override desain modul dan per halaman. |
| `docs/operations/ams-attendance-migration.md` | Salinan runbook yang dipelihara di repo tujuan saat implementasi. |

File existing yang disentuh secara terbatas: API/AuthContext untuk timeout dan session invalidation, DashboardLayout untuk menu/permission absensi, ModalShell untuk kepatuhan mobile/fokus, app.ts untuk mount route, dan pipeline verifikasi. Employee routes/controller, EmployeeTable, schema master, audit AMS dan seed role existing tidak diubah. Semua perubahan shell kompatibel dengan pemakai lama.

Tambahkan error code sesi pada `backend/src/middleware/auth.ts` secara kompatibel agar 403 insufficient-role tidak disamakan dengan token invalid; uji alur login existing.

## 2. Kontrak TypeScript bersama

Tambahkan definisi berikut pada `backend/src/domain/attendanceTypes.ts`. Backend menjadi pemilik kontrak; script sinkronisasi menyalin file secara deterministik ke `frontend/src/lib/attendance/types.ts` dengan header generated. CI mode `--check` gagal bila isi berbeda. Ini menghindari import lintas `rootDir` backend dan tidak membutuhkan workspace package baru.

```ts
export type ReviewStatus = 'READY' | 'NEEDS_REVIEW' | 'BLOCKED' | 'SKIPPED';
export type AttendanceStatus = 'PRESENT' | 'IZIN' | 'SAKIT' | 'CUTI' | 'ALPHA' | 'UNSPECIFIED';
export type BatchStatus = 'DRAFT' | 'COMMITTED' | 'CANCELLED';
export type OriginTag = 'RAW_EXACT' | 'MISSING_SCAN_IN' | 'MISSING_SCAN_OUT' | 'MANUAL_OVERRIDE';
export type AttendancePermission = 'read' | 'draft' | 'commit' | 'correct' | 'master' | 'identity' | 'summary';
export type AttendanceRole = 'HR_ADMIN' | 'HR_STAFF' | 'REPORT_VIEWER';
export interface AttendanceActor {
  principalKey: string;
  displayName: string;
  roleAtAction: AttendanceRole | 'ACCESS_ADMIN';
}

export interface AttendanceValues {
  scanIn: string | null;
  scanOut: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
}
export interface RawAttendanceRow {
  rowNumber: number;
  externalNoId: string;
  employeeName: string;
  department: string | null;
  workDate: string;
  scheduleIn: string | null;
  scheduleOut: string | null;
  scanIn: string | null;
  scanOut: string | null;
  lateDuration: string | null;
  earlyDuration: string | null;
  overtimeDuration: string | null;
  rawCells: Record<string, string>;
}
export interface NormalizationRules {
  version: string;
  normalizeMissingScanIn: boolean;
  normalizeMissingScanOut: boolean;
}
export interface NormalizedAttendanceRow {
  raw: RawAttendanceRow;
  proposed: AttendanceValues;
  status: ReviewStatus;
  originTag: OriginTag;
  issues: string[];
}
export interface CommitRequest { expectedRevision: number }
export interface CommitReceipt {
  batchId: number;
  status: 'COMMITTED';
  receiptId: string;
  committedAt: string;
  insertedRecords: number;
  updatedRecords: number;
  skippedRows: number;
  revision: number;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface AttendanceErrorBody {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
```

Tambahkan DTO row/detail/card/report pada task pemilik endpoint, mengikuti kolom dan response pada spec. DTO tidak mengekspor row ORM langsung, Buffer, bytes file asli, token, atau field internal database. Normalisasi status kehadiran dan status review selalu menggunakan tipe terpisah.

## Task 1: Schema, kontrak, dan sumber identitas

**Files:** Buat `backend/src/db/schema/attendance.ts`, `backend/src/domain/attendanceTypes.ts`, `backend/src/db/attendanceMigration.test.ts`, `scripts/sync-attendance-contracts.mjs`; hasilkan migration di `backend/drizzle/`. Tidak mengubah seed/schema existing.

**Consumes:** Model data spec bagian 5 dan pola Drizzle AMS sebagai referensi penulisan, tanpa import entitas bisnis existing.

**Produces:** Tiga belas tabel baru berawalan attendance_, FK internal/index/check constraints, kontrak shared generated. Tidak menambahkan role/akun di AMS.

- [ ] Buat tes database untuk UNIQUE(source, externalNoId), UNIQUE(employee, date), durasi negatif, FK employee RESTRICT, dan dua nomor `001`/`1` yang tetap berbeda.
- [ ] Tambahkan introspeksi `pg_constraint` untuk membuktikan tidak ada FK attendance_* menuju tabel di luar attendance_*. Catat schema checksum tabel bisnis AMS sebelum/sesudah migrasi agar schema existing terbukti tidak berubah.
- [ ] Jalankan dari backend: `npx tsx --test src/db/attendanceMigration.test.ts`; pastikan tes merah karena schema target belum tersedia pada database uji.
- [ ] Definisikan schema sesuai spec, buat migration dengan `npm run db:generate`, review SQL dan journal, lalu `npm run db:migrate` ke database uji.
- [ ] Tambahkan source awal GAJIANICH secara idempotent; grant pertama diberikan melalui pengelolaan akses khusus SuperAdmin setelah deploy. Jangan menjalankan seed penuh atau menulis roles/users AMS.
- [ ] Implementasikan script copy DTO memakai `readFile`/`writeFile`; `--check` membandingkan isi tanpa menulis dan exit 1 jika berbeda. Jalankan dari root `node scripts/sync-attendance-contracts.mjs`, lalu `node scripts/sync-attendance-contracts.mjs --check`.
- [ ] Verifikasi backend `npx tsx --test src/db/attendanceMigration.test.ts` dan `npm run build`. Uji apply migrasi dua kali dan jalankan tes migration existing.
- [ ] Review diff hanya scope milestone; commit `feat(attendance): add schema and public contracts`.

Contoh assertion inti integration test setelah tabel tersedia:

```ts
await assert.rejects(() => pool.query(
  'INSERT INTO attendance_records (employee_id, work_date, late_minutes, early_minutes, overtime_minutes, attendance_status, revision_number, created_at, updated_at) VALUES ($1, $2, -1, 0, 0, $3, 1, now(), now())',
  [employeeId, '2026-09-01', 'PRESENT'],
));
```

`employeeId` berasal dari fixture **attendance_employees**, bukan employees AMS atau ID production; pool dan cleanup mengikuti pola integration test AMS.

## Task 2: Parser BIFF dan normalisasi yang setara

**Files:** Buat `backend/src/services/attendanceBiff.ts`, `backend/src/services/attendanceBiff.test.ts`, `backend/src/domain/attendanceNormalization.ts`, `backend/src/domain/attendanceNormalization.test.ts`, `backend/src/testing/attendanceFixtures.ts`.

**Consumes:** `RawAttendanceRow`, `NormalizationRules`, `NormalizedAttendanceRow` dari task 1; importer/normalizer dan oracle tests Gajianich.

**Produces:** `parseBiffAttendance(buffer: Buffer): RawAttendanceRow[]`; `parseDurationMinutes(value: string): number`; `parseWorkDate(value: string): string`; `normalizeAttendanceRow(row: RawAttendanceRow, rules: NormalizationRules): NormalizedAttendanceRow`.

- [ ] Tulis tes unit berikut dan kasus scan kosong/satu scan hilang, malformed BIFF, signature salah, leading zero, tahun kabisat, size/row limit. Import fungsi dari file task ini.

```ts
test('duration keeps hours beyond a clock day', () => {
  assert.equal(parseDurationMinutes('25:00'), 1500);
  assert.equal(parseDurationMinutes(''), 0);
  assert.throws(() => parseDurationMinutes('01:60'));
  assert.throws(() => parseDurationMinutes('-01:00'));
});
test('work date uses a real calendar date', () => {
  assert.equal(parseWorkDate('29/02/2024'), '2024-02-29');
  assert.throws(() => parseWorkDate('29/02/2025'));
});
```

- [ ] Jalankan dari backend `npx tsx --test src/services/attendanceBiff.test.ts src/domain/attendanceNormalization.test.ts`; pastikan gagal pada modul yang belum diimplementasikan.
- [ ] Port parser binary berdasarkan signature/record boundaries sumber. Jangan memakai ExcelJS sebagai pengganti tanpa bukti fixture. Parser tanggal tidak boleh memakai auto-rollover `new Date` tanpa pengecekan ulang komponen tanggal.
- [ ] Port normalisasi, pertahankan rawCells dan nomor mesin sebagai string. Invalid duration menghasilkan issue BLOCKED; dua scan kosong tetap SKIPPED.
- [ ] Tegaskan tes sumber durasi: scan masuk kosong menolkan hanya terlambat, scan pulang kosong menolkan hanya pulang cepat; kategori lain tetap sumber. Mengubah scan tidak menghitung ulang durasi. Kolom durasi wajib hilang harus gagal, kolom alternatif/angka Riil tidak boleh menggantikannya.
- [ ] Uji privat terhadap file nyata `gajianich/data/asd.xls`: SHA-256 `8b76d6c95d9e8fc94c643ce630add54c641f61248fe10996d0fea73162f9b3a5`, 183 baris. Bandingkan seluruh hasil dengan Rust, bukan hanya jumlah. Jangan commit data personal fixture nyata; commit fixture sintetis dengan struktur BIFF ekuivalen.
- [ ] Jalankan perintah tes yang sama dan `npm run build`. Simpan bukti perbandingan privat dan hasil benchmark 10.000/50.000 baris.
- [ ] Commit `feat(attendance): port BIFF parser and normalization rules`.

## Task 3: Grant HR, master absensi, source, identity, dan upload persisten

**Files:** Buat access domain/middleware, grants/master/audit/identity/import services, routes/controller dari peta file; buat `backend/src/controllers/attendanceAccess.integration.test.ts`, `backend/src/services/attendanceIdentity.integration.test.ts`, `backend/src/services/attendanceMaster.integration.test.ts`, `backend/src/controllers/attendanceImport.integration.test.ts`; ubah app.ts untuk mount router baru saja.

**Consumes:** Parser task 2, schema attendance task 1, authenticateToken existing dan adapter status akun login aktual; grant aktif dari attendance_access_grants. users.role aktual hanya diperlukan untuk izin pengelolaan grant SuperAdmin AMS.

**Produces:** Me/grant/master/source/identity endpoints, upload/list/detail/rows/file endpoints; akses backend sesuai matriks; batch DRAFT beserta raw/proposal persisten. Tidak memakai employee/master endpoint AMS.

- [ ] Tulis integration test token missing→401, akun tanpa grant termasuk SuperAdmin→403 untuk data bisnis, grant HR_STAFF upload→201/mapping→403, grant HR_ADMIN mapping→201. Akun login fixture dan grant harus benar-benar ada/aktif; token buatan saja tidak cukup.
- [ ] Tambahkan tes akun dinonaktifkan/grant dicabut dengan JWT masih valid: akses berikutnya ditolak. REPORT_VIEWER tidak boleh membaca imports/identities. SuperAdmin dapat mengelola grant; role AMS tidak otomatis berubah setelah grant dibuat.
- [ ] Tulis tes CRUD attendance_employees dengan email/kode opsional, department/location FK internal, nama ganda yang sah, nonaktifkan tanpa menghapus histori. Siapkan karyawan AMS dengan ID/nama/kode sama; perubahan absensi tidak mengubah karyawan atau audit AMS.
- [ ] Tambahkan tes file sama mengembalikan ID batch yang sama; nomor belum mapped menahan commit; error parse tidak meninggalkan batch; raw file/hash/rows tetap tersedia sesudah restart server test.
- [ ] Jalankan dari backend `npx tsx --test src/controllers/attendanceAccess.integration.test.ts src/services/attendanceIdentity.integration.test.ts src/services/attendanceMaster.integration.test.ts src/controllers/attendanceImport.integration.test.ts` pada database uji.
- [ ] Implementasikan multer limit, validasi signature, Zod payload strict, transaction persist upload, dan list terpaginate. Jangan mengirim Buffer dalam JSON.
- [ ] Implementasikan master/source/identity mutation dengan validasi, revision, FK internal dan attendance_audit_logs. Mapping yang sudah digunakan final tidak dapat dialihkan. Form master absensi tidak membutuhkan atau menawarkan karyawan AMS.
- [ ] Implementasikan `/me` dan grant endpoints; snapshot actor dari principal server, tanpa FK users/roles. Gagal membaca permission modul tidak boleh memblokir halaman ITSM existing.
- [ ] Mount router dengan urutan route statis sebelum route parameter yang berpotensi bertabrakan; jalankan tes di atas dan `npm run build`.
- [ ] Commit `feat(attendance): add HR access and persistent import drafts`.

## Task 4: Review, konflik, commit dan koreksi final

**Files:** Tambah `backend/src/services/attendanceCommit.ts`, `backend/src/services/attendanceRecords.ts`, `backend/src/services/attendanceCommit.integration.test.ts`, `backend/src/services/attendanceRecords.integration.test.ts`; lengkapi import service/controller/routes.

**Consumes:** Batch/rows tersimpan, identity revision, akun aktual; DTO `CommitRequest` dan `CommitReceipt`.

**Produces:** Endpoint edit/ack/conflict/reconcile/cancel/reopen/commit; create/patch record dan revision list. Commit menerima batch ID + expectedRevision + key, tidak menerima daftar raw/final dari klien.

- [ ] Tulis tes acknowledgment invalid setelah edit, blocked/missing identity/unresolved conflict→422, mapping berubah→409, keep-existing menyimpan bukti incoming tanpa overwrite final.
- [ ] Tulis tes pilih incoming terhadap record existing: commit membuat revisi baru dan menaikkan updatedRecords; expectedRecordRevision stale menolak seluruh commit. Edit tanggal draft menghitung ulang konflik tanpa mengubah raw.
- [ ] Tulis tes dua commit bersamaan, receipt retry identik, key sama payload berbeda→409, dan error audit menyebabkan seluruh transaksi rollback.
- [ ] Tulis tes dua koreksi dengan expectedRevision sama: tepat satu sukses dan satu 409; revision/audit hanya bertambah sekali.

```ts
const results = await Promise.all([
  submitCorrection(recordId, { ...correction, expectedRevision: 1 }),
  submitCorrection(recordId, { ...correction, expectedRevision: 1 }),
]);
assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
```

`submitCorrection` adalah helper HTTP test lokal yang mengirim PATCH record dengan token HRAdmin fixture dan mengembalikan Response; `correction` berisi seluruh nilai sesuai schema endpoint.

- [ ] Jalankan dari backend `npx tsx --test src/services/attendanceCommit.integration.test.ts src/services/attendanceRecords.integration.test.ts` dan catat kegagalan sebelum implementasi.
- [ ] Implementasikan lock batch/row, conditional revision update, transaction audit/receipt/records, serta unique error→409. Mutasi draft menaikkan batch revision.
- [ ] Simpan keputusan konflik existing beserta versi record yang direview. Saat memilih incoming, conditional update dan revision before/after ikut transaksi commit; pertahankan ID record existing dan seluruh histori.
- [ ] Implementasikan retry committed batch dengan memeriksa receipt/key/hash tersimpan sebelum menolak expectedRevision lama akibat commit yang sama.
- [ ] Implementasikan perubahan manual final dan alasan wajib, termasuk status nonhadir dengan scan null/durasi nol.
- [ ] Jalankan tes task 3–4 dan `npm run build`; commit `feat(attendance): add transactional review and corrections`.

## Task 5: Kartu, laporan, CSV dan arsip audit

**Files:** Buat `backend/src/services/attendanceReporting.ts`, `backend/src/services/attendanceReporting.integration.test.ts`; lengkapi DTO/controller/routes.

**Consumes:** attendance_records/revisions/employees/departments/locations/audit_logs/legacy_entities, seluruhnya dalam domain attendance.

**Produces:** Card/report/summary/CSV/audit endpoints sesuai spec; summary untuk grant REPORT_VIEWER tanpa identitas.

- [ ] Tulis tes rentang inklusif, NO_DATA bukan ALPHA, record inactive historis tetap tampil, draft tidak masuk total, pagination tidak mengubah grand total, dan export mencakup seluruh filter.
- [ ] Tulis tes dua total utama per karyawan: keterlambatan 15+20+10 menjadi 45 menit; lembur 60+90+0 menjadi 150 menit. Beberapa nomor mesin yang dipetakan ke satu karyawan tidak menggandakan rekap; revisi lama digantikan nilai final, bukan ikut dijumlahkan. Bedakan nol valid dengan belum ada record final. Data pulang cepat tetap tersimpan untuk detail/rekonsiliasi historis tanpa kalkulasi potongan.
- [ ] Tulis tes report/CSV memakai dataVersion snapshot: perubahan record setelah laporan dibaca menghasilkan 409 REPORT_CHANGED ketika ekspor memakai versi lama.
- [ ] Tambahkan tes CSV nama mengandung koma, newline, tanda kutip, dan awalan formula `=`, `+`, `-`, `@`; field berpotensi formula dibuat aman tanpa mengubah nilai tersimpan.
- [ ] Tambahkan tes REPORT_VIEWER summary tidak memiliki employeeId/fullName/externalNoId; parameter employeeId ditolak; direct card/audit/file access→403.
- [ ] Jalankan `npx tsx --test src/services/attendanceReporting.integration.test.ts` dari backend.
- [ ] Implementasikan query agregasi PostgreSQL, date bounds, pagination, label departemen saat ini, serta CSV server-side dari query yang sama dengan laporan.
- [ ] Gunakan transaksi read-only REPEATABLE READ, hash record ID/revision dan metadata tampilan/filter untuk dataVersion; audit ekspor mencatat versi/filter/waktu tanpa isi personal CSV.
- [ ] Jalankan tes task ini dan `npm run build`; commit `feat(attendance): add cards reports and audit views`.

## Task 6: Integrasi API, shell, navigasi dan aturan desain

**Files:** Buat page override pada spec bagian 2, `frontend/src/lib/attendance/api.ts`, `frontend/src/lib/attendance/presentation.ts`, `frontend/src/lib/attendance/presentation.test.mjs`, `frontend/src/lib/attendance/api.test.mjs`; ubah API/AuthContext, ModalShell, DashboardLayout dan frontend/package.json.

**Consumes:** Kontrak generated task 1–5, API client existing, design-quality rules.

**Produces:** API adapter dengan timeout/abort, izin menu absensi, shared modal sesuai mobile, helper label/action yang teruji. Role guard tidak mengubah canManageCustodians.

- [ ] Tulis tes helper label NO_DATA/SKIPPED/ALPHA berbeda dan tombol commit hanya tersedia untuk role/status yang sah.
- [ ] Tegaskan helper presentasi menandai anomali hasil normalisasi dengan merah serta label eksplisit sesuai D-08 sumber, terpisah dari blocked yang juga merah.
- [ ] Tulis tes fetch adapter dengan fetch stub: 401/session-invalid membersihkan sesi, 403 role tidak logout, timeout tidak sukses palsu, multipart tidak menetapkan Content-Type manual, key retry commit tidak berubah.
- [ ] Jalankan dari frontend `node --test src/lib/attendance/presentation.test.mjs src/lib/attendance/api.test.mjs` dan pastikan merah sebelum implementasi.
- [ ] Implementasikan adapter memakai api existing; bila helper existing membuang error code, tambah error terstruktur secara kompatibel dan tes caller lama. Sinkronkan logout cookie/localStorage melalui mekanisme auth bersama.
- [ ] Catat override desain berdasarkan dashboard nyata. Tambahkan grup Absensi dengan permission per item; pertahankan properti adminOnly dan visibilitas menu lama.
- [ ] Gunakan referensi gambar Data Absensi untuk susunan tabel padat, filter, dan panel ringkasan setelah desain schema/API/route terkait diselaraskan. Tetap memakai shell/font/warna AMS dan tidak menambahkan Absence deduction.
- [ ] Baca permission melalui `/attendance/me`, bukan roleName AMS. Grant HR tetap independen dari izin IT; SuperAdmin melihat Akses Absensi untuk bootstrap grant, tanpa menerima akses record otomatis.
- [ ] Sesuaikan ModalShell dengan kelas wajib, focus trap/restore, touch target, dan ID unik tanpa mengubah kontrak pemakai existing.
- [ ] Daftarkan dua test baru ke script test frontend yang saat ini memiliki daftar file eksplisit; jangan menganggap file baru otomatis dijalankan.
- [ ] Jalankan `npm test`, `npm run lint`, `npx tsc --noEmit` dari frontend; periksa modal aset, karyawan, dan lisensi secara interaktif.
- [ ] Commit `feat(attendance): integrate AMS navigation and shared UI`.

## Task 7: Halaman absensi dan alur browser lengkap

**Files:** Buat page.tsx pada sebelas route spec; komponen `AttendanceEmployeeTable`, `AttendanceEmployeeFormModal`, `AttendanceDepartmentTable`, `AttendanceLocationTable`, `AttendanceAccessTable`, `AttendanceImportTable`, `AttendanceUploadModal`, `AttendanceReviewTable`, `AttendanceConflictPanel`, `AttendanceCorrectionModal`, `AttendanceRevisionHistory`, `AttendanceAuditPanel`, `AttendanceCard`, `AttendanceReportTable`, `AttendanceIdentityTable`, `AttendanceIdentityModal`, `AttendanceSourceModal` di components/attendance; hook sesuai workflow. EmployeeTable/page AMS existing tidak diubah.

**Consumes:** Adapter/permissions/visual primitives task 6 dan API task 3–5.

**Produces:** Master absensi independen, pengelolaan grant, workflow HR dari upload sampai laporan, dan REPORT_VIEWER yang hanya memakai summary.

- [ ] Implementasikan page composition tipis, komponen tabel menerima data/callback, modal memiliki draft form lokal. Buat client boundary hanya untuk interaksi.
- [ ] Hubungkan imports: upload asli, daftar/detail server, pagination review, edit/ack/conflict, commit dengan key tetap per percobaan logis.
- [ ] Bangun Master Karyawan Absensi serta departemen/lokasi miliknya; gunakan endpoint attendance saja. Aksi Lihat Absensi berada pada master absensi, bukan master AMS. Tampilkan label domain agar kedua daftar tidak membingungkan pengguna.
- [ ] Hubungkan mapping/source forms ke attendance_employees dan reconcile draft setelah pemetaan. Tambahkan form grant untuk SuperAdmin tanpa mengubah role login.
- [ ] Hubungkan kartu, koreksi, revision history, reports/CSV; gunakan endpoint summary untuk REPORT_VIEWER.
- [ ] Utamakan Total Keterlambatan dan Total Lembur per karyawan/periode, dengan satuan jam-menit dan detail harian. Durasi di atas 24 jam tidak berputar menjadi jam kalender. Tampilkan penanda merah normalisasi, audit batch, dan pilihan existing/incoming yang mempertahankan histori. Ekspor mengirim expectedDataVersion dan menangani REPORT_CHANGED dengan reload laporan.
- [ ] Implementasikan query-string filter, cancel/stale-request protection, empty/error/loading, draft-unsaved warning, read-only committed/cancelled, dan penanganan stale revision.
- [ ] Sinkronkan kontrak `node scripts/sync-attendance-contracts.mjs --check` dari root; jalankan frontend `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- [ ] Jalankan browser pada database uji: upload → mapping → review → commit → correction → CSV. Refresh saat review; batalkan koneksi setelah commit dikirim; muat ulang dan verifikasi receipt/record tunggal.
- [ ] Jalankan browser grant HR_STAFF, HR_ADMIN, REPORT_VIEWER, serta akun tanpa grant; periksa direct URL/direct API. Uji SuperAdmin dapat mengelola grant tetapi tidak membaca absensi tanpa grant.
- [ ] Periksa viewport 360/375/430/768/1024/1440, keyboard/focus, panjang nama/nomor, tabel lebar, dialog saat scroll dan reduced-motion. Simpan bukti pengujian tanpa data personal.
- [ ] Commit `feat(attendance): deliver integrated attendance pages`.

## Task 8: Migrator data lama dan latihan cutover

**Files:** Buat exporter Python, migrator service/CLI, `backend/src/services/attendanceMigration.integration.test.ts`, `scripts/tests/test_export_gajianich.py`; perbarui runbook existing `docs/operations/ams-attendance-migration.md` di AMS.

**Consumes:** Snapshot/manifest/mapping format pada [runbook](../../operations/ams-attendance-migration.md), tabel target, identity rules, legacy archive.

**Produces:** CLI `--mode dry-run|apply|verify` dengan `--input`, `--mapping`, `--report`, dan `--actor-user-id` untuk apply. Tidak tersedia sebagai endpoint publik.

- [ ] Tulis tes snapshot WAL konsisten, dataset rusak/hash mismatch, unresolved employee, legacy revision tanpa snapshot lengkap, audit actor string, duplicate apply, dan overlap dataset berbeda.
- [ ] Tulis tes target attendance kosong membuat master terpisah melalui keputusan CREATE, LINK hanya menunjuk attendance_employees, dan karyawan AMS yang bernama/kode sama tidak dibaca/dimodifikasi. Audit seluruh migrasi hanya ditulis di attendance_audit_logs.
- [ ] Jalankan root `python3 -m unittest discover -s scripts/tests -p 'test_export_gajianich.py'`; backend `npx tsx --test src/services/attendanceMigration.integration.test.ts`.
- [ ] Implementasikan export SQLite backup API read-only source → snapshot → JSONL per tabel + manifest. Dataset ID dihitung dari manifest canonical dan file checksums, tidak dari path/nama file.
- [ ] Implementasikan dry-run tanpa write ke target, apply all-or-nothing satu dataset, dan verify tanpa perubahan. Simpan completed run/mappings hanya bersama transaksi apply yang sukses; conflict membatalkan apply.
- [ ] Pertahankan payload raw/revision/audit asli. Jangan membuat before/after atau akun historis yang tidak ada di sumber.
- [ ] Uji batch legacy berhash sama: satu batch kanonis, seluruh legacy ID terpetakan, raw rows dengan row_number yang bertabrakan diberi nomor tujuan deterministik dan nomor asli tetap di arsip. Metadata yang tidak tersedia tetap null berlabel legacy.
- [ ] Latih runbook pada staging hasil restore AMS, bandingkan seluruh employee/date/status/duration dan jumlah legacy entity.
- [ ] Jalankan tes exporter/migrator, `npm run build` backend; commit `feat(attendance): add verified legacy data migration`.

## Task 9: Verifikasi rilis dan handoff operasional

**Files:** Catat hasil di `docs/operations/ams-attendance-migration.md`, sinkronkan aturan page override, dan tambahkan langkah contract-check ke script `ci` root tanpa menghapus pemeriksaan existing.

- [ ] Pastikan DATABASE_URL semua tes menunjuk database uji. Dari root AMS jalankan `node scripts/sync-attendance-contracts.mjs --check` dan `npm run ci`.
- [ ] Dari frontend jalankan `npx tsc --noEmit` secara eksplisit sesuai rules AMS.
- [ ] Jalankan tes Python exporter dari task 8; tes backend CI harus mencakup integration tests baru dan tidak skip karena DB tidak tersedia.
- [ ] Ukur parser/normalisasi 10.000 dan 50.000 baris, laporan dataset nyata yang dianonimkan, memory backend, dan respons health saat proses impor.
- [ ] Verifikasi source fixture Rust dengan `cargo test -p gajianich-core --offline` di Gajianich; ini tidak menggantikan tes target AMS.
- [ ] Jalankan kembali browser skenario task 7 terhadap candidate release dan smoke test modul existing.
- [ ] Pulihkan backup PostgreSQL ke database terpisah, jalankan verify migrator, dan cocokkan hasil audit/revisi/rekap.
- [ ] Pastikan paket rilis memakai migrasi additive; dokumentasikan cara menonaktifkan akses absensi tanpa rollback data seluruh AMS.
- [ ] Commit dokumentasi bukti verifikasi; handoff sesuai runbook release existing. Selesainya plan tidak otomatis berarti produksi sudah dipindahkan.

## Kriteria selesai keseluruhan

- [ ] Semua acceptance spec bagian 11 terpenuhi dan hasilnya tercatat.
- [ ] Tidak ada data mock/fallback sukses lokal pada alur produksi absensi.
- [ ] Master karyawan/departemen/lokasi absensi terpisah dengan seluruh FK internal attendance_*. Tidak ada lookup/join/sinkronisasi terhadap master AMS.
- [ ] Login tetap AMS yang sama; tidak ada password/token duplikat. Grant dan actor snapshot absensi terpisah, tanpa FK akun AMS.
- [ ] Seluruh data historis yang disertakan berhasil direkonsiliasi; arsip yang tidak menjadi record modern tetap dapat ditelusuri.
- [ ] Modul tampil dan berperilaku sebagai bagian dari AMS pada desktop/mobile.
- [ ] Rekap dan CSV konsisten untuk total keterlambatan/lembur per karyawan; tidak ada kalkulasi potongan ketidakhadiran atau nominal lembur.
- [ ] Cutover hanya berlangsung setelah dry-run, backup/restore rehearsal, serta kesiapan operasional pada runbook terpenuhi.
