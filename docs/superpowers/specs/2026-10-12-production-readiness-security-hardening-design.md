# Design Spec: Production Readiness & Security Hardening

- **Tanggal**: 2026-10-12
- **Status**: Draft / Menunggu Review
- **Pemilik**: Antigravity & Fastpec Engineering
- **Ruang Lingkup**: Security Hardening, Secret Isolation, File Permissions, Proxy HTTPS/TLS, Strict Env Validation, CORS & Rate Limiting

---

## 1. Summary & Problem Statement

Berdasarkan audit pra-rilis production terhadap repository GAJIANICH App, ditemukan beberapa celah keamanan dan kesiapan infrastruktur yang harus diperbaiki sebelum aplikasi dinyatakan siap live:
1. **File Permissions**: Berkas `.env` dan `backend/.env` berizin `664` (`-rw-rw-r--`), yang memungkinkan akun lokal lain membaca credential dan anggota grup memodifikasinya.
2. **Git Ignore Leaks Potential**: `.gitignore` pada root dan `backend/` hanya mengecualikan `.env` dan `.env.local`, namun variasi seperti `.env.production` atau `.env.staging` rentan ter-commit tanpa sengaja.
3. **Template Environment**: Template `deploy/.env.example` belum mencantumkan `AGENT_API_KEY`, sehingga deployment container production berisiko gagal saat preflight.
4. **Weak Env Validation**: Validasi `backend/src/config/env.ts` hanya memeriksa keberadaan string, sehingga rahasia pendek, bernilai placeholder (`replace-with...`), atau identik antara JWT Secret dan Refresh Secret tetap lolos.
5. **Proxy TLS & HTTPS**: Konfigurasi Nginx proxy pada `deploy/nginx.conf` hanya melayani port HTTP 80 tanpa kesiapan TLS/SSL termination, HSTS, maupun redirect scheme dari load balancer eksternal.
6. **API Access Control & Rate Limiting**: `backend/src/app.ts` menggunakan CORS terbuka tanpa batasan origin, serta rute autentikasi (`/api/v1/auth/login`) belum memiliki proteksi rate limiting terhadap brute-force password.

---

## 2. Goals & Non-Goals

### Goals
1. Mengubah izin berkas konfigurasi lokal `.env` dan `backend/.env` menjadi `600` (`-rw-------`).
2. Memperbaiki aturan `.gitignore` di root dan `backend/.gitignore` menjadi pola komprehensif `.env*` dengan pengecualian khusus template `!.env.example`.
3. Memperbarui `deploy/.env.example` dengan `AGENT_API_KEY` dan dokumentasi generator secret berkekuatan tinggi (minimal 32 karakter acak).
4. Menerapkan validasi ketat pada `backend/src/config/env.ts` saat `NODE_ENV === 'production'`:
   - Panjang minimum token/secret: minimal 32 karakter untuk `JWT_SECRET`, `JWT_REFRESH_SECRET`, dan `AGENT_API_KEY`.
   - Melarang kata kunci placeholder/dev: `dev-`, `ci-`, `replace-with`, `default`, `secret`, `1234`.
   - Memastikan `JWT_SECRET !== JWT_REFRESH_SECRET` dan keduanya berbeda dari `AGENT_API_KEY`.
   - Memvalidasi kredensial `DATABASE_URL`: melarang default password seperti `postgres`, `admin`, atau password di bawah 16 karakter di production.
5. Memperbarui `deploy/nginx.conf` agar mendukung HTTPS / TLS termination, HTTP-to-HTTPS redirection (termasuk deteksi `X-Forwarded-Proto` dari Cloudflare / External Reverse Proxy), serta security response headers (HSTS, X-Content-Type-Options, X-Frame-Options).
6. Menambahkan CORS berbasis konfigurasi origin (`CORS_ALLOWED_ORIGINS` dengan default same-origin / localhost aman) dan middleware rate limiting untuk rute `/api/v1/auth/login` (misal 5 percobaan gagal per 15 menit per IP).

### Non-Goals
1. Tidak mengubah password database lokal/development yang sedang aktif di runtime development saat ini secara paksa (agar tidak memutus service yang sedang berjalan), melainkan menyediakan panduan dan script rotasi kredensial production terpisah.
2. Tidak menyimpan rahasia production riil di dalam kode atau riwayat Git.

---

## 3. Architecture & Security Specifications

### 3.1 File Permissions & Git Hygiene
- Perintah eksekusi:
  ```bash
  chmod 600 .env backend/.env
  ```
- Root `.gitignore` & `backend/.gitignore`:
  ```gitignore
  .env*
  !.env.example
  ```

### 3.2 Deployment Template (`deploy/.env.example`)
Menambahkan variabel wajib dan panduan pembangkitan secret:
```dotenv
APP_VERSION=v1.0.0
GHCR_OWNER=fastpec
DATABASE_URL=postgresql://gajianich_app:<GENERATE_STRONG_RANDOM_PASSWORD_MIN_16_CHARS>@host.docker.internal:5432/gajianich_prod_db
JWT_SECRET=<GENERATE_WITH_OPENSSL_RAND_HEX_32>
JWT_REFRESH_SECRET=<GENERATE_WITH_OPENSSL_RAND_HEX_32>
AGENT_API_KEY=<GENERATE_WITH_OPENSSL_RAND_HEX_32>
ACCURATE_LICENSE_SERVER_URL=http://192.168.10.160:6688
CORS_ALLOWED_ORIGINS=https://gajianich.yourdomain.com
```

### 3.3 Strict Environment Validation (`backend/src/config/env.ts`)
Tambahan aturan validasi khusus bila `NODE_ENV === 'production'`:
- **Length Check**: `jwtSecret.length >= 32`, `jwtRefreshSecret.length >= 32`, `agentApiKey.length >= 32`.
- **Distinctness**: `jwtSecret !== jwtRefreshSecret` dan `jwtSecret !== agentApiKey`.
- **Anti-Placeholder**:
  ```typescript
  const weakPatterns = [/dev/i, /ci/i, /replace-with/i, /secret/i, /password/i, /1234/];
  ```
  Jika ada yang cocok pada mode production, lempar error validasi eksplisit.
- **Database URL Validation**: URL harus mengandung username dan password; tolak jika password mengandung `postgres`, `admin`, atau panjang password `< 16`.

### 3.4 Ingress & Nginx Security (`deploy/nginx.conf`)
- Menyediakan blok konfigurasi ganda:
  - Port 80: Melayani endpoint health `/healthz` dan me-redirect seluruh traffic HTTP ke HTTPS (`return 301 https://$host$request_uri;`) bila SSL diaktifkan atau bila `X-Forwarded-Proto != https`.
  - Port 443 (SSL): Opsional/siap pakai jika sertifikat TLS di-mount pada `/etc/nginx/certs/`.
  - Header Keamanan:
    - `Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`
    - `X-Frame-Options "SAMEORIGIN" always;`
    - `X-Content-Type-Options "nosniff" always;`
    - `Referrer-Policy "strict-origin-when-cross-origin" always;`

### 3.5 API Access & Brute-Force Protection
1. **CORS Hardening**:
   - `cors({ origin: allowedOrigins, credentials: true })`
   - Pada development/test: memperbolehkan `localhost:3000` dan dev client.
   - Pada production: mengambil dari `CORS_ALLOWED_ORIGINS` (bila kosong, hanya same-origin / internal proxy).
2. **Rate Limiting Login**:
   - Menerapkan in-memory sliding-window limiter khusus rute `POST /api/v1/auth/login`:
     - Maksimum 5 percobaan gagal per IP dalam rentang waktu 15 menit.
     - Respons HTTP 429 Too Many Requests jika melebihi kuota.

---

## 4. Verification Plan

1. **Unit Tests**:
   - Pengujian `loadEnv()` di `backend/src/config/env.test.ts` untuk memverifikasi penolakan secret pendek, secret identik, atau pola placeholder pada production.
   - Pengujian rate limiter login di `backend/src/controllers/authController.test.ts` (memverifikasi HTTP 429 setelah N request beruntun).
2. **Static & Build Checks**:
   - `npm run dev:check` & `bash scripts/validate-compose.sh prod`
   - `npm test --prefix backend`
   - `npm run build --prefix backend`
   - `npm run lint --prefix frontend`
3. **Permissions Check**:
   - Verifikasi stat mode berkas `.env` dan `backend/.env` adalah `600`.
