# Prioritas 6: Sistem Tiket Helpdesk IT

- **Status**: Selesai
- **Terakhir Diperbarui**: 2026-10-26
- **Referensi Spec**: [Sistem Tiket Helpdesk IT](../superpowers/specs/2026-10-12-helpdesk-ticket-design.md)
- **Referensi Plan**: [Rencana Implementasi](../superpowers/plans/2026-10-12-helpdesk-ticket.md)

## Tujuan

Menyediakan pencatatan tiket layanan IT yang memungkinkan staf IT atau HR/GA mencatat permintaan **atas nama karyawan** yang melapor — tanpa mengharuskan karyawan tersebut memiliki akun aplikasi. Sistem ini memisahkan tiga identitas (pelapor, pembuat tiket, penanggungjawab), mencatat sumber laporan, mengukur SLA dari waktu laporan diterima, dan memisahkan pekerjaan internal IT dari laporan karyawan.

## Ruang Lingkup

- Tiga identitas eksplisit: **Requester** (karyawan HR), **Created By** (staf IT yang mencatat), **Assigned To** (petugas pengerjaan).
- Requester dari direktori `employees` — tidak wajib punya akun login.
- Sumber laporan: WhatsApp, Telepon, Email, Langsung, atau Temuan Internal IT.
- Dua timestamp terpisah: waktu laporan diterima (`reported_at`) dan waktu tiket dicatat sistem (`created_at`).
- SLA dihitung dari `reported_at`; selisih keterlambatan pencatatan tersedia di laporan.
- Tiket internal (`is_internal = true`) dipisahkan dari metrik layanan karyawan.
- Feedback yang dicatat staf diberi label `STAFF_RECORDED` — tidak disamakan dengan survei mandiri.
- Audit trail append-only untuk setiap perubahan tiket (termasuk perubahan `reported_at`).

## Kriteria Selesai

- [x] Tiket dapat dibuat IT atas nama karyawan tanpa karyawan perlu punya akun.
- [x] Tiga identitas tersimpan terpisah dan tidak dapat dicampurkan dari klien.
- [x] Sumber laporan dan `reported_at` disimpan dan ditampilkan di UI.
- [x] SLA dan laporan KPI dihitung dari `reported_at`, bukan `created_at`.
- [x] Tiket `is_internal = true` tidak masuk metrik layanan karyawan.
- [x] Feedback diberi label `STAFF_RECORDED` secara eksplisit.
- [x] Setiap perubahan field penting tercatat di audit trail.
- [x] Permission RBAC (`helpdesk.manage`, `helpdesk.view`, `helpdesk.admin`) ditegakkan per endpoint.
- [x] UI menampilkan tiga identitas berdampingan secara eksplisit.
- [x] Automated tests mencakup semua endpoint, transisi status, dan skenario identitas.

## Checkpoint Git

- [x] Task 1: Schema DB + audit append-only — `feat(helpdesk): add ticket schema and append-only audit`
- [x] Task 2: Domain service + audit trail — `feat(helpdesk): add ticket domain service and audit`
- [x] Task 3: API backend CRUD — `feat(helpdesk): add REST API for tickets`
- [x] Task 4: Upload lampiran — `feat(helpdesk): add attachment upload`
- [x] Task 5: KPI stats endpoint — `feat(helpdesk): add KPI stats endpoint`
- [x] Task 6: Frontend list + form buat — `feat(helpdesk): add ticket list and create form`
- [x] Task 7: Frontend detail + audit trail — `feat(helpdesk): add ticket detail and audit trail`
- [x] Task 8: Verifikasi lintas sistem — `test(helpdesk): verify full ticket system coverage`

## Alur Kerja

```
Karyawan melapor (WA/telp/email/langsung)
    ↓
IT mencatat tiket atas nama pelapor
  - Pilih requester dari direktori karyawan HR
  - Pilih sumber laporan
  - Isi waktu laporan diterima (reported_at)
    ↓
Tiket dibuat dengan tiga identitas terpisah
  - Requester: karyawan pelapor
  - Created By: staf IT yang mencatat (dari sesi)
  - Assigned To: petugas pengerjaan (opsional saat buat)
    ↓
Pekerjaan dilakukan → komentar/update dicatat
    ↓
Resolve → konfirmasi ke pelapor dicatat (siapa, kapan, kanal)
    ↓
Tiket ditutup → tersedia di laporan KPI (SLA dari reported_at)
```

## Catatan Non-Goals (Tahap Ini)

- Portal karyawan mandiri belum dibuka; struktur data sudah siap untuk itu.
- Integrasi otomatis WhatsApp/email belum termasuk.
- Approval workflow bertahap belum termasuk.
- SLA enforcement otomatis (notifikasi, eskalasi) belum termasuk.

## Catatan Implementasi & Verifikasi

- **Arsitektur Modular (Screaming Architecture)**:
  - Backend terisolasi di `backend/src/modules/ticket/` (`schema.ts`, `types.ts`, `service.ts`, `attachment.ts`, `stats.ts`, `controller.ts`, `routes.ts`, `index.ts`). Re-export stubs dipertahankan pada `src/db/schema/helpdesk.ts`, `src/domain/helpdesk.ts`, `src/services/helpdesk.ts`, dan `src/controllers/`.
  - Frontend terisolasi di `frontend/src/modules/ticket/` (`types.ts`, `constants.ts`, `api.ts`, `components/`, `index.ts`). Page routes di `frontend/src/app/dashboard/tickets/` berfungsi sebagai thin controllers. Re-export stubs pada `src/lib/helpdesk/` dan `src/components/helpdesk/`.
- **Integritas Audit Trail**: Trigger PostgreSQL `trg_protect_helpdesk_audit` aktif menolak statement UPDATE atau DELETE dengan SQLSTATE 55000.
- **Tiga Identitas Eksplisit**: `requester_employee_id` (karyawan HR), `created_by_user_id` (staf pencatat dari JWT), `assigned_to_user_id` (petugas IT).
- **Pengujian & Verifikasi**:
  - Backend test suite: 355 passing test cases (`npm test`).
  - Frontend test suite: 200 passing test cases (`npm test`).
  - Frontend typecheck & lint: 0 errors (`tsc --noEmit` & `npm run lint`).
  - Production build: Next.js clean build (`npm run build` 52 pages).
