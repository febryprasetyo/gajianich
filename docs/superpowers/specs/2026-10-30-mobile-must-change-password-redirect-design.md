# Design Spec: Mobile Must Change Password Redirect & Route Guard

## 1. Summary & Problem Statement
Ketika pengguna melakukan login di perangkat mobile (terutama pengguna dengan role `Employee` atau pengguna yang memiliki `mustChangePassword: true` karena memakai password sementara), sistem tidak mengarahkan pengguna ke halaman ganti password (`/change-password`), melainkan tetap berada di halaman login (`/login`). Lebih lanjut, jika halaman di-refresh, pengguna justru masuk ke menu utama (`/m/beranda` atau `/dashboard`), padahal di backend seluruh endpoint operasional diblokir dengan HTTP 403 Forbidden (`Password change required before accessing the application`).

### Root Cause Analysis:
1. **Soft Navigation Hang di Mobile/PWA**: Di `frontend/src/app/login/page.tsx`, navigasi setelah login hanya mengandalkan `router.push('/change-password')`. Pada browser mobile, PWA, dan koneksi tunnel, soft transition App Router Next.js dapat menggantung atau terhenti tanpa melakukan perpindahan halaman.
2. **Ketiadaan Guard `mustChangePassword` di Frontend Routing**:
   - Fungsi penentu rute baku `getDefaultRedirectForUser` (`frontend/src/lib/access/routes.ts`) tidak memeriksa flag `mustChangePassword`.
   - `frontend/src/app/page.tsx` (`/`) mengarahkan user langsung ke `getDefaultRedirectForUser(user)`.
   - `frontend/src/app/m/layout.tsx` dan `frontend/src/app/m/beranda/page.tsx` hanya memeriksa keberadaan token, tanpa memvalidasi apakah `user.mustChangePassword === true`.
   - `frontend/src/components/layout/DashboardLayout.tsx` tidak memvalidasi `user.mustChangePassword`.
   - `frontend/src/app/login/page.tsx` tidak memiliki effect penanganan sesi aktif pada saat refresh.
   - Pada halaman `frontend/src/app/change-password/page.tsx`, setelah sukses mengganti password, diarahkan hardcoded ke `/dashboard`, bukan ke rute spesifik mobile (`/m/beranda` untuk karyawan).

---

## 2. Goals & Non-Goals

### Goals:
- **Resilient Mobile Login Navigation**: Redirect setelah login wajib menggunakan kombinasi `router.replace` dan fallback instan `window.location.replace` agar tidak pernah macet di browser mobile / PWA.
- **Strict Route Guarding (Defense in Depth)**:
  - `getDefaultRedirectForUser`: Mengembalikan `'/change-password'` bila `user.mustChangePassword === true`.
  - `/login`: Jika pengguna yang sudah login me-refresh halaman login dan memiliki `mustChangePassword === true`, otomatis diarahkan ke `/change-password`.
  - `/m/*` (`MobileAppLayout` & `beranda`): Jika pengguna memiliki `mustChangePassword === true`, otomatis diarahkan ke `/change-password`.
  - `/dashboard/*` (`DashboardLayout`): Jika pengguna memiliki `mustChangePassword === true`, otomatis diarahkan ke `/change-password`.
  - `proxy.ts`: Memvalidasi payload JWT; jika `payload.mustChangePassword === true`, dialihkan ke `/change-password`.
- **Target Setelah Sukses Ganti Password**:
  - Role `Employee` / `Karyawan` diarahkan ke `/m/beranda`.
  - Role lainnya diarahkan ke `getDefaultRedirectForUser(user)`.
- **Perlindungan Halaman `/change-password`**:
  - Jika belum login, diarahkan ke `/login`.
  - Jika sudah login dan `mustChangePassword === false`, diarahkan ke menu utama sesuai role.

### Non-Goals:
- Tidak mengubah skema database backend maupun algoritma hashing password di backend (sudah tervalidasi dan berfungsi sesuai spesifikasi).

---

## 3. Data Model & Architecture Diffs
Tidak ada perubahan skema database PostgreSQL.
Interface TypeScript pada frontend diselaraskan:
- `frontend/src/lib/access/routes.ts`: Parameter `user` pada `getDefaultRedirectForUser` secara eksplisit mendukung `mustChangePassword?: boolean`.
- `frontend/src/proxy.ts`: Interface `JwtPayload` menambahkan `mustChangePassword?: boolean`.

---

## 4. API & Route Contract
- **POST `/api/v1/auth/login`**: Response payload menyediakan `mustChangePassword: boolean` dan `user.mustChangePassword: boolean`.
- **GET `/api/v1/auth/me`**: Response payload menyediakan `user.mustChangePassword: boolean`.
- **POST `/api/v1/auth/change-password`**: Response payload menyediakan `mustChangePassword: false`.

---

## 5. Security & Edge Cases
1. **Bypass Prevention**: Pengguna dengan password temporary tidak boleh dapat membuka beranda mobile atau dashboard admin melalui URL langsung maupun refresh halaman.
2. **Session Desync**: Saat token atau sesi di-refresh melalui `/auth/me`, state `mustChangePassword` di `AuthContext` tetap tersinkronisasi.
3. **No Infinite Redirect Loop**: Halaman `/change-password` tidak boleh memicu redirect bolak-balik bagi pengguna yang memang memiliki `mustChangePassword === true`.
