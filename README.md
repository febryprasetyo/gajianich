# AMS ITSM App

A comprehensive Asset Management System (AMS) and IT Service Management (ITSM) platform built with modern full-stack technologies. This application provides enterprise-grade asset tracking, infrastructure management, ticket handling, license management, and employee administration.

## Stack

- **Language:** TypeScript
- **Backend:** Node.js + Express.js
- **Frontend:** Next.js (Standalone build) with React
- **Database:** PostgreSQL with Drizzle ORM (Journal-based migrations)
- **Reverse Proxy / Ingress:** Nginx (Same-origin routing)
- **Containerization & Deployment:** Docker Compose, GitHub Actions, LAN SSH deployment

---

## Production Operations

Deployment scripts and configuration are in `deploy/`. Use the isolated LAN
workflow with `npm run prod:init`, `npm run prod:release -- <unique-version>`,
`npm run prod:status`, and `npm run prod:backup`. Runtime credentials and backups
are stored outside this repository. Internal documentation is kept locally.

---

## Quick Start (Development)

The fastest way to run the entire AMS stack locally or on the development server:

```bash
# 1. Clone repository
git clone https://github.com/<owner>/gajianich.git
cd gajianich

# 2. Setup environment files
cp .env.example .env
cp backend/.env.example backend/.env

# 3. Start development stack (PostgreSQL, Backend, Frontend with hot-reload)
npm run dev:up

# 4. Apply database migrations
docker compose -f compose.dev.yml exec backend npm run db:migrate

# 5. (Optional) Seed initial data
docker compose -f compose.dev.yml exec backend npm run seed
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api/v1
- **Readiness Check:** http://localhost:5000/health/ready
- **PostgreSQL:** `127.0.0.1:5432` (`ams_dev_db`)

---

## Development Commands

```bash
npm run dev:up        # Start development containers in background
npm run dev:logs      # View streaming logs from dev containers
npm run dev:check     # Validate Compose syntax and check running status
npm run dev:down      # Stop development containers
npm run ci            # Run full local validation pipeline (lint, test, build)
```

---

## Production Architecture

The active office deployment uses `deploy/compose.lan.yml`: Nginx, standalone
Next.js, Express, and PostgreSQL in the separate `ams-live` Compose project.
Production is available at http://192.168.10.23:8080. Development runs on port 3000.
The database and backend have no published host ports. The LAN deployment currently uses HTTP within the office subnet.
Use the production commands above for releases and backups.

`deploy/compose.prod.yml` and the GHCR scripts are a separate deployment path
for a host with PostgreSQL and an upstream TLS proxy. They are not the active
LAN deployment. A container replacement can cause a brief interruption; schema
migrations are not automatically reversed during an application rollback.

## Design Master

Before adding menus, pages, features, or styles, read [DESIGN.md](DESIGN.md) and the
[GAJIANICH / AMS UI design master](UI_DESIGN_SYSTEM_GUIDE.md). New modules follow the
existing Emerald Enterprise theme and shared components. Page-specific notes cannot
replace the application's visual identity.


### Permintaan barang GA

Menu **GA → Permintaan Barang** menggunakan izin `ga.requests.view` dan
`ga.requests.create`. Migrasi `0018` menambahkan tabel dan role **GA Staff**;
admin dapat memberikan role tersebut melalui Access Control. Jalankan migrasi
backend sebelum menjalankan versi aplikasi ini (`npm run db:migrate` di `backend/`).

Setiap item wajib memiliki 1–3 gambar PNG/JPEG/WebP, maksimal 20 item per
pengajuan. Pengguna dapat memilih file atau paste screenshot ke area bukti harga.
Gambar dikompres di browser (maksimal 500 KB) dan divalidasi serta dikodekan ulang
ke WebP di server. Estimasi harga adalah rupiah per unit; subtotal dihitung ulang
di backend. Pengajuan, barang, dan metadata lampiran disimpan dalam satu transaksi.

File disimpan di `GA_STORAGE_DIR` (default `backend/data/ga-evidence` jika server
dijalankan dari `backend/`), terpisah dari database. Compose memakai volume
persisten `ga_evidence` (development: `ams_dev_ga_evidence`). Docker image membuat
direktori dengan kepemilikan user aplikasi. Jangan menghapus volume saat mengganti
container. Akses file melalui API memerlukan autentikasi dan izin melihat GA;
folder tidak disajikan sebagai static/public. File identik dalam satu pengajuan
menggunakan satu salinan, dan kegagalan transaksi membersihkan file pengajuan itu.
Tidak ada file server untuk screenshot formulir yang dibatalkan sebelum simpan.

**Backup harus mencakup database dan volume lampiran**. `pg_dump` saja tidak
menyertakan gambar. Contoh backup file menggunakan compose deployment aktif:
`docker compose exec -T backend tar -C /app/data -czf - ga-evidence > ga-evidence.tar.gz`.
Pulihkan arsip ke `/app/data` di volume backend bersama backup database yang cocok.
File yang tersimpan dipertahankan sebagai bukti; belum ada penghapusan arsip otomatis.
Cetak formulir menyediakan bagian tanda tangan sesuai PDF. Persetujuan elektronik
dan negosiasi purchasing belum menjadi bagian implementasi ini.
