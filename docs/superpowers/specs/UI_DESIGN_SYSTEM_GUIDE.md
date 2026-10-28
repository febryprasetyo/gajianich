> **SALINAN HISTORIS — bukan acuan aktif.** Baca [master desain root](../../../UI_DESIGN_SYSTEM_GUIDE.md). Jika isi salinan ini berbeda, master root yang berlaku.

# GAJIANICH Enterprise UI Design System Guide

> **Golden Rule**: Dilarang keras menggunakan gaya "AI Vibe" (background kartu gelap, gradient ungu/indigo/neon, glow shadow, floating glassmorphism, atau pill badge bertumpuk yang aneh).  
> **Source of Truth**: [`frontend/src/components/master/EmployeeDirectoryPage.tsx`](file:///home/fastpec/code/gajianich/frontend/src/components/master/EmployeeDirectoryPage.tsx) (Halaman Data Karyawan).  
> Seluruh halaman master data, rekapitulasi, pengaturan, dan transaksi di dashboard GAJIANICH **wajib** mengikuti struktur, warna, dan komponen di dokumen ini.

---

## 1. Skema Warna Standar (Emerald Enterprise)

- **Warna Utama (Brand / Primary)**: Emerald (`emerald-600`, hover `emerald-700`, active `emerald-800`).
- **Warna Latar Permukaan (Surface / Background)**:
  - Page Background: `bg-slate-50/50` atau default layout background.
  - Card & Container: `bg-white border border-slate-200 shadow-sm rounded-2xl`.
  - Input & Form Fields: `bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900`.
- **Warna Teks**:
  - Judul Halaman: `text-2xl font-extrabold text-slate-900 tracking-tight`.
  - Subjudul / Helper: `text-xs text-slate-500`.
  - Label Kolom / Metric: `text-[11px] text-slate-400 uppercase tracking-wider font-mono`.
  - Isi Tabel / Data: `text-xs text-slate-700 font-medium`.
- **Status Tones**:
  - Aktif / Approved / Sukses: `bg-emerald-50 text-emerald-700 border border-emerald-200` (Dot: `bg-emerald-500`).
  - Menunggu / Pending: `bg-amber-50 text-amber-700 border border-amber-200` (Dot: `bg-amber-500`).
  - Nonaktif / Resign / Ditolak: `bg-slate-100 text-slate-600 border border-slate-200` atau `bg-rose-50 text-rose-700 border border-rose-200`.

---

## 2. Struktur Header Halaman

Setiap halaman modul memiliki header dengan icon hijau, judul tebal, subjudul kecil, dan tombol aksi di kanan:

```tsx
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
  <div>
    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
      <Icon className="w-6 h-6 text-emerald-600" />
      <span>{Judul Halaman}</span>
    </h1>
    <p className="text-xs text-slate-500 mt-1">
      {Deskripsi ringkas fungsi halaman untuk operasional.}
    </p>
  </div>

  <div className="flex flex-wrap items-center gap-2.5">
    {/* Tombol Sekunder (Putih Border Abu-abu) */}
    <button
      type="button"
      className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer"
    >
      <RefreshCw className="w-4 h-4 text-emerald-600" />
      Muat Ulang
    </button>

    {/* Tombol Utama (Hijau Emerald Solid) */}
    <Link
      href="/dashboard/.../new"
      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
    >
      <Plus className="w-4 h-4" />
      Tambah Data
    </Link>
  </div>
</div>
```

---

## 3. Kartu Ringkasan / KPI Stats Cards

Gunakan grid 3 atau 4 kolom dengan kotak icon berwarna pastel lembut di sebelah kiri dan angka besar di sebelah kanan:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {[
    { label: 'KARYAWAN AKTIF', value: 242, icon: <Users className="w-5 h-5" />, tone: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
    { label: 'DEPARTEMEN', value: 24, icon: <Building2 className="w-5 h-5" />, tone: 'bg-amber-50 border-amber-100 text-amber-600' },
    { label: 'LOKASI', value: 5, icon: <MapPin className="w-5 h-5" />, tone: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
  ].map((s) => (
    <div key={s.label} className="p-4 rounded-2xl flex items-center gap-4 bg-white border border-slate-200 shadow-sm">
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${s.tone}`}>
        {s.icon}
      </div>
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">{s.label}</p>
        <p className="text-xl font-bold text-slate-900 mt-0.5">{s.value}</p>
      </div>
    </div>
  ))}
</div>
```

---

## 4. Toolbar Pencarian & Filter

Bilah filter tunggal memanjang dengan background putih, rounded-2xl, border abu-abu tipis:

```tsx
<div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center gap-3 shadow-sm">
  <div className="relative flex-1 min-w-48">
    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
    <input
      type="text"
      placeholder="Cari data..."
      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
    />
  </div>
  <div className="flex items-center gap-2">
    <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
    <select className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-400 transition-all cursor-pointer">
      <option value="">Semua Filter</option>
    </select>
  </div>
  <span className="text-xs text-slate-500 ml-auto hidden sm:inline">
    Menampilkan <strong className="text-slate-900">{filteredCount}</strong> dari {totalCount} data
  </span>
</div>
```

---

## 5. Tabel Data Standar

Tabel wajib dibungkus kontainer putih `rounded-2xl border border-slate-200 overflow-hidden shadow-sm`:

```tsx
<div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
  <div className="overflow-x-auto">
    <table className="w-full text-left text-xs border-collapse">
      <thead>
        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider font-mono">
          <th className="py-3.5 px-4">KODE / NIK</th>
          <th className="py-3.5 px-4">NAMA</th>
          <th className="py-3.5 px-4">STATUS</th>
          <th className="py-3.5 px-4 text-right">AKSI</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        <tr className="hover:bg-emerald-50/30 transition-colors group">
          <td className="py-3.5 px-4 font-mono">
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[11px]">
              {kode}
            </span>
          </td>
          <td className="py-3.5 px-4 font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
            {nama}
          </td>
          <td className="py-3.5 px-4">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Aktif
            </span>
          </td>
          <td className="py-3.5 px-4 text-right">
            <div className="flex items-center justify-end gap-1">
              <button className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all cursor-pointer">
                <Eye className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all cursor-pointer">
                <Pencil className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

---

## 6. Aturan Input Angka (Form Numbers)

Hilangkan spin buttons default browser yang mengganggu:
```tsx
<input
  type="number"
  className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-semibold"
/>
```

---

## 7. Hal Yang Dilarang (DON'T)

❌ Jangan menggunakan tema gelap terpisah (`dark:bg-slate-950`, `dark:border-slate-800`) di komponen modul jika halaman master lainnya adalah light ERP.  
❌ Jangan gunakan background header yang tebal atau card header gelap dengan gradien.  
❌ Jangan gunakan aksen ungu (violet), indigo, atau neon glow. Gunakan selalu keluarga **Emerald**.  
❌ Jangan biarkan spin arrow (up/down counter) default browser muncul di input angka form cuti/kehadiran.  
❌ Jangan membuat card yang melengkung berlebihan atau mengambang (floating) tanpa border pemisah yang jelas. Gunakan `rounded-2xl border border-slate-200 shadow-sm`.
