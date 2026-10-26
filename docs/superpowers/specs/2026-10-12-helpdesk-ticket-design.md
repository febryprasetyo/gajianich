# Spec: Sistem Tiket Helpdesk IT

Tanggal: 2026-10-12  
Status: Draft — menunggu review  
Sumber: [TODO prioritas 06](../../todo/06-helpdesk-tiket-it.md)  
Plan: [Rencana implementasi](../plans/2026-10-12-helpdesk-ticket.md)

---

## 1. Tujuan dan Batasan

Menyediakan sistem pencatatan permintaan layanan (helpdesk ticket) yang memungkinkan staf IT atau HR/GA mencatat tiket **atas nama karyawan** yang melapor, tanpa mengharuskan karyawan tersebut memiliki akun aplikasi. Sistem ini harus menjaga tiga identitas secara terpisah — pelapor, pembuat tiket, dan penanggungjawab — serta mampu mengukur SLA dari waktu laporan diterima, bukan waktu tiket dicatat.

**Goals (harus dicapai di tahap ini):**
- Tiket dapat dibuat oleh pengguna aplikasi (IT/HR/GA) atas nama karyawan pelapor.
- Pelapor diambil dari direktori karyawan HR (tabel `employees`) — tidak wajib punya akun login.
- Tiga identitas dicatat secara eksplisit: `requester`, `created_by`, `assigned_to`.
- Sumber laporan dan waktu laporan diterima dicatat dan dapat diubah (dengan audit trail).
- SLA dihitung dari `reported_at`, bukan `created_at`.
- Pekerjaan IT internal (temuan proaktif) dipisahkan dari laporan karyawan.
- Feedback/kepuasan yang dicatat staf diberi label eksplisit, bukan disamakan dengan survei mandiri karyawan.

**Non-Goals (tidak dikerjakan tahap ini):**
- Portal karyawan mandiri untuk submit tiket.
- Integrasi email/WhatsApp otomatis.
- Approval workflow bertahap.
- Survei kepuasan yang dikirim ke karyawan.
- SLA enforcement otomatis (escalation, notifikasi).
- Knowledge base / artikel solusi.

---

## 2. Tiga Identitas Tiket

| Field | Makna | Sumber Data | Wajib |
|---|---|---|---|
| `requester_employee_id` | Karyawan yang meminta bantuan | Tabel `employees` | Ya |
| `requester_name_snapshot` | Nama karyawan saat tiket dibuat | Snapshot dari `employees` | Ya (otomatis) |
| `requester_department_snapshot` | Departemen karyawan saat tiket dibuat | Snapshot dari `employees` | Ya (otomatis) |
| `created_by_user_id` | Pengguna aplikasi yang mencatat tiket | JWT / `users` | Ya (dari server) |
| `created_by_name_snapshot` | Nama pembuat saat tiket dicatat | Snapshot dari `users` | Ya (otomatis) |
| `assigned_to_user_id` | Pengguna yang ditugaskan mengerjakan | FK ke `users`, nullable | Tidak |
| `assigned_to_name_snapshot` | Nama petugas saat ditugaskan | Snapshot saat assignment | Tidak |

**Aturan identitas:**
- `created_by` selalu berasal dari JWT; tidak dapat diisi atau diubah oleh klien.
- `requester` dapat berbeda dari `created_by` — ini adalah fitur inti.
- `assigned_to` dapat berubah sepanjang waktu; setiap perubahan masuk audit trail.
- Snapshot nama disimpan agar histori tetap akurat meskipun karyawan/akun dihapus.
- Karyawan yang belum ada di `employees` tidak dapat menjadi requester (validasi server).

---

## 3. Model Data

### `helpdesk_tickets`

| Kolom | Tipe / Aturan |
|---|---|
| `id` | bigint identity PK |
| `ticket_number` | varchar(20) NOT NULL UNIQUE — format `TKT-YYYYMM-NNNN` |
| `title` | varchar(255) NOT NULL |
| `description` | text NOT NULL |
| `status` | varchar(20) NOT NULL — `OPEN`, `IN_PROGRESS`, `PENDING`, `RESOLVED`, `CLOSED` |
| `priority` | varchar(10) NOT NULL — `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `category` | varchar(40) NOT NULL — `HARDWARE`, `SOFTWARE`, `NETWORK`, `ACCESS`, `PRINTER`, `PERIPHERAL`, `OTHER` |
| `origin` | varchar(20) NOT NULL — `WHATSAPP`, `PHONE`, `EMAIL`, `WALK_IN`, `INTERNAL_FINDING` |
| `reported_at` | timestamptz NOT NULL — waktu karyawan pertama melapor (dapat diisi mundur, wajib <= `created_at`) |
| `created_at` | timestamptz NOT NULL default now() — waktu tiket dicatat sistem |
| `updated_at` | timestamptz NOT NULL default now() |
| `resolved_at` | timestamptz nullable — diisi saat status RESOLVED/CLOSED |
| `requester_employee_id` | bigint NOT NULL — FK ke `employees` tanpa ON DELETE CASCADE |
| `requester_name_snapshot` | varchar(255) NOT NULL |
| `requester_department_snapshot` | varchar(255) NOT NULL |
| `created_by_user_id` | bigint NOT NULL — snapshot ID, tanpa FK aktif (append-only ref) |
| `created_by_name_snapshot` | varchar(255) NOT NULL |
| `assigned_to_user_id` | bigint nullable — FK ke `users`, nullable |
| `assigned_to_name_snapshot` | varchar(255) nullable |
| `affected_asset_id` | bigint nullable — FK ke `assets`, nullable |
| `affected_asset_label` | varchar(255) nullable — snapshot nama aset |
| `affected_employee_id` | bigint nullable — FK ke `employees`, nullable |
| `affected_employee_label` | varchar(255) nullable — snapshot nama karyawan terdampak |
| `resolution_note` | text nullable |
| `resolution_confirmed_by` | varchar(100) nullable |
| `resolution_confirmed_at` | timestamptz nullable |
| `resolution_confirmation_channel` | varchar(20) nullable — `WHATSAPP`, `PHONE`, `EMAIL`, `WALK_IN`, `SYSTEM` |
| `feedback_score` | integer nullable — 1–5, diisi staf |
| `feedback_note` | text nullable |
| `feedback_source` | varchar(20) nullable — selalu `STAFF_RECORDED` untuk tahap ini |
| `report_evidence` | text nullable — ringkasan percakapan atau catatan bukti laporan (max 2000 char) |
| `is_internal` | boolean NOT NULL default false — true = temuan proaktif IT |
| `sla_response_minutes` | integer nullable — target waktu respons pertama |
| `first_response_at` | timestamptz nullable — waktu pertama staf IT merespons |

Indeks: `(status, created_at DESC)`, `(requester_employee_id, created_at DESC)`, `(assigned_to_user_id, status)`, `(reported_at DESC)`, `(ticket_number)`.

### `helpdesk_ticket_comments`

| Kolom | Tipe / Aturan |
|---|---|
| `id` | bigint identity PK |
| `ticket_id` | bigint NOT NULL FK `helpdesk_tickets` ON DELETE RESTRICT |
| `author_user_id` | bigint NOT NULL snapshot |
| `author_name_snapshot` | varchar(255) NOT NULL |
| `body` | text NOT NULL |
| `is_internal_note` | boolean NOT NULL default false |
| `created_at` | timestamptz NOT NULL default now() |

### `helpdesk_ticket_audit`

| Kolom | Tipe / Aturan |
|---|---|
| `id` | bigint identity PK |
| `ticket_id` | bigint NOT NULL FK `helpdesk_tickets` ON DELETE RESTRICT |
| `actor_user_id` | bigint NOT NULL snapshot |
| `actor_name_snapshot` | varchar(255) NOT NULL |
| `action` | varchar(40) NOT NULL — `CREATE`, `UPDATE`, `ASSIGN`, `STATUS_CHANGE`, `COMMENT`, `RESOLVE`, `CLOSE`, `REOPEN` |
| `field_changed` | varchar(100) nullable |
| `old_value` | text nullable |
| `new_value` | text nullable |
| `note` | varchar(500) nullable |
| `occurred_at` | timestamptz NOT NULL default now() |

Append-only; trigger DB memblokir UPDATE/DELETE/TRUNCATE dari role runtime.

### `helpdesk_attachments`

| Kolom | Tipe / Aturan |
|---|---|
| `id` | bigint identity PK |
| `ticket_id` | bigint NOT NULL FK `helpdesk_tickets` ON DELETE RESTRICT |
| `filename` | varchar(255) NOT NULL — nama tampilan, bukan path |
| `storage_path` | varchar(500) NOT NULL |
| `mime_type` | varchar(100) NOT NULL |
| `size_bytes` | integer NOT NULL |
| `uploaded_by_user_id` | bigint NOT NULL snapshot |
| `uploaded_at` | timestamptz NOT NULL default now() |

---

## 4. Nomor Tiket

Format: `TKT-YYYYMM-NNNN` (contoh: `TKT-202610-0001`).  
Urutan NNNN per bulan. Digenerate server saat INSERT; tidak dapat diubah klien.

---

## 5. SLA dan Pengukuran KPI

- **`reported_at`** — waktu laporan diterima dari karyawan. Default `now()` di UI, dapat diubah mundur (tidak boleh melebihi `created_at`). Perubahan dicatat di audit trail, wajib permission `helpdesk.admin`.
- **`created_at`** — timestamp sistem; tidak dapat diubah.
- **SLA dihitung dari `reported_at`**, bukan `created_at`.
- Selisih `created_at - reported_at` tersimpan untuk laporan keterlambatan pencatatan.
- `first_response_at` diisi otomatis saat komentar publik pertama dari staf IT ditambahkan.
- Tiket `is_internal = true` **tidak dihitung** dalam metrik layanan karyawan.
- `feedback_source = STAFF_RECORDED` harus ditampilkan di laporan secara eksplisit.

---

## 6. Status dan Transisi

```
OPEN → IN_PROGRESS → PENDING → RESOLVED → CLOSED
OPEN → IN_PROGRESS → RESOLVED → CLOSED
OPEN → CLOSED
RESOLVED → OPEN  (dibuka ulang)
CLOSED → OPEN    (dengan justifikasi, butuh helpdesk.admin)
```

Transisi tidak valid ditolak server; setiap transisi dicatat di audit trail.

---

## 7. API Endpoints

| Method | Path | Permission | Deskripsi |
|---|---|---|---|
| `POST` | `/api/v1/helpdesk/tickets` | `helpdesk.manage` | Buat tiket |
| `GET` | `/api/v1/helpdesk/tickets` | `helpdesk.view` | List tiket |
| `GET` | `/api/v1/helpdesk/tickets/:id` | `helpdesk.view` | Detail tiket |
| `PATCH` | `/api/v1/helpdesk/tickets/:id` | `helpdesk.manage` | Update tiket |
| `POST` | `/api/v1/helpdesk/tickets/:id/comments` | `helpdesk.manage` | Tambah komentar |
| `GET` | `/api/v1/helpdesk/tickets/:id/audit` | `helpdesk.manage` | Riwayat tiket |
| `POST` | `/api/v1/helpdesk/tickets/:id/attachments` | `helpdesk.manage` | Upload lampiran |
| `GET` | `/api/v1/helpdesk/employees?q=...` | `helpdesk.manage` | Cari requester |
| `GET` | `/api/v1/helpdesk/assignees?q=...` | `helpdesk.manage` | Cari assignee |

Request POST tidak boleh menyertakan `created_by`, `ticket_number`, `created_at`, atau field snapshot apapun.

---

## 8. Permission RBAC

| Permission | Deskripsi | Default Role |
|---|---|---|
| `helpdesk.manage` | Buat, update, assign, comment, resolve, close | `it_support`, `super_admin` |
| `helpdesk.view` | Lihat tiket dan laporan | `it_support`, `super_admin`, `hr_attendance` |
| `helpdesk.admin` | Reopen closed, ubah `reported_at`, ubah `is_internal` | `super_admin` |

---

## 9. Frontend — Halaman Tiket

**List** (`/dashboard/helpdesk/tickets`): nomor, judul, status badge, prioritas, requester (nama + dept), pembuat, penanggungjawab, origin, waktu laporan. Filter lengkap. Tombol buat tiket.

**Form Buat Tiket**: search requester (autocomplete karyawan), sumber laporan, waktu laporan diterima (datetime, default sekarang), aset/karyawan terdampak (opsional), pembuat otomatis dari sesi (read-only), toggle internal.

**Detail Tiket**: tiga identitas berdampingan, dua timestamp (laporan + pencatatan) + selisih, komentar berurutan, tab audit trail, actions (assign, status, komentar, resolve, close).

---

## 10. Keamanan dan Integritas

- `created_by` hanya dari JWT; tidak pernah dari body request.
- `reported_at` tidak boleh melebihi `created_at`; validasi server.
- Perubahan `reported_at` wajib izin `helpdesk.admin` dan dicatat audit trail.
- `helpdesk_ticket_audit` append-only; trigger DB memblokir modifikasi runtime.
- Upload lampiran: validasi MIME dan ukuran (maks 10 MB/file).
- Tidak ada endpoint DELETE tiket di tahap ini.

---

## 11. Kriteria Penerimaan

- [ ] Tiket dapat dibuat IT atas nama karyawan HR tanpa karyawan punya akun aplikasi.
- [ ] Tiga identitas (`requester`, `created_by`, `assigned_to`) tersimpan terpisah dan tidak bisa dicampurkan.
- [ ] Sumber laporan (`origin`) dan `reported_at` disimpan dan ditampilkan.
- [ ] SLA dihitung dari `reported_at`; selisih keterlambatan pencatatan tersedia di laporan.
- [ ] Tiket `is_internal = true` tidak masuk metrik layanan karyawan.
- [ ] Feedback diberi label `STAFF_RECORDED` dan tidak bisa disamakan survei mandiri.
- [ ] Setiap perubahan identitas penting dan `reported_at` tercatat di audit trail.
- [ ] Endpoint menolak `created_by`, `ticket_number`, dan snapshot dari klien.
- [ ] Permission RBAC ditegakkan per endpoint.
- [ ] UI menampilkan tiga identitas secara eksplisit.
