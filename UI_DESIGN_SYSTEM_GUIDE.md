# Master Desain GAJIANICH / AMS — Emerald Enterprise

> **Golden Rule**: Dilarang keras menggunakan gaya "AI Vibe" (background kartu gelap, gradient ungu/indigo/neon, glow shadow, floating glassmorphism, atau pill badge bertumpuk yang aneh).  
> **Acuan Master Halaman**: Seluruh halaman desktop saat ini dan yang akan dibangun di masa mendatang **wajib** berkiblat pada standar antarmuka:
> 1. [Asset Registry](/dashboard/assets) (`http://192.168.10.212:3000/dashboard/assets`)
> 2. [IT Helpdesk Ticketing](/dashboard/tickets) (`http://192.168.10.212:3000/dashboard/tickets`)
>
> Seluruh halaman master data, rekapitulasi, pengaturan, dan transaksi di dashboard AMS **wajib** mengikuti struktur, tata letak, warna, dan komponen di dokumen ini.

---

## 0. Status Master dan Aturan Mutlak untuk Agen AI & Pengembang

**Berlaku sejak 19 Oktober 2026 (Diperbarui 27 Oktober 2026).** Dokumen ini adalah acuan normatif tunggal untuk desain aplikasi.

### ⚠️ PERINGATAN WAJIB BAGI SETIAP AGEN SEBELUM MEMBUAT HALAMAN BARU:
Setiap AI agent (Antigravity, Gemini, Claude, Codex) atau pengembang **WAJIB membuka dan membaca file ini (`UI_DESIGN_SYSTEM_GUIDE.md`)** sebelum merencanakan kode, membuat komponen baru, atau menambahkan halaman baru di `frontend/src/app/dashboard/`.

**Urutan Acuan Visual:**
1. Instruksi eksplisit pengguna untuk tugas saat ini.
2. Master desain di dokumen ini (`UI_DESIGN_SYSTEM_GUIDE.md`).
3. Komponen referensi baku di `frontend/src/components/ui/` (`PageHeader`, `KpiGrid`, `FilterToolbar`, `TableShell`, `TablePagination`, `RowActionButton`, `StatusBadge`, `ModalShell`, `ConfirmDeleteModal`).
4. Halaman acuan live: `/dashboard/assets` dan `/dashboard/tickets`.

---

## 1. Skema Warna Standar (Emerald Enterprise)

- **Warna Utama (Brand / Primary)**: Emerald (`emerald-600` / `#059669`, hover `emerald-700` / `#047857`, active `emerald-800` / `#065F46`).
- **Warna Latar Permukaan (Surface / Background)**:
  - Page Canvas Background: `bg-[#F8FAFC]` (`bg-slate-50/50`).
  - Card & Container: `bg-white border border-slate-200 shadow-xs sm:shadow-sm rounded-2xl`.
  - Input & Form Fields: `bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`.
- **Warna & Skala Teks**:
  - Judul Halaman (H1): `text-2xl font-extrabold text-slate-900 tracking-tight`.
  - Subjudul / Helper: `text-xs text-slate-500 mt-1`.
  - Label Metrik / Kolom Tabel: `text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono`.
  - Isi Tabel / Data Primer: `text-xs font-bold text-slate-900` atau `text-xs font-medium text-slate-700`.
  - Keterangan Sekunder / Timestamp: `text-[11px] text-slate-400 font-normal`.
- **Status Tones Semantik**:
  - **Aktif / Selesai / Approved / Tersedia**: `bg-emerald-50 text-emerald-700 border border-emerald-200` (Dot: `bg-emerald-500`).
  - **Menunggu / Dalam Proses / Maintenance**: `bg-amber-50 text-amber-700 border border-amber-200` (Dot: `bg-amber-500`).
  - **Kritis / Terlewat / Disposed / Ditolak**: `bg-rose-50 text-rose-700 border border-rose-200` (Dot: `bg-rose-500`).
  - **Netral / Draft / Internal**: `bg-slate-100 text-slate-700 border border-slate-200` (Dot: `bg-slate-400`).

---

## 2. Keseragaman Lebar Area Kerja (Unified Workspace System)

### ❌ Dilarang Keras: Lebar Halaman Berbeda-Beda
Dilarang keras setiap halaman mendefinisikan pembatas lebar sendiri seperti `max-w-7xl`, `max-w-5xl`, atau `max-w-6xl` pada halaman daftar/dashboard. Hal tersebut menyebabkan layout "meloncat" dan terasa tidak konsisten saat pengguna berganti-ganti menu.

### ✅ Aturan Baku:
Shell utama `DashboardLayout` telah menetapkan lebar area kerja standar:
```tsx
<main className="flex-1 p-4 md:p-8 md:px-10 max-w-[1600px] w-full mx-auto print:p-0 print:m-0 print:max-w-none print:w-full">
  {children}
</main>
```
Semua halaman daftar/overview/transaksi **wajib** membungkus kontennya dengan:
```tsx
<div className="space-y-6">
  {/* Page Header */}
  {/* KPI Cards (jika ada) */}
  {/* Filter Toolbar */}
  {/* Data Table */}
</div>
```
*(Catatan: Form formulir pembuatan/pengeditan data yang panjang dapat menggunakan form grid 2-3 kolom atau modal shell `max-w-2xl` / `max-w-4xl` terpusat).*

---

## 3. Logo, Header, & Tombol Aksi Halaman

Semua halaman modul wajib memiliki header yang konsisten dengan ikon logo modul dalam kotak emerald, judul, subjudul, dan tombol aksi yang jelas.

### Cuplikan Kode Baku:
```tsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
  {/* Sisi Kiri: Logo + Judul + Sub-title */}
  <div>
    <div className="flex items-center gap-2">
      <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
        <HardDrive className="w-5 h-5" /> {/* Ganti dengan ikon Lucide modul terkait */}
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
        Daftar Inventaris Aset
      </h1>
    </div>
    <p className="text-xs text-slate-500 mt-1">
      Manajemen pencatatan hardware, penugasan pengguna (custodian), dan pemeliharaan berkala IT.
    </p>
  </div>

  {/* Sisi Kanan: Tombol-tombol Aksi Jelas dengan Warna Jelas */}
  <div className="flex items-center gap-2">
    {/* Tombol Sekunder (Ekspor / Impor / Cetak) */}
    <button
      type="button"
      onClick={handleExport}
      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
    >
      <Download className="w-3.5 h-3.5 text-slate-500" />
      <span>Ekspor Excel</span>
    </button>

    {/* Tombol Aksi Utama (Primary CTA) */}
    <button
      type="button"
      onClick={handleOpenCreateModal}
      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
    >
      <Plus className="w-4 h-4" />
      <span>Tambah Aset Baru</span>
    </button>
  </div>
</div>
```
Komponen reusable siap pakai: `<PageHeader title="..." subtitle="..." icon={...} actions={...} />`.

---

## 4. Kartu Metrik / KPI Interaktif (Filterable KPI Cards)

Jika halaman memiliki ringkasan data atau KPI operasional, **wajib** mengikuti desain kartu di `/dashboard/tickets` yang dapat diklik langsung untuk memfilter tabel (*Interactive Quick-Filter*).

### Spesifikasi:
- **Grid responsif**: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6`.
- **Card**: Tombol interaktif `<button type="button">`.
- **Normal State**: `bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-sm rounded-2xl p-4 shadow-xs transition-all flex flex-col justify-between cursor-pointer`.
- **Active State (Sedang Dipilih sebagai Filter)**: `bg-emerald-50/50 border-2 border-emerald-500 ring-2 ring-emerald-500/20`.
- **Badge Aktif**: Di pojok kanan bawah muncul badge pill `text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md` bertuliskan `"Aktif"`.

### Cuplikan Kode Baku:
```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
  {items.map((item) => {
    const isActive = activeKpiFilter === item.id;
    const IconComp = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectFilter(item.id)}
        aria-pressed={isActive}
        className={`group text-left rounded-2xl p-4 shadow-xs transition-all duration-200 flex flex-col justify-between cursor-pointer focus:outline-none ${
          isActive
            ? "bg-emerald-50/50 border-2 border-emerald-500 ring-2 ring-emerald-500/20"
            : "bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between w-full">
          <span className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${
            isActive ? "text-emerald-800" : "text-slate-500 group-hover:text-slate-700"
          }`}>
            {item.title}
          </span>
          <div className={`p-1.5 rounded-lg transition-transform group-hover:scale-105 ${
            isActive ? "bg-emerald-100" : item.bgColor
          }`}>
            <IconComp className={`w-4 h-4 ${isActive ? "text-emerald-700" : item.iconColor}`} />
          </div>
        </div>

        <div className="mt-2 flex items-baseline justify-between w-full">
          <div>
            <div className={`text-xl font-extrabold tracking-tight ${
              isActive ? "text-emerald-950" : "text-slate-900"
            }`}>
              {item.value}
            </div>
            <div className={`text-[10px] mt-0.5 truncate ${
              isActive ? "text-emerald-700 font-medium" : "text-slate-400"
            }`}>
              {item.helper}
            </div>
          </div>
          {isActive && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md">
              Aktif
            </span>
          )}
        </div>
      </button>
    );
  })}
</div>
```
Komponen reusable siap pakai: `<KpiGrid items={...} activeFilter={...} onSelectFilter={...} />`.

---

## 5. Toolbar Pencarian & Filter Rapi (Search & Filter Bar)

Kolom pencarian dan filter wajib tertata rapi dalam container kartu putih yang terpisah secara elegan (mengacu pada `/dashboard/tickets` dan `/dashboard/assets`).

### Spesifikasi:
- **Container**: `bg-white border border-slate-200 rounded-2xl p-4 shadow-xs mb-6 space-y-3`.
- **Baris 1**: Input pencarian responsif + tab cakupan/scope jika ada (misal: "Semua / Aduan / Internal").
- **Baris 2**: Grid dropdown `<select>` (Kategori, Status, Lokasi, Prioritas) + Tombol **Reset Filter** yang otomatis muncul jika ada filter yang terpasang.

### Cuplikan Kode Baku:
```tsx
<div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs mb-6 space-y-3">
  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
    {/* Kolom Search */}
    <div className="relative flex-1">
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        type="text"
        placeholder="Cari kode, nama, nomor seri..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
      />
    </div>

    {/* Scope / Switch Selector (Opsional) */}
    {hasScopes && (
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
        <button
          type="button"
          onClick={() => setScope("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            scope === "all" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600"
          }`}
        >
          Semua
        </button>
        {/* ... scope items lainnya ... */}
      </div>
    )}
  </div>

  {/* Grid Dropdown Filter */}
  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 pt-2 border-t border-slate-100 items-center">
    <select
      value={category}
      onChange={(e) => setCategory(e.target.value)}
      className="bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
    >
      <option value="">Semua Kategori</option>
      {/* options */}
    </select>

    <select
      value={status}
      onChange={(e) => setStatus(e.target.value)}
      className="bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
    >
      <option value="">Semua Status</option>
      {/* options */}
    </select>

    {/* Tombol Reset Filter */}
    {hasActiveFilters && (
      <button
        type="button"
        onClick={handleReset}
        className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-rose-200 transition-all font-medium"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Reset Filter</span>
      </button>
    )}
  </div>
</div>
```
Komponen reusable siap pakai: `<FilterToolbar search={...} onSearchChange={...} dropdownFilters={...} onResetFilters={...} />`.

---

## 6. Tabel Data, Tagging, Action Icon, & Pagination

Tabel adalah representasi utama data aplikasi. Setiap tabel wajib memiliki header terstruktur, penandaan status yang jelas (*tagging*), tombol aksi baris berbasis ikon, dan footer pagination.

### A. Struktur Shell & Header Tabel
```tsx
<div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
          <th className="py-3 px-4">Kode / ID</th>
          <th className="py-3 px-4">Nama & Deskripsi</th>
          <th className="py-3 px-4">Kategori / Lokasi</th>
          <th className="py-3 px-4 text-center">Status</th>
          <th className="py-3 px-4 text-right">Aksi</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {/* Rows */}
      </tbody>
    </table>
  </div>
  {/* Pagination Footer */}
</div>
```

### B. Baris Data & Tagging
Setiap baris data menggunakan hover efek lembut:
`tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors text-xs text-slate-700"`

Tagging status menggunakan `StatusBadge` atau format pill dengan dot:
```tsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
  Tersedia
</span>
```

### C. Kolom Aksi Baris: Cukup Ikon yang Mewakili
Untuk menjaga kerapian dan efisiensi ruang layar pada desktop, tombol aksi di baris tabel **cukup berupa ikon yang mewakili** tindakan, diletakkan rapat ke kanan (`flex items-center justify-end gap-1`).

| Aksi | Ikon | Warna & Hover Class | Keterangan |
|---|---|---|---|
| **Lihat / Detail** | `<ExternalLink className="w-3.5 h-3.5" />` | `text-slate-500 hover:text-slate-900 hover:bg-slate-100 p-1.5 rounded-lg transition-colors` | Menuju halaman detail |
| **Operasional / Assign** | `<UserCheck className="w-3.5 h-3.5" />` | `text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors` | Tindakan bisnis langsung |
| **Ubah / Edit** | `<Edit className="w-3.5 h-3.5" />` | `text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors` | Membuka modal edit |
| **Hapus / Delete** | `<Trash2 className="w-3.5 h-3.5" />` | `text-slate-500 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors` | Membuka konfirmasi hapus |

> **Wajib**: Setiap tombol aksi hanya-ikon **wajib menyertakan atribut `title="..."` dan `aria-label="..."`** agar aksesibel bagi pembaca layar dan pengguna melihat tooltip saat cursor mengarah ke ikon.

### D. Footer Pagination Standar
Footer diletakkan di bawah tabel di dalam kartu yang sama:
```tsx
<div className="bg-slate-50/75 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs text-slate-600 font-mono">
  <div>
    Menampilkan <span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span> sampai{" "}
    <span className="font-semibold text-slate-900">{Math.min(page * limit, total)}</span> dari{" "}
    <span className="font-semibold text-slate-900">{total}</span> data
  </div>

  <div className="flex items-center gap-1">
    <button
      type="button"
      disabled={page <= 1}
      onClick={() => onPageChange(page - 1)}
      className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium text-xs transition-all shadow-2xs cursor-pointer"
    >
      Sebelumnya
    </button>
    <span className="px-2 font-mono text-[11px] text-slate-500">
      Hal {page} dari {totalPages}
    </span>
    <button
      type="button"
      disabled={page >= totalPages}
      onClick={() => onPageChange(page + 1)}
      className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium text-xs transition-all shadow-2xs cursor-pointer"
    >
      Selanjutnya
    </button>
  </div>
</div>
```
Komponen reusable siap pakai: `<TablePagination page={...} limit={...} total={...} onPageChange={...} />`.

---

## 7. Larangan Keras Tombol Refresh Manual (No Manual Refresh Buttons)

> **ATURAN MUTLAK**: **Dilarang keras menambahkan tombol "Refresh", "Segarkan Data", "Muat Ulang", atau tombol berikon `RefreshCw`/`RotateCw` untuk reload di header halaman, toolbar, filter bar, card header, maupun footer.**

1. **Reaktif & Otomatis**: Semua data tabel, ringkasan, dan kartu KPI wajib dimuat secara reaktif (otomatis load saat komponen di-mount, saat parameter query/filter/pagination berubah, dan otomatis refetch saat aksi create/edit/delete di modal selesai).
2. **Pengecualian terbatas**: Hanya untuk pemicu sinkronisasi integrasi eksternal eksplisit (misal trigger sync API Accurate Server) atau sensor hardware (misal update koordinat GPS).

---

## 8. Peta Komponen Reusable Baku

Komponen berikut telah disediakan di direktori `frontend/src/components/ui/` dan **wajib di-import** oleh halaman baru:

| Komponen | Lokasi Import | Penggunaan |
|---|---|---|
| `PageHeader` | `@/components/ui/PageHeader` | Header seragam (Logo, Title, Subtitle, Actions) |
| `KpiGrid` | `@/components/ui/KpiGrid` | Grid ringkasan KPI interaktif untuk filter instan |
| `FilterToolbar` | `@/components/ui/FilterToolbar` | Search input, scope selector, dropdown grid, reset button |
| `TableShell` | `@/components/ui/TableShell` | Container tabel responsif, skeleton loading, dan empty state |
| `TablePagination` | `@/components/ui/TablePagination` | Navigasi pagination footer seragam |
| `RowActionButton` | `@/components/ui/RowActionButton` | Tombol aksi baris tabel berbasis ikon yang aksesibel |
| `StatusBadge` | `@/components/ui/StatusBadge` | Tag status dengan dot dan warna semantik |
| `ModalShell` | `@/components/ui/ModalShell` | Modal dialog seragam |
| `ConfirmDeleteModal`| `@/components/ui/ConfirmDeleteModal` | Konfirmasi hapus data berisiko |

---

## 9. Checklist Kesesuaian Desain Sebelum Pekerjaan Selesai

Sebelum AI Agent menyatakan penyelesaian fitur atau pembuatan halaman baru, jalankan checklist ini:
- [ ] File `UI_DESIGN_SYSTEM_GUIDE.md` telah dibuka dan dibaca sebelum kode dibuat.
- [ ] Halaman dibungkus `<div className="space-y-6">` tanpa pembatas lebar sepihak (`max-w-7xl`/`max-w-5xl`).
- [ ] Header menggunakan logo kotak emerald + judul font extrabold + subjudul font kecil (`text-xs text-slate-500`).
- [ ] Tombol aksi jelas: Primary emerald, Secondary putih berborder.
- [ ] Kartu KPI (jika ada) dapat diklik untuk memfilter data dan memiliki active ring & badge "Aktif".
- [ ] Kolom search & filter tertata rapi dalam card putih, dilengkapi tombol Reset Filter.
- [ ] Kolom aksi tabel hanya berupa icon-icon representatif dengan tooltip (`title`) dan `aria-label`.
- [ ] Pagination footer menampilkan info record dan tombol navigasi seragam.
- [ ] **Tidak ada tombol refresh manual** di halaman.
