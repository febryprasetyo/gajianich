# Spec: Pencatatan Riwayat Aktivitas HR

Tanggal: 2026-10-12  
Status: Fondasi penyimpanan (Task 1) diimplementasikan; Task 2–9 belum dijalankan  
Sumber: [TODO prioritas 05](../../todo/05-audit-aktivitas-hr.md)  
Plan: [Rencana implementasi](../plans/2026-10-12-hr-activity-audit.md)

## 1. Tujuan dan batasan

Menyediakan riwayat bersama untuk menjawab siapa mengubah data HR, kapan, melalui aksi apa, objek apa yang terdampak, dan perubahan apa yang terjadi. Riwayat harus bertahan setelah objek atau akun pelaku dihapus dan dapat dibaca dari perangkat berbeda.

Semua mutasi HR yang tersedia saat rilis harus tercakup: karyawan, departemen/lokasi yang dipakai HR, absensi manual/koreksi, impor dan review, identitas mesin, sumber absensi, shift/penugasan, penguncian, akses workspace HR, pengaturan integritas, dan pengajuan cuti. Endpoint master bersama tetap dicatat meskipun dipanggil dari menu non-HR: server mengklasifikasikan berdasarkan domain data, bukan URL halaman atau input `module` dari browser.

Tidak termasuk login/logout, pembacaan data, preview impor tanpa penyimpanan, perhitungan hari cuti, cetak/ekspor, sinkronisasi cache, audit aset/vendor/tiket, perubahan langsung oleh DBA, maupun pembangunan workflow persetujuan cuti baru. Kode aksi APPROVE/REJECT/UNLINK disiapkan sebagai kontrak; baru diwajibkan ketika mutasi terkait benar-benar tersedia. Tidak mengklaim workflow tersebut sudah ada.

## 2. Hasil pemeriksaan kode

| Bukti | Kondisi dan dampak |
|---|---|
| `frontend/src/components/attendance/AttendanceActivityPage.tsx` | Membaca `data.audit`; pencarian/paginasi lokal, belum ada filter tanggal/aksi/pelaku. |
| `frontend/src/lib/attendance/commands.ts` | Setiap command menambahkan audit memakai `data.meta.actor`, termasuk `sync_employees` yang hanya menyegarkan cache. Pelaku belum berasal dari identitas server. |
| `frontend/src/lib/attendance/repository.ts` | Workspace berasal dari localStorage/mock, lalu sebagian digabung dengan database. Hanya commit impor, absensi manual, dan pengaturan global tertentu dikirim ke server. |
| `backend/src/routes/attendanceRoutes.ts` | Mutasi yang tersedia baru `POST /commit-batch`. Koreksi, lock, shift, review, dan identitas belum memiliki persistensi server di alur ini. |
| `backend/src/controllers/employeeImportController.ts` | Sudah menulis ringkasan ke `audit_logs`, tetapi memakai fallback pelaku `1` dan tidak masuk halaman aktivitas HR. Impor karyawan bersifat atomik. |
| `backend/src/db/schema/system.ts` | `audit_logs` merupakan tabel bersama, tanpa snapshot pelaku dan tanpa jaminan append-only. FK pengguna tidak memakai kebijakan penghapusan yang mempertahankan snapshot. |
| `backend/src/routes/leaveRoutes.ts`, `backend/src/app.ts` | Router cuti dipasang pada dua alias tanpa middleware autentikasi. Identitas pemohon pada form tidak boleh dianggap identitas pengguna yang melakukan aksi. |
| `backend/src/controllers/attendanceController.ts` | Commit mengubah record dan batch dalam transaksi; audit dapat ditambahkan ke transaksi ini. Input manual menggunakan endpoint batch yang sama. |

Kesimpulan: mengganti tampilan saja tidak memenuhi TODO. Persistensi mutasi lokal merupakan dependensi wajib untuk cakupan penuh.

## 3. Pilihan arsitektur

1. **Direkomendasikan: audit HR terpisah, ditulis oleh service mutasi dalam transaksi yang sama.** Tidak mengubah kontrak audit aset. Snapshot dan aturan akses HR bisa ditegakkan secara khusus. Membutuhkan integrasi pada setiap service dan pemindahan command lokal ke server.
2. Memperluas `audit_logs` bersama: mengurangi jumlah tabel, tetapi migrasi append-only, FK, dan snapshot berisiko memengaruhi audit aset serta test cleanup yang sudah ada.
3. Mengirim log langsung dari browser: paling cepat, tetapi pelaku/hasil dapat dipalsukan dan log dapat tercatat meskipun mutasi gagal. Ditolak sebagai sumber audit resmi.

Alur pilihan: autentikasi → otorisasi command → validasi → transaksi (baca/lock kondisi awal, ubah data, tulis audit) → commit → respons → refresh UI. Tidak menyediakan endpoint publik untuk menulis audit bebas.

## 4. Terminologi dan aturan event

- **Event**: satu hasil operasi bisnis, misalnya impor satu file atau koreksi satu record.
- **Target**: objek terdampak; satu event massal dapat mempunyai banyak target.
- **Snapshot**: identitas dan nilai terpilih saat kejadian, bukan join ke nama terbaru.
- **Operation ID**: UUID dari klien untuk deduplikasi retry satu operasi; bukan identitas pelaku.
- **Outcome**: `SUCCESS`, `PARTIAL`, atau `FAILED` (FAILED hanya untuk percobaan commit impor yang valid secara struktur tetapi gagal validasi bisnis).

Kode aksi: `CREATE`, `UPDATE`, `DELETE`, `IMPORT`, `REVIEW`, `LINK`, `UNLINK`, `APPROVE`, `REJECT`, `CANCEL`, `REOPEN`, `LOCK`, `UNLOCK`, `ASSIGN`, `UNASSIGN`. Jenis entitas membedakan arti aksi; label bahasa Indonesia di UI tidak disimpan sebagai kode.

Tidak menghasilkan event untuk update tanpa perubahan, request ditolak karena auth, GET, login, atau refresh cache. Error infrastruktur ditulis ke log operasional; tidak menjadi event sukses. Satu transaksi massal menghasilkan satu event dengan detail target, bukan ribuan baris ringkasan di daftar.

## 5. Model data audit

Buat `backend/src/db/schema/hrAudit.ts` dan migrasi Drizzle baru sesuai nomor terakhir saat implementasi.

### `hr_audit_events`

| Kolom | Tipe / aturan |
|---|---|
| `id` | bigint identity PK; dikirim sebagai string dalam API |
| `occurred_at` | timestamptz NOT NULL default waktu server |
| `operation_id` | uuid NOT NULL |
| `actor_id` | bigint NOT NULL, snapshot ID tanpa FK ke users |
| `actor_username` | varchar(100) NOT NULL, snapshot dari akun server |
| `actor_name` | varchar(255) NOT NULL, nama karyawan terkait atau username |
| `action` | varchar(24), CHECK sesuai daftar kode |
| `entity_type` | varchar(40), enum aplikasi sesuai matriks cakupan |
| `entity_id` | varchar(100), nullable untuk operasi kelompok |
| `entity_label` | varchar(255) NOT NULL, kode/nama objek atau nama file |
| `outcome` | varchar(16), CHECK sesuai tiga outcome |
| `summary` | varchar(1000) NOT NULL, disusun server |
| `metadata` | jsonb NOT NULL default `{}`, allowlist per aksi |
| `schema_version` | integer NOT NULL default 1 |

Indeks `(occurred_at DESC, id DESC)`, `(actor_id, occurred_at DESC, id DESC)`, `(action, occurred_at DESC, id DESC)`, `(entity_type, entity_id)`. Event tidak mereferensikan objek bisnis dengan FK.

### `hr_audit_targets`

`id bigint identity PK`, `event_id bigint NOT NULL` FK event dengan ON DELETE RESTRICT, `entity_type varchar(40)`, `entity_id varchar(100)`, `entity_label varchar(255)`, `before jsonb nullable`, `after jsonb nullable`, `changed_fields jsonb NOT NULL` (array nama field). Indeks `(event_id,id)` dan `(entity_type,entity_id,event_id)`. Target juga tidak memiliki FK ke objek sumber.

Create: before=null. Delete: after=null dan snapshot diambil sebelum penghapusan. Update: simpan nilai field yang berubah beserta identitas. Penghapusan yang mengakibatkan cascade harus menyertakan target turunan yang benar-benar terhapus, dalam event yang sama.

### `hr_mutation_receipts`

`actor_id bigint`, `operation_id uuid`, `request_hash varchar(64)`, `response jsonb`, `created_at timestamptz`; PK `(actor_id,operation_id)`. Hash meliputi jenis operasi, target, dan payload kanonik/file hash. Receipt dan mutasi disimpan dalam transaksi yang sama. Retry key dan payload sama mengembalikan respons tersimpan; payload berbeda mengembalikan 409. Berlaku untuk mutasi baru dan endpoint lama; header opsional pada klien lama menghasilkan UUID server tanpa jaminan deduplikasi lintas request. Klien aplikasi wajib mengirim key.

### Append-only dan privasi

Pasang trigger penolak UPDATE/DELETE/TRUNCATE pada kedua tabel audit. Role runtime hanya diberi SELECT/INSERT; role migrasi terpisah. Tidak ada endpoint edit/delete atau TTL otomatis. Ini melindungi dari operasi aplikasi, bukan administrator database yang dapat mengubah trigger.

Allowlist snapshot: kode/nama karyawan, departemen/lokasi, status kerja, tanggal kerja/cuti, jam/status absensi, shift, mapping identitas, status batch/lock/grant dan nilai strict integrity. Tidak menyimpan password/token, rekening, NIK KTP, NPWP, alamat, kontak pribadi, alasan medis/cuti bebas, file mentah, atau body request penuh. Untuk perubahan field sensitif simpan nama field dalam `changed_fields`, dengan nilai `[REDACTED]`. Identitas mesin ditampilkan tersamarkan; ID internal target tetap tersedia. `metadata` dan pesan gagal tunduk pada aturan yang sama.

## 6. Matriks cakupan mutasi

| Domain / jalur saat ini | Event / integrasi |
|---|---|
| POST/PUT/DELETE `/api/v1/employees[/:id]` | employee CREATE/UPDATE/DELETE; snapshot turunan sebelum cascade |
| POST `/api/v1/employees/import/commit` | employee_import IMPORT; target karyawan dan departemen yang dibuat; pertahankan sifat atomik |
| POST/PUT/DELETE `/api/v1/master/departments` dan `/locations` | department/location CREATE/UPDATE/DELETE |
| POST `/api/v1/attendance/commit-batch`, alias `/api/attendance` | attendance_batch IMPORT; bedakan create/update target record berdasarkan kondisi DB sebelum transaksi |
| `record_attendance` | attendance_record CREATE/UPDATE, bukan IMPORT dengan nama file MANUAL_ENTRY |
| `correct` | attendance_record UPDATE, expectedRevision wajib; alasan koreksi wajib tetapi jangan menyalin teks sensitif ke ringkasan |
| `import`, `review`, `batch`, `delete_batch` | attendance_batch CREATE/REVIEW/IMPORT/CANCEL/REOPEN/DELETE; baris review menjadi target |
| `identity` | attendance_identity LINK atau UPDATE; UNLINK hanya bila alur pisah ditambahkan |
| `master` collection sources; `shift`; `assign_shift` | attendance_source CREATE/UPDATE; shift CREATE/UPDATE/DELETE; shift_assignment ASSIGN, termasuk snapshot penugasan yang terhapus bersama shift |
| `lock` | attendance_lock LOCK/UNLOCK |
| `grant`, `delete_grant` | attendance_grant CREATE/UPDATE/DELETE; bukan perubahan role global pengguna |
| `toggle_strict_integrity`, `set_strict_integrity`, PUT setting global | attendance_batch UPDATE atau hr_setting UPDATE; satu event per operasi, jangan tulis dua kali |
| POST `/api/v1/leaves/requests`, alias `/api/leaves` | leave_request CREATE; pelaku dari JWT, pemohon dari employeeId sebagai objek |
| `employee`, `master` departments/locations lokal | dialihkan ke service master yang sama; tidak membuat master bayangan |
| `sync_employees` | refresh read-only, tidak membuat event |

Endpoint vendor, preview employee import, calculate-days, dan login secara eksplisit tidak dicatat. APPROVE/REJECT cuti tidak dibuat dalam pekerjaan ini; saat workflow tersedia wajib masuk matriks dan memakai service audit yang sama.

## 7. Dependensi: persistensi command HR lokal

Bagian ini wajib selesai sebelum klaim “semua aktivitas HR tercatat”. Gunakan tabel relasional, bukan menyimpan seluruh AttendanceDataset sebagai satu JSON.

Tambahkan di `attendanceWorkspace.ts`: `attendance_sources` (MasterItem), `attendance_identities` (Identity; unik sourceId+externalNoId), `attendance_shifts` (WorkShift; code unik), `attendance_shift_assignments` (ShiftAssignment; tepat satu employeeId/departmentId, unik per target), `attendance_locks` (workDate PK + alasan + actorId + waktu), `attendance_grants` (AttendanceGrant; principalKey unik), `attendance_import_rows` (ImportRow + batchId, unik batchId+rowNumber). Field mengikuti tipe existing, ID identity dari DB; referensi entitas nyata memakai FK. grants adalah konfigurasi domain; hak memanggil endpoint tetap berasal dari RBAC server.

Perluas `attendance_batches`: status DRAFT/COMMITTED/CANCELLED tervalidasi, committedAt nullable, strictIntegrity boolean, revision integer default 1. Pindahkan validasi/reducer domain dari frontend ke implementasi backend yang tidak bergantung browser. Frontend boleh mempertahankan validasi preview, tetapi server menghitung ulang kelayakan commit, total, izin, lock, dan revisi. Jangan menerima dataset, audit, actor atau outcome dari klien.

Transaksi command mengunci batch/record/target terkait. Koreksi menggunakan expectedRevision; review dan perubahan draft menggunakan expectedBatchRevision. Konflik 409, refresh sebelum mengulang. Unique constraint menyelesaikan balapan insert. Penguncian tanggal dan penulisan record harus memakai lock transaksi per tanggal yang sama (termasuk commit-batch lama), agar lock baru tidak dilangkahi penulisan paralel. Jangan memberi ID DB dari `nextId()` browser.

`GET /api/v1/attendance/workspace` menyusun AttendanceDataset kompatibel dari DB, dengan audit kosong (riwayat memakai API tersendiri), meta actor/role dari server, tanpa mock atau merge data lokal. Data DB kosong harus tetap kosong. `POST /api/v1/attendance/commands` menerima `{ operationId, command, expectedBatchRevision? }`; command adalah union existing kecuali sync_employees dan payload actor/audit. Respons `{ operationId, changed, eventId: string|null, data: AttendanceDataset }`. Master bersama dan setting memakai service yang sama dengan endpoint lama. Maksimum 10.000 baris per draft/commit; request lebih besar ditolak 413 sebelum mutasi.

RBAC: import/review/batch/toggle batch memerlukan attendance.import atau attendance.manage; koreksi/manual/identity/source/shift/assignment/lock/grant memerlukan attendance.manage; employee mengikuti manageEmployee existing; departemen/lokasi memerlukan master.manage; setting global mengikuti guard existing. Workspace membutuhkan attendance.view. Pemeriksaan dilakukan per varian command, bukan hanya pada router.

## 8. Impor dan kegagalan

Ringkasan selalu mencakup source, filename, totalRows, succeededRows, failedRows, skippedRows, createdRows, updatedRows, dan failureReasons (kode + jumlah + maksimal 20 nomor baris per kode). Total = berhasil + gagal + dilewati. Jangan menghitung semua input sebagai insert ketika terjadi upsert.

Impor karyawan tetap all-or-nothing. Validasi bisnis gagal: succeededRows=0, failedRows=jumlah baris invalid, skippedRows=sisa yang dibatalkan, outcome FAILED. Setelah transaksi bisnis batal, simpan event percobaan gagal dan receipt dalam transaksi tersendiri; jika penyimpanan ini gagal, respons 503, jangan mengklaim audit berhasil. File tidak terbaca/struktur request invalid tidak masuk audit data.

Absensi mengikuti strict/non-strict yang sudah ada; server menghitung baris berhasil/gagal/dilewati dari draft tersimpan. Outcome PARTIAL bila ada yang berhasil dan ada yang gagal/dilewati. Preview tidak dianggap commit. Legacy commit-batch yang hanya menerima record valid mencatat hanya record yang benar-benar diterima; jangan mengarang jumlah baris sumber yang tidak dikirim. UI baru menggunakan draft server agar ringkasan seluruh sumber tersedia.

## 9. API baca dan hak akses

Permission baru `hr.audit.view`; default diberikan pada role hr_attendance dan super_admin melalui jalur wildcard. Role management/IT/report viewer tidak otomatis mendapat akses. Migrasi permission bersifat idempotent dan tidak mereset custom role.

- `GET /api/v1/hr/activities?startDate=2026-10-01&endDate=2026-10-12&action=UPDATE&actorId=12&q=EMP001&cursor=...&limit=25`
- `GET /api/v1/hr/activities/:id` → event + halaman pertama target.
- `GET /api/v1/hr/activities/:id/targets?cursor=...&limit=50` → target detail berikutnya.
- `GET /api/v1/hr/activities/actors?q=...&cursor=...&limit=25` → ID pelaku dan snapshot nama terakhir, termasuk akun yang sudah dihapus. Daftarkan route ini sebelum `/:id`.

Semua route authenticateToken + requirePermission(hr.audit.view). List `{ items: HrActivitySummary[], nextCursor: string|null }`; detail `{ event: HrActivitySummary, metadata, targets, nextTargetCursor }`. Summary berisi id, occurredAt ISO UTC, actor{id,username,name}, action, entityType, entityId, entityLabel, outcome, summary. Tidak mengirim seluruh target pada list.

Tanggal format YYYY-MM-DD valid kalender; startDate <= endDate, ditafsirkan Asia/Jakarta, inklusif untuk pengguna dan query `[awal hari, awal hari setelah endDate)`. Default 30 hari kalender termasuk hari ini. q maksimal 100 karakter, pencarian case-insensitive pada entityLabel/summary serta label target melalui EXISTS; `%`/`_` diperlakukan literal. limit 1–100, default 25 (target default 50). Cursor opaque membawa occurredAt+id dan fingerprint filter; urutan DESC stabil, filter berubah membuang cursor. ID sebagai string desimal; SQL selalu parameterized.

400 parameter/cursor invalid, 401 token tidak ada, 403 token invalid atau permission ditolak mengikuti middleware existing, 404 event tidak ada, 409 konflik mutasi/retry, 413 terlalu besar, 503 audit tidak dapat ditulis. Tidak ada POST/PATCH/DELETE untuk resource activities.

## 10. Halaman riwayat

Pertahankan URL `/dashboard/attendance/activity`, ubah judul/sidebar menjadi “Riwayat Aktivitas HR”. Route guard dan item menu memakai hr.audit.view. Halaman membaca API audit secara mandiri; kegagalan workspace absensi tidak boleh memblokir riwayat.

Kolom: waktu WIB, pelaku, aksi, objek, hasil, ringkasan. Filter tanggal, aksi, pelaku (pencarian server), kata kunci; tombol Terapkan/Reset; default 30 hari. Navigasi Sebelumnya/Berikutnya memakai cursor, tanpa total palsu. Detail menampilkan snapshot sebelum/sesudah, field disamarkan, ringkasan impor dan target berpaginasi. Tautan sumber hanya jika pengguna punya izin dan objek masih tersedia; snapshot tetap dapat dibaca jika sumber hilang.

Gunakan komponen dan gaya HR existing. Pada layar kecil filter menumpuk, tabel dapat digulir, detail tidak memotong teks. Label input, focus terlihat, navigasi keyboard, dan pengembalian focus setelah detail ditutup wajib. Bedakan loading, belum ada riwayat, filter tanpa hasil, akses ditolak, dan gagal memuat dengan tombol coba lagi. Batalkan/abaikan respons pencarian lama. Jangan menampilkan mock/cache sebagai fallback sukses.

## 11. Rollout dan kompatibilitas

1. Deploy migrasi additive + audit service; integrasikan endpoint DB existing. Tahap ini belum memenuhi cakupan penuh.
2. Migrasikan command lokal ke server, verifikasi perilaku lama, lalu alihkan repository. Deploy API sebelum frontend; alias lama memanggil service yang sama dan hanya menghasilkan satu event.
3. Sebelum cutover, inventarisasi/ekspor draft, shift, identitas dan lock lokal yang masih diperlukan. Operator memasukkan ulang melalui alur server; tidak mengimpor audit lokal sebagai bukti resmi. Jangan menghapus localStorage pengguna secara otomatis.
4. Tampilkan keterangan “Riwayat tersedia sejak aktivasi pencatatan server.” Audit historis employee import di audit_logs tidak dipindah karena tidak memiliki snapshot pelaku lengkap; tabel lama tetap disimpan. Hentikan penulisan log impor HR ganda setelah integrasi baru.
5. Tidak menjalankan seed mock. Seed hanya shift default jika belum ada, secara idempotent. Tidak melakukan purge audit otomatis; kapasitas dipantau dan retensi ditetapkan terpisah oleh pemilik data.
6. Rollback aplikasi harus menghentikan mutasi HR yang tidak lagi mampu menulis audit, bukan diam-diam mengaktifkan mutasi lokal. Migrasi audit tidak dihapus pada rollback.

## 12. Kriteria penerimaan

- Seluruh baris mutasi yang tersedia dalam matriks memiliki test pemetaan dan test transaksi.
- Gagal insert audit membatalkan perubahan bisnis; gagal bisnis tidak menghasilkan SUCCESS.
- Snapshot bertahan setelah sumber dan akun pelaku dihapus; UPDATE/DELETE/TRUNCATE audit ditolak role aplikasi.
- JWT menentukan pelaku; client actor diabaikan/ditolak. Pemohon cuti tidak tertukar dengan operator.
- Retry operasi yang sama menghasilkan satu mutasi dan satu event, termasuk dua request bersamaan.
- Impor mencatat hitungan aktual, alasan gagal aman, dan tidak mengubah perilaku atomik karyawan.
- Koreksi, review, shift, identitas, lock dan grant dapat dimuat dari perangkat lain; konflik revisi tidak menimpa data baru.
- Filter WIB, pelaku terhapus, detail massal berpaginasi, permission UI/API, respons usang, dan keadaan error diuji.
- Login, preview, calculate-days, sync cache dan no-op tidak menambah riwayat.
- Tidak ada klaim selesai hanya berdasarkan halaman baru; cutover seluruh mutasi lokal adalah gate rilis.
