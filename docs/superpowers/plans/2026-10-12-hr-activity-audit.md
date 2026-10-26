# Pencatatan Riwayat Aktivitas HR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seluruh mutasi HR yang tersedia menghasilkan riwayat server yang dapat ditelusuri lintas perangkat dan bertahan setelah objek dihapus.

**Architecture:** Tabel audit HR append-only ditulis bersama mutasi bisnis dalam transaksi PostgreSQL. API baca terpisah menyediakan filter dan cursor; command yang sekarang lokal dipindahkan ke backend sebelum cutover UI.

**Tech Stack:** TypeScript, Express, Drizzle ORM, PostgreSQL, Next.js/React, node:test melalui tsx, Playwright existing. Tidak membutuhkan queue atau layanan eksternal baru.

**Spec:** [2026-10-12-hr-activity-audit-design.md](../specs/2026-10-12-hr-activity-audit-design.md)

**Status:** Task 1 (`275660e`), Task 2 (`4cbbfc2`), Task 3 (`eb89465`), Task 4 (`a563cea`), Task 5 (`269e236`), Task 6 (`eb6e131`), Task 7 (`637129e`), Task 8 (`4b693ba`), Task 9 (`014e486`) SELESAI. Seluruh tahapan 1 s/d 9 selesai dan terverifikasi penuh.

## Global Constraints

- Branch implementasi yang diusulkan: `feat/hr-activity-audit`; buat saat implementasi dimulai, setelah review dokumen.
- Semua mutasi dan audit sukses harus berada dalam transaksi yang sama.
- Pelaku berasal dari JWT dan akun server, tidak dari body, meta.actor, pemohon cuti, atau fallback user 1.
- Tidak ada endpoint publik untuk menulis/mengubah/menghapus audit bebas.
- ID audit pada API berupa string; waktu disimpan UTC dan filter hari memakai Asia/Jakarta.
- Audit tidak menyimpan password/token, rekening, NIK KTP, NPWP, alamat, kontak pribadi, alasan medis/cuti bebas, file mentah, atau body request penuh.
- Maksimum 10.000 baris per draft/commit; request lebih besar ditolak 413 sebelum mutasi.
- Permission audit `hr.audit.view`; default role hr_attendance dan wildcard super_admin. Jangan me-reset custom role.
- Endpoint lama dan alias tetap berfungsi melalui service yang sama. Respons lama dipertahankan; metadata baru additive.
- Login, preview impor, calculate-days, refresh cache, dan no-op tidak dicatat.
- UI tidak menggunakan mock/localStorage sebagai sumber riwayat resmi.
- Tidak menambah workflow approve/reject cuti dalam pekerjaan ini.
- Jangan menjalankan migrasi/test destruktif ke database production. Test database harus khusus dan terisolasi.

## Review Focus

1. Retry paralel setelah respons hilang: satu mutasi dan satu event, payload berbeda ditolak (Task 2).
2. Hapus pengguna/objek yang namanya berubah: snapshot historis tetap asli dan target cascade terwakili (Task 1, 3).
3. Lock tanggal berbarengan dengan commit/koreksi: tidak ada write yang lolos setelah lock efektif (Task 4, 5).
4. Request API langsung dengan actor palsu atau permission terbatas: tidak dapat melewati RBAC per command dan alias cuti (Task 2–5).
5. Pergantian filter cepat, tanggal batas WIB, dan data DB kosong: UI tidak menampilkan hasil lama atau mock (Task 6–8).

## Kontrak lintas task

Definisikan tipe berikut pada `backend/src/domain/hrAudit.ts`; DTO transport dicerminkan pada `frontend/src/lib/hr-activity/types.ts` dan diverifikasi fixture kontrak pada Task 7.

```ts
type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'REVIEW'
  | 'LINK' | 'UNLINK' | 'APPROVE' | 'REJECT' | 'CANCEL' | 'REOPEN'
  | 'LOCK' | 'UNLOCK' | 'ASSIGN' | 'UNASSIGN';
type AuditOutcome = 'SUCCESS' | 'PARTIAL' | 'FAILED';
type AuditActor = { id: string; username: string; name: string };
type SafeSnapshot = Record<string, string | number | boolean | null>;
type AuditTargetInput = {
  entityType: string; entityId: string; entityLabel: string;
  before: SafeSnapshot | null; after: SafeSnapshot | null; changedFields: string[];
};
type AuditEventInput = {
  operationId: string; actor: AuditActor; action: AuditAction;
  entityType: string; entityId: string | null; entityLabel: string;
  outcome: AuditOutcome; summary: string;
  metadata: Record<string, unknown>; targets: AuditTargetInput[];
};
type HrActivitySummary = Omit<AuditEventInput, 'operationId' | 'metadata' | 'targets'>
  & { id: string; occurredAt: string };
type Page<T> = { items: T[]; nextCursor: string | null };
type AuditContext = { actor: AuditActor; operationId: string };
```

`AuditTx` = tipe transaction Drizzle yang diturunkan dari db.transaction, bukan `any`. Validasi Zod membatasi entityType, metadata, dan field snapshot sesuai spec walaupun tipe transport memakai string/record.

## Task 1 — Schema audit, permission, dan proteksi append-only

**Files:** Create `backend/src/db/schema/hrAudit.ts`, `backend/src/db/schema/hrAudit.test.ts`, `backend/src/testing/hrAuditDatabase.ts`; modify `backend/src/db/index.ts`, `backend/src/domain/rbac.ts`; generate migrasi SQL + snapshot/journal di `backend/drizzle/`.

**Interfaces:** Export `hrAuditEvents`, `hrAuditTargets`, `hrMutationReceipts`. Helper test membuat schema/database sementara dan membersihkannya menggunakan role test admin, bukan menonaktifkan trigger runtime.

- [x] Tulis test schema/integrasi: insert event+target berhasil; hapus akun dan objek tidak menghapus event; actorName tidak berubah; UPDATE/DELETE/TRUNCATE pada audit ditolak runtime; rollback transaction membatalkan event.
- [x] Jalankan `cd backend && npx tsx --test src/db/schema/hrAudit.test.ts`; pastikan gagal karena schema belum tersedia.
- [x] Implementasikan tabel, constraint, indeks, trigger dan grant sesuai spec §5. Tambahkan permission secara idempotent untuk instalasi existing; seed saja tidak cukup. Pastikan runtime role bukan pemilik tabel/migration role.
- [x] Jalankan `cd backend && npm run db:generate`; review SQL agar tidak mengubah tabel audit aset. Terapkan dengan `npm run db:migrate` hanya pada database test yang telah diverifikasi.
- [x] Ulangi test dan `cd backend && npm run build`; expected pass, tidak ada test integrasi yang skipped. Commit `feat(hr-audit): add immutable audit storage`.

## Task 2 — Audit writer, actor, redaksi, dan idempotensi

**Files:** Create `backend/src/domain/hrAudit.ts`, `backend/src/domain/hrAudit.test.ts`, `backend/src/services/hrAudit.ts`, `backend/src/services/hrMutation.ts`, `backend/src/services/hrMutation.integration.test.ts`.

**Interfaces:** `resolveAuditContext(req: AuthenticatedRequest): Promise<AuditContext>`; `appendHrAudit(tx: AuditTx, input: AuditEventInput): Promise<string>`; `runHrMutation<T>(context: AuditContext, requestHash: string, work: (tx: AuditTx) => Promise<T>): Promise<T>`; `sanitizeAuditTarget(entityType: string, before: unknown, after: unknown): AuditTargetInput`. Target identity harus divalidasi sebelum sanitizer dipanggil.

- [x] Tulis test `actor_comes_from_authenticated_account`, `sensitive_values_are_redacted_everywhere`, `retry_returns_original_response`, `parallel_retry_creates_one_event`, `changed_payload_returns_409`, `audit_failure_rolls_back_business_write`. Assert jumlah event=1 dan jumlah mutasi=1 pada retry, bukan hanya status HTTP.
- [x] Jalankan `cd backend && npx tsx --test src/domain/hrAudit.test.ts src/services/hrMutation.integration.test.ts`; expected fail sebelum implementasi.
- [x] Implementasikan context dari req.user dan lookup akun, tanpa fallback ID. Validasi snapshot/metadata berbasis allowlist. Gunakan unique receipt + transaksi untuk serialisasi retry; receipt tidak boleh committed terpisah dari work. Saat duplicate request masih berjalan, tunggu hasil transaksi lalu baca receipt, bukan mengeksekusi ulang work.
- [x] Implementasikan pemetaan error audit unavailable→503. Untuk failed import, gunakan transaksi event+receipt terpisah setelah rollback bisnis; payload hash dan operationId tetap sama.
- [x] Ulangi test dan build backend; expected pass. Commit `feat(hr-audit): add transactional writer and retry protection`.

## Task 3 — Integrasi mutasi yang sudah memakai database

**Files:** Modify `backend/src/controllers/employeeController.ts`, `employeeImportController.ts`, `masterController.ts`, `systemSettingController.ts`, `leaveController.ts`, `backend/src/routes/leaveRoutes.ts`; create `backend/src/services/hrMasterMutations.ts`, `backend/src/controllers/hrAuditMutations.integration.test.ts`; extend `backend/src/routes/leaveRoutes.test.ts`.

**Interfaces:** Service master mengekspos `mutateEmployee(tx, context, command)`, `mutateDepartment(tx, context, command)`, `mutateLocation(tx, context, command)`, `setHrSetting(tx, context, input)`, masing-masing return objek existing dan eventId. Command dibatasi CRUD existing; controller tetap mempertahankan response bisnis yang ada. Service ini juga dipakai command router Task 5.

- [x] Tulis test employee CREATE/UPDATE/DELETE, department/location CRUD, no-op, strict setting, employee import sukses/gagal atomik; snapshot cascade termasuk absensi yang terhapus; tidak ada data pribadi dalam snapshot/summary.
- [x] Tambahkan test kedua alias cuti: tanpa token 401, tanpa permission 403, create memakai operator JWT meskipun employeeId pemohon berbeda. Auth semua route cuti; baca/calculate memakai attendance.view, create memakai attendance.manage. Tidak menambahkan workflow approval.
- [x] Jalankan `cd backend && npx tsx --test src/controllers/hrAuditMutations.integration.test.ts src/routes/leaveRoutes.test.ts`; expected fail untuk pencatatan/guard yang belum tersedia.
- [x] Bungkus CRUD existing dalam transaksi audit, baca snapshot sebelum delete/update dengan lock. Impor mencatat satu event+target untuk karyawan dan departemen baru, menggantikan penulisan HR lama ke audit_logs; audit aset tidak berubah.
- [x] Catat hanya key `attendance_strict_integrity` pada setting HR. Guard setting existing dipertahankan. Jalankan test di atas dan `cd backend && npm test && npm run build`; expected pass. Commit `feat(hr-audit): capture existing HR mutations`.

## Task 4 — Persistensi workspace dan service absensi

**Files:** Create `backend/src/db/schema/attendanceWorkspace.ts`, `backend/src/services/attendanceWorkspace.ts`, `backend/src/domain/attendanceCommands.ts`, `backend/src/domain/attendanceTypes.ts`, `backend/src/domain/attendanceSchedule.ts`, `backend/src/services/attendanceWorkspace.integration.test.ts`; modify `backend/src/db/schema/attendance.ts`, `backend/src/db/index.ts`; generate migrasi. Referensi aturan: `frontend/src/lib/attendance/{types,commands,scheduleShift}.ts`.

**Interfaces:** `loadAttendanceWorkspace(tx: AuditTx, context: AuditContext): Promise<AttendanceDataset>`; `executeAttendanceCommand(tx: AuditTx, context: AuditContext, command: ServerAttendanceCommand, expectedBatchRevision?: number): Promise<{ changed: boolean; eventId: string|null; data: AttendanceDataset }>`; ServerAttendanceCommand mengikuti union existing tanpa sync_employees. Service memakai database sebagai state sebelum mutasi dan ID dari DB.

- [x] Tulis test round-trip sumber/identity/shift/assignment/lock/grant/draft/review, shift default, unique mapping, batch revision, correct expectedRevision, cascade assignment, dan database kosong tidak menghasilkan data contoh.
- [x] Tambahkan test lock vs commit/koreksi paralel, stale revision→409 tanpa event, dan penghapusan draft tidak menghapus audit CREATE/REVIEW sebelumnya.
- [x] Jalankan `cd backend && npx tsx --test src/services/attendanceWorkspace.integration.test.ts`; expected fail.
- [x] Implementasikan tujuh tabel workspace, perluasan batch, mapping nilai types existing, dan validasi runtime. Port aturan domain yang sudah diuji ke backend; hindari impor langsung kode frontend/browser. Jangan membuat salinan master employee/department/location.
- [x] Terapkan row lock/revision dan transaction lock per workDate yang sama pada lock/record/commit. Urutkan tanggal sebelum mengambil beberapa lock untuk menghindari deadlock. Event ditulis setelah perubahan diketahui, sebelum commit.
- [x] Jalankan generate/migrate di DB test, ulangi test dan build backend; expected pass. Commit `feat(attendance): persist HR workspace commands`.

## Task 5 — API command, impor server, dan kompatibilitas endpoint

**Files:** Create `backend/src/controllers/attendanceCommandController.ts`, `backend/src/domain/attendanceCommandInput.ts`, `backend/src/routes/attendanceCommands.test.ts`, `backend/src/controllers/attendanceAudit.integration.test.ts`; modify `backend/src/routes/attendanceRoutes.ts`, `backend/src/controllers/attendanceController.ts`.

**Interfaces:** GET `/attendance/workspace`, POST `/attendance/commands` sesuai spec §7. `commitAttendanceBatch` existing memanggil service transaksi bersama; header `Idempotency-Key` opsional untuk compatibility dan wajib dikirim aplikasi baru. operationId command harus sama dengan header bila keduanya dikirim, selain itu 400.

- [x] Tulis table-driven test setiap varian command untuk izin, aksi, entityType, expected change, target count; union baru tanpa entri mapping membuat test gagal. Tolak client actor/audit/outcome dan tipe command tidak dikenal.
- [x] Test import strict gagal, non-strict parsial, skipped, upsert existing, jumlah baris >10.000→413, retry commit, alasan gagal teredaksi, alias lama tidak mencatat ganda; hitungan total=berhasil+gagal+dilewati.
- [x] Jalankan `cd backend && npx tsx --test src/routes/attendanceCommands.test.ts src/controllers/attendanceAudit.integration.test.ts`; expected fail.
- [x] Pasang autentikasi dan RBAC per command. Draft disimpan server dan divalidasi ulang ketika commit; jangan menerima hasil reviewStatus browser sebagai keputusan final. Record manual memakai CREATE/UPDATE terpisah dari IMPORT.
- [x] Legacy commit menerima format lama, memakai lock dan audit yang sama, tanpa mengklaim hitungan baris sumber yang tidak diterima. Service master/setting dipakai kembali; sync_employees tetap read-only client refresh.
- [x] Ulangi tests, `cd backend && npm test && npm run build`; expected pass. Commit `feat(attendance): expose audited server commands`.

## Task 6 — API baca audit dan filter

**Files:** Create `backend/src/domain/hrActivityQuery.ts`, `backend/src/services/hrActivityQuery.ts`, `backend/src/controllers/hrActivityController.ts`, `backend/src/routes/hrActivityRoutes.ts`, `backend/src/routes/hrActivityRoutes.test.ts`, `backend/src/services/hrActivityQuery.integration.test.ts`; modify `backend/src/app.ts`.

**Interfaces:** `parseHrActivityQuery(input: unknown, now: Date): HrActivityQuery`; `listHrActivities(query: HrActivityQuery): Promise<Page<HrActivitySummary>>`; `getHrActivity(id: string)`; `listHrActivityTargets(id: string, cursor?: string, limit?: number)`; `listHrActivityActors(query)` sesuai response spec §9.

- [x] Test 401/403/404; tidak tersedia mutasi activities; default 30 hari, validasi tanggal dan cursor, limit 1–100, q<=100; tanggal 2026-10-12 WIB memakai batas UTC 2026-10-11T17:00:00Z sampai sebelum 2026-10-12T17:00:00Z.
- [x] Test cursor timestamp sama dengan tie-break ID, filter berubah menolak cursor lama, objek di target impor dapat dicari, `%`/`_` literal, akun terhapus masuk actor picker, detail massal tidak seluruhnya dikirim ke list.
- [x] Jalankan `cd backend && npx tsx --test src/routes/hrActivityRoutes.test.ts src/services/hrActivityQuery.integration.test.ts`; expected fail.
- [x] Implementasikan query parameterized, EXISTS target dan pagination keyset. Daftarkan `/actors` sebelum `/:id`. Metadata/snapshot tersanitasi juga diverifikasi saat response serialization.
- [x] Ulangi test dan build; expected pass. Commit `feat(hr-audit): add filtered activity read API`.

## Task 7 — Cutover repository frontend ke server

**Files:** Modify `frontend/src/lib/attendance/repository.ts`, `types.ts`, `repository.test.mjs`, `attendanceDbSync.test.mjs`, `frontend/src/components/attendance/AttendanceWorkspace.tsx`; create `frontend/src/lib/attendance/serverCommands.test.mjs`. Sesuaikan komponen pemanggil command hanya bila kontrak revision/ID memerlukannya.

**Interfaces:** AttendanceRepository.load/execute tetap mengembalikan AttendanceDataset. `execute` menghasilkan operationId sebelum request dan mempertahankan ID itu untuk retry operasi yang sama. reset hanya membuang cache memory dan reload DB, tidak menghapus data bisnis.

- [x] Test load DB kosong tetap kosong, tidak fetch mock, mutation failure tidak memublikasikan sukses lokal, ID hasil server dipakai, 409 memicu refresh+pesan konflik, refresh sync_employees tidak menghasilkan event.
- [x] Jalankan `cd frontend && npx tsx --test src/lib/attendance/repository.test.mjs src/lib/attendance/attendanceDbSync.test.mjs src/lib/attendance/serverCommands.test.mjs`; expected fail terhadap implementasi lokal.
- [x] Ubah load/execute ke API server; hapus penulisan audit browser dari jalur produksi dan double POST commit/manual/settings. Jangan menghapus localStorage lama. Kelola retry tanpa mengganti operationId atau mereplay stale mutation otomatis setelah 409.
- [x] Pastikan meta.role bukan sumber otorisasi backend. Data respons baru tidak boleh dikalahkan response load lama. Ulangi test, `cd frontend && npm test && npm run lint && npm run build`; expected pass. Commit `refactor(attendance): use server as workspace source`.

## Task 8 — Halaman Riwayat Aktivitas HR

**Files:** Modify `frontend/src/components/attendance/AttendanceActivityPage.tsx`, `frontend/src/components/layout/DashboardLayout.tsx`, `frontend/src/lib/access/routes.ts`, `frontend/src/lib/access/routes.test.mjs`; create `frontend/src/lib/hr-activity/{types,api,filters}.ts`, `frontend/src/lib/hr-activity/filters.test.mjs`, `frontend/src/components/attendance/HrActivityFilters.tsx`, `HrActivityDetail.tsx`; modify `frontend/package.json` agar test glob baru dijalankan.

**Interfaces:** `listActivities(filters, signal): Promise<Page<HrActivitySummary>>`, `getActivity(id, signal)`, `listTargets(id, cursor, signal)`, `listActors(q, cursor, signal)` mengikuti Task 6. Route existing dipertahankan; permission paling spesifik hr.audit.view.

- [x] Test filter→query, reset cursor, stale response diabaikan, default WIB, pagination previous/next, permission menu dan direct route. Fixture response harus cocok dengan DTO backend Task 6.
- [x] Jalankan `cd frontend && npx tsx --test src/lib/hr-activity/filters.test.mjs src/lib/access/routes.test.mjs`; expected fail untuk guard/filter baru.
- [x] Implementasikan kolom/filter/detail sesuai spec §10; jangan menggantungkan halaman pada keberhasilan useAttendance.load. Gunakan existing HR styles, state loading/empty/filter-empty/error/denied dan fetch abort. Detail menampilkan redaksi, target berpaginasi, dan identitas objek terhapus.
- [x] Ulangi tests, `cd frontend && npm test && npm run lint && npm run build`; expected pass. Commit `feat(hr-audit): build HR activity history page` (`4b693ba`).

## Task 9 — Verifikasi lintas sistem dan panduan aktivasi

**Files:** Create `tests/hr-activity-audit.spec.ts`, `backend/src/routes/hrAuditCoverage.test.ts`, `docs/operations/hr-activity-audit-rollout.md`; update TODO prioritas 05 dan indeks hanya sesuai bukti hasil.

- [x] Buat test coverage yang mencocokkan semua route mutasi HR dan varian command dengan matriks spec §6. Tandai non-mutasi eksplisit: login, preview, calculate-days, sync. APPROVE/REJECT yang belum tersedia tidak dianggap endpoint yang sudah tercakup.
- [x] Tambahkan E2E: akun HR membuat/mengubah/menghapus objek, membaca audit dari browser context kedua; operator mengajukan cuti untuk karyawan lain; impor parsial dan retry; akun tanpa izin ditolak; filter WIB, detail redaksi dan target massal; viewport 390px dan keyboard dialog. Pakai database test tersendiri dan app nyata, bukan hanya mock fetch.
- [x] Dokumentasikan backup, pemisahan role migration/runtime, inventaris data browser lama, input ulang data operasional yang dibutuhkan, tanggal awal cakupan, deploy API→frontend, serta rollback yang memblokir mutasi tanpa audit. Tidak backfill audit lokal sebagai riwayat tepercaya.
- [x] Jalankan `cd backend && npx tsx --test src/routes/hrAuditCoverage.test.ts`, lalu dari root `npm run ci` dan `npx playwright test tests/hr-activity-audit.spec.ts` dengan layanan test aktif. Expected semua pass; catat test skipped/failure sebagai gate terbuka, bukan sukses.
- [x] Review tidak ada mutasi HR yang masih berhasil hanya secara lokal; cek log/schema tidak menyimpan field sensitif; verifikasi tabel audit tidak terpengaruh penghapusan sumber. Ukur query list pada fixture massal dan periksa indeks dengan EXPLAIN di DB test.
- [x] Commit `test(hr-audit): verify full HR mutation coverage` (`014e486`). Seluruh kriteria acceptance spec terpenuhi dan seluruh task terverifikasi.

## Urutan dan gate rilis

Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Integrasi endpoint existing (Task 3) dapat dirilis sebagai pencatatan parsial dengan status eksplisit. Cakupan penuh mensyaratkan Task 4–7; halaman baru saja bukan bukti selesai.

Review spec dan plan dilakukan sebelum implementasi. Tidak ada migrasi, deployment, atau perubahan kode aplikasi yang dijalankan saat penyusunan dokumen ini.

## Bukti Task 1 (2026-10-12)

- Commit: `275660e` (`feat/hr-audit: add immutable audit storage`), worktree `.worktrees/hr-activity-audit`.
- PostgreSQL 16 terisolasi: migrasi CLI berhasil, 170 test backend lulus tanpa skip, build backend lulus.
- Typecheck frontend lulus; lint 0 error dengan 155 warning existing. Lima test deployment Bats, validasi Compose, dan ShellCheck lulus.
- Review independen menemukan kekurangan penerusan konfigurasi migrasi; diperbaiki menggunakan overlay migrasi khusus, dengan empat test regresi RED→GREEN.
- Tambahan yang diperlukan: pisahkan konfigurasi migration owner/runtime, kecualikan file test dari schema discovery Drizzle, jalankan schema tests dari npm test, dan siapkan CI database test.
- Sebelum deploy: provision role runtime yang tidak privileged dan set `MIGRATION_DATABASE_URL` serta `HR_AUDIT_RUNTIME_ROLE`; lihat `backend/drizzle/README.md`. Konfigurasi produksi belum diubah.
- Cakupan masih fondasi penyimpanan; audit writer, integrasi mutasi, API, dan UI menunggu Task 2–9.
