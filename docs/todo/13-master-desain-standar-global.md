# 13 - Master Desain Standar Global (Desktop & Future Pages)

- **Status**: **Selesai**
- **Referensi Acuan**: `/dashboard/assets` dan `/dashboard/tickets`
- **Design Spec**: [2026-10-27-master-design-standard-design.md](../superpowers/specs/2026-10-27-master-design-standard-design.md)
- **Implementation Plan**: [2026-10-27-master-design-standard.md](../superpowers/plans/2026-10-27-master-design-standard.md)
- **Panduan Desain**: [UI_DESIGN_SYSTEM_GUIDE.md](../../UI_DESIGN_SYSTEM_GUIDE.md) & [DESIGN.md](../../DESIGN.md)

---

## Ringkasan Standar

1. **Logo - Header & Sub-title**:
   - Ikon logo/modul dalam kotak emerald `p-2 bg-emerald-600 rounded-xl text-white shadow-xs`.
   - Judul H1 `text-2xl font-extrabold text-slate-900 tracking-tight`.
   - Sub-judul deskriptif fungsi modul `text-xs text-slate-500 mt-1`.
   - Tombol-tombol aksi jelas: Primary emerald dan Secondary border putih.
2. **Keseragaman Lebar Kerja (Unified Workspace)**:
   - Dilarang membuat lebar berbeda antarhalaman (`max-w-7xl` atau `max-w-5xl`). Seluruh halaman daftar menggunakan standar `<div className="space-y-6">`.
3. **Kartu KPI Interaktif untuk Filter**:
   - Menampilkan metrik data sekaligus berfungsi sebagai tombol filter cepat dengan indikator active ring dan badge "Aktif".
4. **Toolbar Pencarian & Filter Tertata Rapi**:
   - Container kartu putih `rounded-2xl p-4`, search box responsif, grid dropdown filter rapi, dan tombol reset filter.
5. **Tabel Data, Tagging, Action Icon, & Pagination**:
   - Tagging status jelas dengan pill dot badge semantik.
   - Kolom aksi baris **cukup icon yang mewakili** (`ExternalLink`, `Edit`, `Trash2`, `UserCheck`) dengan tooltip (`title`) dan `aria-label`.
   - Pagination footer rapi dengan info record dan navigasi halaman.
6. **Larangan Keras Tombol Refresh Manual**:
   - Seluruh data wajib termuat secara reaktif dan otomatis. Dilarang menambahkan tombol refresh manual di halaman mana pun.

---

## Checkpoint Implementasi

- [x] Auto-generate Design Spec di `docs/superpowers/specs/2026-10-27-master-design-standard-design.md`
- [x] Auto-generate Implementation Plan di `docs/superpowers/plans/2026-10-27-master-design-standard.md`
- [x] Perbarui dokumen master [UI_DESIGN_SYSTEM_GUIDE.md](../../UI_DESIGN_SYSTEM_GUIDE.md) dan [DESIGN.md](../../DESIGN.md)
- [x] Kunci aturan di `AGENTS.md`, `GEMINI.md`, `frontend/AGENTS.md`, dan `.agents/workflows/master-design.md`
- [x] Bangun komponen shared UI di `frontend/src/components/ui/`:
  - [x] `PageHeader.tsx`
  - [x] `KpiGrid.tsx`
  - [x] `FilterToolbar.tsx`
  - [x] `TableShell.tsx`
  - [x] `TablePagination.tsx`
  - [x] `RowActionButton.tsx`
  - [x] `index.ts` (barrel export)
- [x] TypeScript typecheck & test suite passed (201 pass, 0 fail).
