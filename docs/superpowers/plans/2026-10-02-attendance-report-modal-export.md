# GAJIANICH HR Attendance Reports & Multi-Select Export — Implementation Plan (Updated)

**Tanggal:** 2026-10-02  
**Spec Referensi:** `docs/superpowers/specs/2026-10-02-attendance-report-modal-export-design.md`  

---

## Proposed Changes

### Phase 1: Date Cycle (21 s.d. 20) & Domain Logic (TDD)
- [ ] Update `getPayrollCyclePeriod` in `frontend/src/lib/attendance/scheduleShift.ts`:
  - Month N forms `startDate = YYYY-MM-21` (month N) and `endDate = YYYY-MM-20` (month N+1).
- [ ] Update `getDefaultAttendancePeriod` in `frontend/src/lib/attendance/domain.ts`:
  - Resolves default period to the active 21st-to-20th cycle based on active date.
- [ ] Update `scheduleShift.test.mjs` to test Month N -> 21st Month N to 20th Month N+1.
- [ ] Update `EmployeeReport` interface in `frontend/src/lib/attendance/types.ts`:
  - Add `sakitCount: number`, `izinCount: number`, `cutiCount: number`.
- [ ] Update `summarizeEmployees` in `frontend/src/lib/attendance/domain.ts` to aggregate `sakitCount`, `izinCount`, `cutiCount`.
- [ ] Update `domain.test.mjs` to test `getDefaultAttendancePeriod` (21 to 20) and Izin/Sakit/Cuti counts.

### Phase 2: Excel Export (Tanpa "Payroll", "Periode Awal" & "Periode Akhir")
- [ ] In `frontend/src/lib/attendance/excelExport.ts`:
  - Rename columns from `"Periode Mulai"` -> `"Periode Awal"` and `"Periode Selesai"` -> `"Periode Akhir"`.
  - Add columns `"Izin"`, `"Sakit"`, `"Cuti"` to the summary sheet.
  - Rename sheet name from `"Rekap Absensi Payroll"` -> `"Rekap Absensi"`.
  - Default filename without word `"payroll"` (`rekap-absensi-${startDate}-${endDate}.xlsx`).
- [ ] Update `frontend/src/lib/attendance/excelExport.test.mjs` to assert the updated labels, sheet names, and new columns.

### Phase 3: Export Modal Component (Multi-Person & Multi-Divisi)
- [ ] Create `frontend/src/components/attendance/ExportAttendanceModal.tsx`:
  - Multi-divisi filter with quick select/deselect all chips.
  - Multi-person filter with quick select/deselect all, search input, and count indicator.
  - Displays `"Periode Awal"` and `"Periode Akhir"`.
  - Downloads Excel with only selected employees.

### Phase 4: Reports Page UI Revisions
- [ ] In `frontend/src/components/attendance/shared.tsx`:
  - Update `Totals` to show 6 cards: Keterlambatan, Lembur, Hadir, Izin, Sakit, Cuti.
- [ ] In `frontend/src/components/attendance/AttendanceReportsPage.tsx`:
  - Remove "All filters" button and collapsible panel.
  - Move Department select directly to toolbar alongside Month Picker and Search.
  - Update Rekap table columns: Karyawan, Departemen, Hadir, Terlambat, Lembur, Izin, Sakit, Cuti, Detail.
  - Connect Export button to open `ExportAttendanceModal`.
  - Update Month Picker display to show cycle dates `(21 Agt – 20 Sep)`.

### Phase 5: Verification & Delivery
- [ ] Run `npm test --prefix frontend`.
- [ ] Run `npm run lint --prefix frontend`.
- [ ] Run `npm run build --prefix frontend`.
- [ ] Commit atomic changes per git workflow rules.
