# Design Spec: Natural Indonesian Copywriting & Server, VPS, Domain, Hosting Monitoring

- **Tanggal Dokumen:** 2026-11-02
- **Status:** APPROVED BY USER (gas lanjutkan)
- **Tipe Perubahan:** UI Copywriting Refinement + New Modules (Server & VPS Monitoring, Domain & Hosting Subscription Tracking)

---

## 1. Summary & Problem Statement

### Masalah yang Diselesaikan
1. **Copywriting Terlalu Kaku:** Istilah-istilah hasil pembakuan sebelumnya terasa terlalu formal/kuno bagi pengguna (misal: "Swafoto", "Ikhtisar", "Label Aset", "Penggunaan Kursi"). Pengguna menginginkan gaya bahasa Indonesia yang luwes, alami, dan lazim digunakan di startup & kantor modern.
2. **Pemisahan Server Accurate vs Server Fisik/VPS:** Halaman `/dashboard/infrastructure` saat ini khusus menangani telemetri server database Accurate (Firebird) & lisensinya. Pengguna membutuhkan:
   - Penamaan spesifik untuk Accurate: **`Server Accurate`**.
   - Menu dan halaman baru untuk monitoring server fisik dan VPS: **`Server & VPS`** (`/dashboard/servers`).
3. **Kebutuhan Monitoring Tanggal Expired Domain, Hosting & Email:** Belum ada antarmuka terpusat untuk memantau tanggal jatuh tempo (expired date) dari domain perusahaan, cloud hosting, dan email langganan bisnis (Google Workspace, M365, dll) sehingga berisiko terlambat perpanjang (downtime).

---

## 2. Goals & Non-Goals

### Goals
- Menerapkan tabel copywriting alami yang telah disetujui (misal: "Dashboard", "Validasi Foto Wajah", "Reset Filter", "Asset Tag", "Aturan Auto-Approve", "Server Accurate").
- Membuat modul **Monitoring Server & VPS** (`/dashboard/servers`):
  - Kartu KPI interaktif: Total Server, Server Online, Server Offline, VPS Cloud, Server Fisik.
  - Toolbar filter: Pencarian hostname/IP/OS, filter tipe (VPS / Fisik), filter status.
  - Tabel server responsif sesuai Master Desain Emerald Enterprise.
- Membuat modul **Monitoring Domain, Hosting & Email** (`/dashboard/subscriptions`):
  - Kartu KPI interaktif: Total Layanan, Segera Expired (< 30 Hari), Sudah Expired, Layanan Aman (> 30 Hari).
  - Indikator sisa hari (countdown badges): Merah (Expired / < 7 Hari), Kuning (< 30 Hari), Hijau (Aman).
  - Filter kategori: Domain, Cloud Hosting, Email Bisnis, Sertifikat SSL.
  - Detail informasi: Nama Domain/Layanan, Provider/Registrar, Biaya Perpanjangan, Periode Siklus, Akun/PIC.
- Memastikan navigasi sidebar dan breadcrumbs terintegrasi secara mulus.
- Memastikan 100% test lulus dan lolos typecheck TypeScript (`tsc --noEmit`).

### Non-Goals
- Tidak mengubah integrasi agent Accurate yang sudah ada di port telemetry.
- Tidak mengubah skema tabel database inti yang sudah berjalan.

---

## 3. Data Model & Architecture

### 3.1. Server & VPS Model
Menggunakan endpoint `/infrastructure/servers` yang sudah didukung tabel `servers` di database:
- `id`: number
- `hostname` / `serverCode`: string
- `name`: string
- `ipAddress`: string
- `serverType`: 'VPS' | 'Physical' | 'Cloud'
- `provider`: string (misal: DigitalOcean, AWS, IDCloudHost, On-Premise)
- `os`: string
- `specs`: string (CPU, RAM, Disk)
- `status`: 'Online' | 'Offline'
- `uptimeSeconds`: number
- `lastSeenAt`: string

### 3.2. Domain, Hosting & Email Subscription Model
Struktur data layanan langganan web & email:
- `id`: number
- `name`: string (e.g. `fastpec.co.id`, `gajianich.com`)
- `category`: 'Domain' | 'Hosting' | 'Email' | 'SSL'
- `provider`: string (e.g. Niagahoster, Rumahweb, Cloudflare, Google Workspace, Microsoft)
- `registrationDate`: string
- `expirationDate`: string
- `billingCycle`: 'Tahunan' | 'Bulanan' | '2 Tahunan'
- `renewalCost`: number
- `autoRenew`: boolean
- `accountPic`: string
- `notes`: string
- `status`: 'Active' | 'Expiring Soon' | 'Expired'

Perhitungan Hari Sisa (Days Remaining):
$$\Delta \text{days} = \left\lfloor \frac{T_{\text{expiry}} - T_{\text{now}}}{1000 \times 60 \times 60 \times 24} \right\rfloor$$
- $\Delta \text{days} \le 0$: `Expired` (Merah pekat)
- $0 < \Delta \text{days} \le 30$: `Segera Berakhir` (Kuning/Amber warning)
- $\Delta \text{days} > 30$: `Aktif / Aman` (Emerald/Hijau)

---

## 4. UI/UX Design System Compliance

Mematuhi 6 Pilar Master Desain (`UI_DESIGN_SYSTEM_GUIDE.md`):
1. **Header Baku:** Ikon kotak emerald (`p-2 bg-emerald-600 rounded-xl text-white`), Judul H1 extrabold, sub-judul deskriptif, dan tombol aksi (Primary emerald & Secondary putih).
2. **Keseragaman Workspace:** `<div className="space-y-6">` tanpa pembatas sempit `max-w-5xl`.
3. **Kartu KPI Interaktif:** Ringkasan metrik yang dapat diklik langsung untuk memfilter tabel dengan ring aktif dan badge "Aktif".
4. **Toolbar Filter Rapi:** Panel putih terpisah (`rounded-2xl p-4`) berisi search input fleksibel, dropdown filter, dan tombol reset filter.
5. **Tabel, Tagging & Aksi Berbasis Ikon:** StatusBadge dengan dot semantik, action buttons berbasis ikon dengan tooltip, serta TablePagination di footer.
6. **Data Reaktif:** Tanpa tombol refresh manual.

---

## 5. Verification Plan
- Unit tests navigasi & route permission: `npx tsx --test src/lib/access/routes.test.mjs`
- Full test suite: `npm test`
- Typecheck: `npx tsc --noEmit`
- Verifikasi visual alur navigasi dan highlight menu.

