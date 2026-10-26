# Implementation Plan: Production Readiness & Security Hardening

- **Tanggal**: 2026-10-12
- **Status**: Selesai
- **Dokumen Desain**: [Design Spec](../specs/2026-10-12-production-readiness-security-hardening-design.md)

---

## Shared Interfaces & Contracts

```typescript
// backend/src/config/env.ts
export interface AppEnv {
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  agentApiKey: string;
  corsAllowedOrigins?: string[];
}
```

---

## Phase-by-Phase Tasks

### Phase 1: File Permissions & Git Ignore Hardening
- [x] Task 1.1: Ubah permission berkas `.env` dan `backend/.env` menjadi `600` (`chmod 600`).
- [x] Task 1.2: Perbarui `.gitignore` di root repository untuk mengabaikan `.env*` dan mengecualikan template `!.env.example`.
- [x] Task 1.3: Perbarui `backend/.gitignore` untuk konsistensi pola `.env*` dan `!.env.example`.
- [x] Task 1.4: Perbarui `deploy/.env.example` untuk mencantumkan `AGENT_API_KEY` dan instruksi generator secret acak.

### Phase 2: Strict Environment Validation & TDD
- [x] Task 2.1: Tulis unit test `backend/src/config/env.test.ts` untuk memverifikasi kegagalan validasi bila:
  - `NODE_ENV === 'production'` dengan secret kurang dari 32 karakter.
  - `NODE_ENV === 'production'` dengan kata placeholder (`replace-with`, `dev-`, `1234`).
  - `NODE_ENV === 'production'` jika `JWT_SECRET === JWT_REFRESH_SECRET`.
  - `NODE_ENV === 'production'` jika password database lemah atau default `postgres`.
- [x] Task 2.2: Implementasikan aturan validasi ketat tersebut di `backend/src/config/env.ts`.
- [x] Task 2.3: Jalankan test runner backend untuk memastikan semua test hijau.

### Phase 3: Proxy HTTPS & Security Headers
- [x] Task 3.1: Perbarui `deploy/nginx.conf` untuk mendukung:
  - Penanganan `X-Forwarded-Proto` (redirect HTTP ke HTTPS bila dari load balancer).
  - Security headers bawaan: HSTS, X-Content-Type-Options nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy.
- [x] Task 3.2: Validasi konfigurasi Nginx dan Compose prod dengan `bash scripts/validate-compose.sh prod`.

### Phase 4: API Access Control & Rate Limiting
- [x] Task 4.1: Terapkan CORS configuration di `backend/src/app.ts` berbasis origin terdaftar atau same-origin.
- [x] Task 4.2: Buat middleware rate limiting autentikasi sederhana/handal untuk rute login (`backend/src/middleware/rateLimiter.ts`).
- [x] Task 4.3: Sambungkan rate limiter ke `backend/src/routes/authRoutes.ts` pada endpoint `POST /login`.
- [x] Task 4.4: Tulis unit test untuk rate limiting auth login.

### Phase 5: Verification Loop & Checklist
- [x] Task 5.1: Jalankan `npm test --prefix backend`.
- [x] Task 5.2: Jalankan `npm run build --prefix backend`.
- [x] Task 5.3: Jalankan `npm test --prefix frontend`.
- [x] Task 5.4: Jalankan `npm run lint --prefix frontend`.
- [x] Task 5.5: Jalankan `npm run dev:check` dan `bash scripts/validate-compose.sh prod`.
- [x] Task 5.6: Commit perubahan bertahap dengan conventional commit.

---

## Verification Commands
```bash
# 1. Verifikasi permission berkas env
stat -c "%a %n" .env backend/.env

# 2. Verifikasi validasi env dan rate limiting backend
npm test --prefix backend

# 3. Verifikasi validasi compose dan nginx
npm run dev:check
bash scripts/validate-compose.sh prod

# 4. Verifikasi kompilasi build
npm run build --prefix backend
npm run build --prefix frontend
```
