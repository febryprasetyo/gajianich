# Acuan Master Desain Aplikasi AMS

Master desain yang berlaku adalah **[UI_DESIGN_SYSTEM_GUIDE.md](UI_DESIGN_SYSTEM_GUIDE.md)**.
**Setiap AI agent dan pengembang WAJIB membuka dan membaca dokumen tersebut sebelum merencanakan atau membuat halaman baru, menu, fitur, komponen, atau CSS.**

Arah desain telah ditetapkan secara baku oleh pengguna mengacu pada:
1. **Asset Inventory**: `/dashboard/assets` (`http://192.168.10.212:3000/dashboard/assets`)
2. **IT Ticketing**: `/dashboard/tickets` (`http://192.168.10.212:3000/dashboard/tickets`)

---

## 6 Pilar Wajib Master Desain Desktop

1. **Logo - Header & Sub-title**:
   - Ikon logo/modul dalam kotak emerald `p-2 bg-emerald-600 rounded-xl text-white shadow-xs`.
   - Judul H1 `text-2xl font-extrabold text-slate-900 tracking-tight`.
   - Sub-judul penjelasan ringkas modul `text-xs text-slate-500 mt-1`.
   - Tombol-tombol aksi jelas: Primary emerald (`bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold`), Secondary putih berborder (`bg-white border-slate-200 text-slate-700`).

2. **Keseragaman Lebar Area Kerja (Unified Workspace)**:
   - Dilarang membuat lebar berbeda-beda antarhalaman (`max-w-7xl` atau `max-w-5xl`).
   - Lebar diseragamkan oleh shell `DashboardLayout` (`max-w-[1600px]`). Seluruh halaman daftar menggunakan kontainer standar: `<div className="space-y-6">`.

3. **Kartu KPI Interaktif untuk Filter**:
   - Mencontoh kartu KPI pada `/dashboard/tickets`.
   - Kartu menampilkan metrik sekaligus dapat diklik langsung untuk memfilter data, dengan indikator active ring dan badge `"Aktif"`.

4. **Toolbar Pencarian & Filter Tertata Rapi**:
   - Container kartu putih `bg-white border border-slate-200 rounded-2xl p-4 shadow-xs mb-6 space-y-3`.
   - Search input lebar + opsi switch scope + grid dropdown filter rapi + tombol Reset Filter.

5. **Tabel Data, Tagging, Action Icon, & Pagination**:
   - Container tabel `rounded-2xl border border-slate-200 shadow-xs overflow-hidden`.
   - Tagging status jelas dengan pill dot badge semantik.
   - Kolom aksi baris **cukup icon yang mewakili** (`ExternalLink`, `Edit`, `Trash2`, `UserCheck`) dengan hit target nyaman, tooltip (`title`), dan `aria-label`.
   - Pagination footer rapi dengan info record dan navigasi halaman.

6. **Larangan Keras Tombol Refresh Manual**:
   - Dilarang keras menambahkan tombol refresh manual ("Refresh", "Segarkan Data", "Muat Ulang", ikon `RefreshCw`/`RotateCw`) di header atau toolbar halaman mana pun. Data harus termuat secara reaktif dan otomatis.

---

Komponen shared UI yang wajib di-import: `@/components/ui/PageHeader`, `@/components/ui/KpiGrid`, `@/components/ui/FilterToolbar`, `@/components/ui/TableShell`, `@/components/ui/TablePagination`, `@/components/ui/RowActionButton`.
