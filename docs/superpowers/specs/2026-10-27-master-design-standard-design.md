# Design Spec: GAJIANICH Master Desain Standar Global (Desktop & Future Pages)

- **Tanggal**: 2026-10-27
- **Status**: Approved
- **Referensi Acuan**: `/dashboard/assets` dan `/dashboard/tickets`
- **Tujuan**: Membakukan desain antarmuka (UI/UX) untuk semua halaman desktop saat ini dan seluruh halaman baru yang akan dibangun di masa mendatang, serta mengunci aturan wajib bagi agen AI dan pengembang.

---

## 1. Latar Belakang & Problem Statement
Sebelumnya, terdapat variasi antarhalaman di aplikasi GAJIANICH:
- Sebagian halaman menggunakan `max-w-7xl` atau `max-w-5xl`, sementara halaman lain menggunakan full-width yang disediakan oleh shell `DashboardLayout` (`max-w-[1600px]`), menyebabkan lebar visual desktop meloncat-loncat saat berpindah menu.
- Struktur header bervariasi: ada yang tanpa ikon, ada yang menggunakan subjudul dengan font terlalu besar, dan ada yang meletakkan tombol aksi secara tidak teratur.
- Filter dan pencarian belum seragam: ada yang hanya search box sederhana, ada yang filter dropdown tidak sejajar, dan belum semua metrik/KPI card dapat di-klik untuk memfilter data secara instan.
- Kolom aksi tabel di beberapa halaman menggunakan teks panjang yang memakan ruang, padahal cukup menggunakan ikon representatif dengan hit target dan tooltip yang jelas.

---

## 2. Prinsip & Golden Rules Master Desain

1. **Tema Emerald Enterprise (GAJIANICH)**:
   - Primary: Emerald (`#059669` / `emerald-600`, hover `emerald-700`).
   - Canvas: Slate-50 (`#F8FAFC`).
   - Card/Surface: Putih (`#FFFFFF`), border `border-slate-200`, shadow halus `shadow-xs` atau `shadow-sm`, border-radius `rounded-2xl`.
   - Dilarang keras menggunakan AI slop: background gelap pada kartu, gradien neon ungu/indigo, glow shadow berlebihan, atau glassmorphism mengambang.
2. **Kepatuhan Wajib Sebelum Membangun Halaman**:
   - Setiap AI agent atau developer **wajib membuka dan membaca `UI_DESIGN_SYSTEM_GUIDE.md`** sebelum merencanakan atau memodifikasi halaman apapun.
3. **Reactivity First**:
   - Dilarang menambahkan tombol "Refresh / Segarkan" manual. Data harus termuat secara reaktif.

---

## 3. Komponen Arsitektur Master Desain

### A. Sistem Lebar Area Kerja (Unified Workspace System)
- Shell utama diatur di `DashboardLayout.tsx`:
  ```tsx
  <main className="flex-1 p-4 md:p-8 md:px-10 max-w-[1600px] w-full mx-auto print:p-0 print:m-0 print:max-w-none print:w-full">
    {children}
  </main>
  ```
- **Aturan Wajib Halaman**: Halaman daftar / dashboard **dilarang** membungkus dirinya dengan kelas pembatas lebar seperti `max-w-7xl` atau `max-w-5xl`.
- Kontainer standar halaman adalah:
  ```tsx
  <div className="space-y-6">
    {/* Page Content */}
  </div>
  ```

---

### B. Logo - Header & Sub-title
Struktur baku header halaman:
```tsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
  <div>
    <div className="flex items-center gap-2">
      <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
        <IconComponent className="w-5 h-5" />
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
        Judul Halaman
      </h1>
    </div>
    <p className="text-xs text-slate-500 mt-1">
      Sub-judul deskriptif fungsi modul operasional secara lugas dan jelas.
    </p>
  </div>

  <div className="flex items-center gap-2">
    {/* Secondary Actions (Export, Import, Template) */}
    <button
      type="button"
      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-medium shadow-2xs flex items-center gap-1.5 transition-all"
    >
      <Download className="w-3.5 h-3.5 text-slate-500" />
      Ekspor
    </button>

    {/* Primary Action Button */}
    <button
      type="button"
      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
    >
      <Plus className="w-4 h-4" />
      Tambah Data Baru
    </button>
  </div>
</div>
```

---

### C. KPI Cards Interaktif (Filterable KPI Cards)
Jika halaman memiliki ringkasan metrik, wajib mengadopsi format interaktif seperti di `/dashboard/tickets`:
- **Grid responsif**: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6`.
- **Card container**: Tombol interaktif (`<button type="button">`) yang memicu filter cepat.
- **State Normal**:
  ```tsx
  bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-sm rounded-2xl p-4 shadow-xs transition-all flex flex-col justify-between cursor-pointer
  ```
- **State Aktif (Filter Terpilih)**:
  ```tsx
  bg-emerald-50/50 border-2 border-emerald-500 ring-2 ring-emerald-500/20
  ```
- **Elemen Kartu**:
  - Judul: `text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-500`
  - Ikon sudut: `p-1.5 rounded-lg bg-<color>-50 text-<color>-600` (atau `bg-emerald-100 text-emerald-700` saat aktif)
  - Nilai Metrik: `text-xl font-extrabold text-slate-900 tracking-tight`
  - Keterangan/Helper: `text-[10px] text-slate-400 mt-0.5 truncate`
  - Indikator Aktif: Badge `text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md` bertuliskan `"Aktif"`.

---

### D. Search & Filter Bar Rapi
Mengikuti model `/dashboard/tickets`:
- **Container**: `bg-white border border-slate-200 rounded-2xl p-4 shadow-xs mb-6 space-y-3`.
- **Baris 1 (Pencarian & Scope)**:
  - Input pencarian: `relative flex-1` dengan ikon `<Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />`.
  - Input field: `w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`.
  - Segmented scope tabs (opsional jika ada kategori umum): `flex items-center gap-1 bg-slate-100 p-1 rounded-xl`.
- **Baris 2 (Dropdown Filter Grid)**:
  - `grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 pt-2 border-t border-slate-100 items-center`.
  - Dropdown `<select>`: `bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`.
  - Tombol Reset Filter: Muncul ketika ada filter aktif (`filters.search || filters.status || ...`):
    `text-xs text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-rose-200 transition-all font-medium flex items-center justify-center gap-1`.

---

### E. Tabel Data, Tagging, Action Icon, & Pagination
1. **Container**: `bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden`.
2. **Thead (Header Tabel)**:
   - `bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono`.
   - Cell: `py-3 px-4`.
3. **Tbody (Isi Data)**:
   - Baris: `border-b border-slate-100 hover:bg-slate-50/60 transition-colors text-xs text-slate-700`.
   - Cell: `py-3.5 px-4`.
4. **Tagging / Badges**:
   - Status badge dengan dot:
     ```tsx
     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
       Selesai
     </span>
     ```
   - Monospace code/ID tag: `font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md`.
5. **Tombol Aksi Baris (Icon-Only Actions)**:
   - Cukup icon representatif yang bersih di dalam flexbox rapat kanan (`flex items-center justify-end gap-1`):
     - Detail/Lihat: `<ExternalLink className="w-3.5 h-3.5" />` (`text-slate-500 hover:text-slate-900 hover:bg-slate-100 p-1.5 rounded-lg`)
     - Quick Action: `<UserCheck className="w-3.5 h-3.5" />` (`text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg`)
     - Edit: `<Edit className="w-3.5 h-3.5" />` (`text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg`)
     - Delete: `<Trash2 className="w-3.5 h-3.5" />` (`text-slate-500 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg`)
   - Setiap tombol aksi wajib menyertakan atribut `title="..."` dan `aria-label="..."`.
6. **Pagination Footer**:
   - `bg-slate-50/75 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs text-slate-600 font-mono`.
   - Sisi kiri: `Menampilkan {(page - 1) * limit + 1} sampai {Math.min(page * limit, total)} dari {total} data`.
   - Sisi kanan: Tombol `Sebelumnya` dan `Selanjutnya` (`px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40`) serta info `Hal {page} dari {totalPages}`.

---

## 4. Reusable Component Kit yang Dibangun
Agar pengembang dan agent tidak membuat variasi sendiri, disediakan shared UI components di `frontend/src/components/ui/`:
1. `PageHeader.tsx`: Standar Header dengan Icon, Title, Subtitle, dan Actions.
2. `KpiGrid.tsx` & `KpiCard.tsx`: Standar interactive KPI Cards dengan state aktif/filter.
3. `FilterToolbar.tsx`: Standar search box, scope tabs, select filter grid, dan reset button.
4. `TableShell.tsx`: Container tabel dengan header, empty state, loading skeleton, dan responsive overflow.
5. `TablePagination.tsx`: Pagination footer standar dengan hitungan data dan tombol navigasi.
6. `RowActionButton.tsx`: Icon button standar untuk aksi baris tabel.

---

## 5. Rencana Penerapan & Enforce Rules
1. Perbarui `UI_DESIGN_SYSTEM_GUIDE.md` secara lengkap.
2. Perbarui `DESIGN.md`.
3. Perbarui `AGENTS.md`, `GEMINI.md`, dan `.agents/workflows/master-design.md` agar setiap agent yang akan membuat atau mengubah halaman wajib membaca `UI_DESIGN_SYSTEM_GUIDE.md` sebelum menyentuh kode.
4. Bangun shared UI components kit dan verifikasi typecheck `npm run typecheck` atau `npx tsc --noEmit`.
