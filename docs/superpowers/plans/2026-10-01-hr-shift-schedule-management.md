# GAJIANICH HR Shift & Schedule Management — Implementation Plan

**Tanggal:** 2026-10-01  
**Spec Referensi:** `docs/superpowers/specs/2026-10-01-hr-shift-schedule-management-design.md`  
**Target Fitur:**  
1. Master Shift & Jam Kerja (`/dashboard/attendance/master/shifts`)  
2. Penugasan Shift per Departemen / Karyawan  
3. Proyeksi Kalender Harian Penuh Siklus Payroll (21 s.d. 20) di Kartu Absensi  
4. Dialog Input Absensi & Ketidakhadiran (Sakit, Cuti, Izin, Alpha, Hadir Manual)  

---

## 1. Shared Types & Helper Interfaces

Lokasi: `frontend/src/lib/attendance/types.ts`

```typescript
export interface WorkShift {
  id: number;
  code: string;               // e.g. "OFFICE", "PROD_6D", "PROD_PAGI"
  name: string;               // e.g. "Office Reguler", "Produksi 6 Hari"
  scheduleIn: string;         // "08:00"
  scheduleOut: string;        // "17:00" atau "16:00"
  workDays: 5 | 6;            // 5 = Senin-Jumat, 6 = Senin-Sabtu
  saturdayScheduleIn?: string | null;  // "08:00"
  saturdayScheduleOut?: string | null; // "14:00"
  description?: string;
  isDefault: boolean;         // default Office: 08:00 - 17:00, 5 hari
  isActive: boolean;
}

export interface ShiftAssignment {
  id: number;
  shiftId: number;
  departmentId?: number | null;
  employeeId?: number | null;
}

export interface CalendarDayRow {
  date: string;               // YYYY-MM-DD
  dayName: string;           // "Senin", "Selasa", dst.
  shiftName: string;
  scheduleIn: string;
  scheduleOut: string;
  isDayOff: boolean;
  record?: AttendanceRecord | null;
}
```

---

## 2. Phase-by-Phase Checklist

### Phase 1: Domain Logic & Unit Tests (TDD)
- [ ] Buat file test `frontend/src/lib/attendance/scheduleShift.test.mjs`:
  - Test perhitungan rentang cut-off payroll (bulan N $\rightarrow$ tanggal 21 bulan N-1 s.d. tanggal 20 bulan N).
  - Test resolusi shift: Employee override $\rightarrow$ Department default $\rightarrow$ Global Office default (08:00-17:00, 5 hari).
  - Test proyeksi hari kerja Sabtu: karyawan produksi 6 hari = aktif (08:00-14:00), karyawan office = dayoff.
  - Test pembangkitan baris kalender 31 hari penuh tanpa ada tanggal terlewati.
- [ ] Implementasikan helper functions di `frontend/src/lib/attendance/scheduleShift.ts` hingga seluruh test PASS.

### Phase 2: State & Command Layer
- [ ] Update `frontend/src/lib/attendance/types.ts`:
  - Tambahkan interface `WorkShift`, `ShiftAssignment`.
  - Tambahkan array `shifts` dan `shiftAssignments` ke dalam `AttendanceDataset`.
  - Tambahkan command baru di `AttendanceCommand`: `record_attendance`, `shift`, dan `assign_shift`.
- [ ] Update `frontend/src/lib/attendance/commands.ts`:
  - Handle command `record_attendance` (upsert baris absensi untuk tanggal kosong / edit status sakit, cuti, izin, alpha, hadir manual).
  - Handle command `shift` (tambah/edit/hapus master shift).
  - Handle command `assign_shift` (simpan penugasan departemen/karyawan).

### Phase 3: Menu UI Master Jam Kerja & Shift
- [ ] Buat halaman `frontend/src/app/dashboard/attendance/master/shifts/page.tsx`.
- [ ] Buat komponen `frontend/src/components/attendance/master/ShiftManagementPage.tsx`:
  - Tab 1: Daftar Master Jam Kerja (Tabel shift, jam masuk, jam pulang, tombol Tambah/Edit).
  - Tab 2: Penugasan Shift (Dropdown shift per departemen & penugasan per nama karyawan).
  - Modal form pembuatan/pengeditan shift.
- [ ] Daftarkan submenu ke `frontend/src/components/layout/DashboardLayout.tsx` di bawah *Attendance Master Data*.

### Phase 4: Integrasi Kartu Absensi & Dialog Input Ketidakhadiran
- [ ] Buat modal `frontend/src/components/attendance/RecordAttendanceDialog.tsx`:
  - Pilihan status: Hadir Manual, Sakit (S), Cuti (C), Izin (I), Alpha (A).
  - Input jam masuk & pulang jika Hadir Manual.
  - Textarea alasan/catatan (wajib).
- [ ] Perbarui `frontend/src/components/attendance/AttendanceReportsPage.tsx`:
  - Ganti input tanggal manual dengan dropdown **Bulan & Tahun Siklus Payroll** (dengan tombol opsi kustom).
  - Tampilkan seluruh baris tanggal secara urut (31 hari) dengan status shift yang sesuai.
  - Beri tombol aksi **"Catat / Koreksi"** pada setiap tanggal yang belum ada scan atau yang ingin diedit HRD.
- [ ] Perbarui `frontend/src/components/attendance/AttendanceDataPage.tsx` (Tabel Harian):
  - Tambahkan aksi *"Catat Kehadiran / Izin"* pada baris karyawan yang *"Belum ada data"*.

### Phase 5: Verification & Delivery
- [ ] Jalankan seluruh unit test frontend: `npm test` di frontend.
- [ ] Jalankan typecheck & build Next.js: `npm run build` di frontend.
- [ ] Verifikasi di Docker dev container.
- [ ] Commit Git atomik dengan conventional commit: `feat(attendance): add work shifts, schedule assignments, and full calendar payroll attendance`.

---

## 3. Verification Commands

```bash
# 1. Jalankan unit test spesifik modul shift & schedule
node --test frontend/src/lib/attendance/scheduleShift.test.mjs

# 2. Jalankan seluruh unit test frontend
cd frontend && npm test

# 3. Jalankan build produksi frontend Next.js
cd frontend && npm run build
```
