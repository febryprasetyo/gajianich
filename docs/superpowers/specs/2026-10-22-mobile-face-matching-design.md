# Design Spec: Lightweight & High-Speed Mobile Face Matching (PWA)
- **Tanggal**: 2026-10-22
- **Fitur**: Pencocokan Wajah Otomatis (*Automated Face Matching & Liveness Check*) untuk Presensi Mobile PWA
- **Status**: Draft — Menunggu Review & Persetujuan Pengguna

---

## 1. Summary & Problem Statement

Untuk meningkatkan integritas presensi mobile tanpa mengorbankan performa, aplikasi membutuhkan mekanisme **pencocokan wajah otomatis (*face matching*)** yang memenuhi tiga syarat utama pengguna:
1. **Ukuran Kecil (*Small Bundle Size*)**: Ukuran model/aset di bawah ~1.5 - 2 MB, diunduh secara *lazy load* (hanya saat kamera absensi dibuka), dan di-cache permanen di browser PWA karyawan.
2. **Respons Cepat (*Low Latency*)**: Waktu deteksi dan verifikasi di bawah 300 milidetik langsung di perangkat pengguna (*client-side on-device inference* via WebAssembly / WebGL), tanpa lag.
3. **Akurasi & Anti-Spoofing **Liveness Detection*)**: Memverifikasi kecocokan wajah terhadap profil karyawan yang terdaftar serta mencegah manipulasi foto statis (kertas foto/layar HP lain).

---

## 2. Goals & Non-Goals

### Goals
- Ekstraksi 128-dimensi vektor biometrik wajah (*face descriptor*) secara instan di browser HP.
- Pencocokan biometrik berbasis **Euclidean Distance**:
  - Nilai jarak D < 0.45 diklasifikasikan sebagai **Cocok / Valid** (tingkat kemiripan >= 85%).
  - Nilai jarak D >= 0.45 diklasifikasikan sebagai **Wajah Tidak Cocok** (*Mismatch*).
- Anti-Spoofing Ringan (*Liveness Check**: Memvalidasi kehadiran manusia hidup (misal: rasio bukaan mata / kedipan mata sebelum konfirmasi absensi).
- Sinkronisasi Master Wajah: Pendaftaran satu kali (*Enrollment*) di menu profil karyawan (/data/profile), tersimpan di tabel database attendance_face_profiles.
- Fallback & Reliability: Jika perangkat lawas tidak mendukung akselerasi WebGL, sediakan mode panduan wajah dengan verifikasi foto manual oleh HRD agar karyawan tidak terblokir bekerja.

### Non-Goals
- Tidak menggunakan model deep-learning server-side raksasa berbasis Python (seperti InsightFace/ResNet 500MB+) yang membebani CPU/GPU server hosting dan membutuhkan biaya server tinggi.
- Tidak membutuhkan sensor kamera 3D inframerah khusus (harus dapat berjalan di semua kamera depan HP standar Android dan iPhone).in