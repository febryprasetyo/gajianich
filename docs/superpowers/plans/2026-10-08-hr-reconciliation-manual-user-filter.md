# Implementation Plan: HR Reconciliation Manual User/Employee Filter & Selection

## Shared Interfaces & Types

```typescript
// Shared Types in frontend/src/lib/assetCustodian.ts & ReconciliationCandidateCard.tsx
export interface EmployeeCandidate {
  id: number;
  employeeCode: string;
  fullName: string;
  locationId?: number | null;
  locationName?: string | null;
  departmentName?: string | null;
  custodianId?: number | null; // ID active custodian jika karyawan sudah terhubung ke holder
}

export interface CustodianSearchResponse {
  custodians: CustodianSummary[];
  employees: EmployeeCandidate[];
}

export interface ReconciliationCandidateCardProps {
  item: ReconciliationItem;
  activeCustodians: CustodianSummary[];
  allEmployees: EmployeeCandidate[]; // Prop baru: daftar semua karyawan HR aktif untuk pencarian manual
  isBusy: boolean;
  linkSelection: string;
  onLinkSelectionChange: (val: string) => void;
  mergeSelection: string;
  onMergeSelectionChange: (val: string) => void;
  onLinkEmployee: () => void;
  onMergeCustodian: () => void;
  onDismiss: () => void;
}
```

---

## Phase-by-Phase Tasks

### Phase 1: Data Fetching & State Distribution
- [x] File: `frontend/src/app/dashboard/master/asset-custodians/reconciliation/page.tsx`
  - Tambahkan state `allEmployees: EmployeeCandidate[]` di `CustodianReconciliationPage`.
  - Simpan `searchRes.employees` dari response `api.get<CustodianSearchResponse>('/asset-custodians?status=ACTIVE')` ke dalam state `allEmployees`.
  - Teruskan prop `allEmployees={allEmployees}` ke setiap komponen `ReconciliationCandidateCard`.

### Phase 2: UI Tab Switcher & Manual Search Filtering Component
- [x] File: `frontend/src/components/custodians/ReconciliationCandidateCard.tsx`
  - Tambahkan prop `allEmployees: EmployeeCandidate[]`.
  - Tambahkan state lokal di `ReconciliationCandidateCard`:
    - `matchTab: 'suggested' | 'manual'` (default: `item.matches.length > 0 ? 'suggested' : 'manual'`).
    - `manualSearch: string` (kata kunci filter pencarian nama/NIP).
  - Implementasikan Tab Switcher UI di bagian HR Matches:
    - Tab "Suggested Matches ({item.matches.length})"
    - Tab "Cari Karyawan Manual"
  - Implementasikan Tab "Cari Karyawan Manual":
    - Search input dengan ikon Search, placeholder *"Cari nama atau NIP karyawan..."*, dan tombol clear input.
    - Memoized filtered list berdasarkan `fullName` atau `employeeCode` atau `departmentName`.
    - List tampilan hasil filter (scrollable, `max-h-48`):
      - Radio button untuk seleksi karyawan.
      - Tampilkan `fullName`, `employeeCode`, `departmentName`, `locationName`.
      - Indikator visual badge jika karyawan sudah memiliki active custodian (`custodianId != null`).
  - Implementasikan Smart Conflict/Merge Advisory:
    - Jika karyawan yang dipilih sudah memiliki `custodianId`:
      - Tampilkan pesan peringatan amber yang menjelaskan karyawan sudah memiliki custodian aktif.
      - Sediakan tombol pintas *"Gunakan Merge untuk karyawan ini"* yang menyetel `mergeSelection` ke `custodianId` karyawan tersebut dan men-scroll/menyorot bagian Merge.
    - Jika karyawan yang dipilih belum memiliki custodian:
      - Tombol *"Link to selected employee"* aktif untuk menghubungkan unverified custodian ke karyawan terpilih.

### Phase 3: Unit Testing & Verification
- [x] File: `frontend/src/components/custodians/ReconciliationCandidateCard.test.tsx` (atau update test suite relevan di frontend)
  - Tambahkan unit test untuk memastikan:
    - Tab toggle berpindah antara 'suggested' dan 'manual'.
    - Filter pencarian manual menyaring daftar karyawan berdasarkan nama dengan benar.
    - Seleksi karyawan manual memperbarui nilai `linkSelection`.
    - Alert konflik muncul jika karyawan yang dipilih sudah memiliki `custodianId`.
- [x] Jalankan verifikasi menyeluruh:
  - `npm test --prefix frontend`
  - `npx tsc --noEmit --project frontend/tsconfig.json`
  - `npm run lint --prefix frontend`

---

## Verification Commands

```bash
# 1. Typecheck frontend
npm run build --prefix frontend --no-lint

# 2. Run unit tests
npm test --prefix frontend

# 3. Linter
npm run lint --prefix frontend
```
