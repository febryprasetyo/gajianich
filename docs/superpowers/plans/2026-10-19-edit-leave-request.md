# Implementation Plan: Fitur Edit Permohonan Cuti Belum Disetujui (Status PENDING)

- **Tanggal**: 2026-10-19
- **Design Spec**: [docs/superpowers/specs/2026-10-19-edit-leave-request-design.md](file:///home/fastpec/code/ams-app/docs/superpowers/specs/2026-10-19-edit-leave-request-design.md)
- **Status**: COMPLETED (Verified & Committed)

---

## 1. Shared Types & Schema Interfaces

### Update `createLeaveRequestSchema` / `updateLeaveRequestSchema`:
Di `backend/src/controllers/leaveController.ts`:
```typescript
export const updateLeaveRequestSchema = z.object({
  leaveType: z.enum(['ANNUAL', 'SPECIAL']),
  specialLeaveReason: z.string().max(100).optional().nullable(),
  reason: z.string().min(1, 'Alasan cuti wajib diisi').max(500),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  durationDays: z.coerce.number().positive('Jumlah cuti minimal 1 hari'),
  resumeWorkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional().nullable(),
  handoverToEmployeeId: z.coerce.number().positive().optional().nullable(),
  handoverTask: z.string().max(1000).optional().nullable(),
  emergencyPhone: z.string().max(50).optional().nullable(),
}).refine((data) => {
  const startYear = Number(data.startDate.split('-')[0]);
  const endYear = Number(data.endDate.split('-')[0]);
  return startYear === endYear;
}, {
  message: 'Periode cuti harus berada dalam tahun kalender yang sama. Jika melewati pergantian tahun, ajukan permohonan terpisah untuk masing-masing tahun.',
  path: ['endDate'],
}).refine((data) => {
  return data.endDate >= data.startDate;
}, {
  message: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai',
  path: ['endDate'],
});
```

---

## 2. Phase-by-Phase Tasks

### Phase 1: Backend Controller, Routes, & Tests (TDD)
- [x] Buat handler `updateLeaveRequest` di `backend/src/controllers/leaveController.ts`:
  - Ambil request `id`.
  - Cek apakah status `PENDING` (jika `APPROVED` / `REJECTED`, tolak `403`).
  - Lakukan kalkulasi penyesuaian saldo cuti tahunan (`delta = newDuration - oldDuration`).
  - Simpan perubahan di DB Transaction (`leaveRequests` + `leaveBalances`).
- [x] Daftarkan route `PUT /api/v1/leaves/requests/:id` di `backend/src/routes/leaveRoutes.ts`.
- [x] Tulis unit tests di `backend/src/controllers/leaveController.test.ts`:
  - Test validasi update payload.
  - Test blokir edit cuti yang sudah `APPROVED`.
  - Test penyesuaian delta saldo cuti saat durasi bertambah/berkurang.
- [x] Jalankan verifikasi backend: `npm test` di `backend`.

### Phase 2: Frontend Form & Page Integration
- [x] Perbarui `LeaveRequestForm.tsx`:
  - Tambahkan props: `mode?: 'create' | 'edit'`, `initialData?: LeaveDetailItem`, `requestId?: number`.
  - Jika mode `edit`: kunci pilihan pemohon (`disabled` / read-only), muat data existing ke state form.
  - Update submit handler: panggil `PUT /api/v1/leaves/requests/${requestId}` saat mode `edit`.
  - Redirect setelah simpan: `router.replace('/dashboard/leaves/' + id + '/print')`.
- [x] Buat halaman baru: `frontend/src/app/dashboard/leaves/[id]/edit/page.tsx`:
  - Fetch data permohonan dengan `/api/v1/leaves/requests/${id}`.
  - Jika status bukan `PENDING`, tampilkan peringatan bahwa cuti sudah diproses / tidak dapat diedit.
  - Render `LeaveRequestForm` dengan `mode="edit"`.
- [x] Perbarui tabel permohonan cuti `frontend/src/app/dashboard/leaves/page.tsx`:
  - Tambahkan tombol **Edit** (`<Edit className="w-4 h-4 text-amber-600" />`) di kolom Aksi baris permohonan berstatus `PENDING` yang mengarah ke `/dashboard/leaves/[id]/edit`.

### Phase 3: Verification Loop & Delivery
- [x] Jalankan `npx tsc --noEmit` di `frontend`.
- [x] Jalankan `npm test` di `backend`.
- [x] Uji skenario edit via API / curl.
- [x] Commit atomic sesuai conventional commit.

---

## 3. Verification Commands
- Frontend Typecheck: `cd frontend && npx tsc --noEmit`
- Backend Tests: `cd backend && npm test`
- API Testing: `curl -X PUT http://localhost:5000/api/v1/leaves/requests/:id ...`

---

## 4. Git Checkpoint
- `1aa101f` feat(leaves): implement edit pending leave request with balance delta adjustment
