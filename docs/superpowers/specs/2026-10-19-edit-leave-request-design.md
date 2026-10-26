# Design Spec: Fitur Edit Permohonan Cuti Belum Disetujui (Status PENDING)

- **Tanggal**: 2026-10-19
- **Fitur**: Edit Permohonan Cuti (Pending Leave Request Edit)
- **Status**: Proposed (Menunggu Persetujuan Pengguna)

---

## 1. Summary & Problem Statement
Saat ini karyawan atau HR yang telah membuat permohonan cuti tidak memiliki opsi untuk mengedit data permohonan jika terdapat salah ketik tanggal, alasan, atau durasi hari cuti sebelum dokumen formulir disetujui secara resmi oleh atasan/HR (status `PENDING`). Pengguna terpaksa harus menghapus draft dan mengulang input seluruh data dari awal.

Dibutuhkan fitur untuk mengedit permohonan cuti yang berstatus `PENDING` dengan penyesuaian saldo cuti tahunan yang konsisten, aman secara transaksional, dan menjaga validasi batas tahun kalender.

---

## 2. Goals & Non-Goals

### Goals:
1. **Akses Edit Berdasarkan Status**:
   - Hanya permohonan dengan status `PENDING` (atau `DRAFT`) yang dapat diedit.
   - Permohonan dengan status `APPROVED`, `REJECTED`, atau `CANCELLED` dikunci secara permanen (read-only).
2. **Field yang Dapat Diubah**:
   - Tipe cuti (`leaveType`: `ANNUAL` atau `SPECIAL`), alasan khusus (`specialLeaveReason`), alasan (`reason`).
   - Tanggal cuti (`startDate`, `endDate`), durasi hari kerja (`durationDays`), dan tanggal kembali bekerja (`resumeWorkDate`).
   - Informasi serah terima tugas (`handoverToEmployeeId`, `handoverTask`, `emergencyPhone`).
3. **Kalkulasi Saldo Cuti yang Akurat (Transactional Safe)**:
   - Jika durasi cuti tahunan berubah: hitung selisih kuota (`delta = newDuration - oldDuration`).
   - Validasi sisa saldo mencukupi sebelum menyimpan.
   - Sinkronisasi `usedQuota` pada tabel `leaveBalances` dan pembaruan `snapshotRemainingAfter`.
   - Mengakomodasi pergantian tipe cuti antara `ANNUAL` dan `SPECIAL` secara proporsional.
4. **Validasi Batas Tahun Kalender**:
   - `startYear === endYear` (tidak boleh lintas tahun).
   - Tahun cuti harus sesuai dengan tahun berjalan (`>= currentYear`).
5. **UI & Integrasi Halaman**:
   - Tombol **Edit** berikon `<Edit className="w-4 h-4 text-amber-600" />` pada tabel daftar permohonan (`/dashboard/leaves`), khusus baris yang berstatus `PENDING`.
   - Halaman edit `/dashboard/leaves/[id]/edit` dengan layout standar form master, pre-populating data pemohon, saldo rill, dan detail pengajuan yang ada.

### Non-Goals:
- Mengubah nama pemohon (`employeeId`): Identitas pemohon dikunci pada mode edit untuk mencegah disrupsi snapshot saldo dan integritas nomor permohonan.
- Mengedit permohonan yang sudah disetujui (`APPROVED`): Begitu dokumen disetujui fisik oleh HR, dokumen menjadi arsip resmi dan tidak dapat diubah tanpa prosedur pembatalan formal.

---

## 3. Data Model & Balance Adjustment Logic

### Perhitungan Selisih Saldo Cuti (Dalam Database Transaction):
1. Ambil data permohonan cuti aktif `request` berdasarkan `id`.
2. Validasi status:
   $$\text{request.status} == \text{'PENDING'}$$
3. Ambil `balance` karyawan untuk tahun bersangkutan dari `leaveBalances`.
4. Hitung kuota saldo cuti:
   - **Kondisi A: ANNUAL -> ANNUAL**:
     $$\text{delta} = \text{newDuration} - \text{oldDuration}$$
     $$\text{currentAvailable} = \text{balanceCalc.availableBefore}$$
     Jika $\text{newDuration} > (\text{currentAvailable} + \text{oldDuration})$, tolak (saldo tidak cukup).
     $$\text{newUsedQuota} = \text{balance.usedQuota} + \text{delta}$$
     $$\text{newRemainingAfter} = \text{request.snapshotAvailableBefore} - \text{newDuration}$$
   - **Kondisi B: ANNUAL -> SPECIAL**:
     $$\text{newUsedQuota} = \text{balance.usedQuota} - \text{oldDuration}$$
     $$\text{newRemainingAfter} = \text{request.snapshotAvailableBefore}$$
   - **Kondisi C: SPECIAL -> ANNUAL**:
     Jika $\text{newDuration} > \text{balanceCalc.availableBefore}$, tolak.
     $$\text{newUsedQuota} = \text{balance.usedQuota} + \text{newDuration}$$
     $$\text{newRemainingAfter} = \text{request.snapshotAvailableBefore} - \text{newDuration}$$
   - **Kondisi D: SPECIAL -> SPECIAL**:
     Tidak ada mutasi saldo kuota tahunan.
5. Jalankan `tx.update(leaveBalances)` dan `tx.update(leaveRequests)`.

---

## 4. API Specification

### Endpoint:
`PUT /api/v1/leaves/requests/:id`

- **Request Payload**:
```json
{
  "leaveType": "ANNUAL",
  "specialLeaveReason": null,
  "reason": "Keperluan keluarga yang mendesak",
  "startDate": "2026-10-26",
  "endDate": "2026-10-27",
  "durationDays": 2,
  "resumeWorkDate": "2026-10-28",
  "handoverToEmployeeId": 12,
  "handoverTask": "Monitoring tiket operasional",
  "emergencyPhone": "08123456789"
}
```

- **Validation Rules (Zod)**:
  - `startDate`, `endDate`: format `YYYY-MM-DD`, `startYear === endYear`.
  - `durationDays`: integer positif $\ge 1$.
  - `reason`: string tidak kosong.

- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Permohonan cuti LV-202610-0002 berhasil diperbarui.",
  "data": { "id": 8, "requestNumber": "LV-202610-0002", "status": "PENDING" }
}
```

- **Error Response (400 / 403 / 404)**:
  - `400`: Saldo cuti tidak mencukupi atau format tanggal lintas tahun.
  - `403`: Permohonan cuti sudah disetujui / ditolak, tidak dapat diedit lagi.
  - `404`: Permohonan cuti tidak ditemukan.

---

## 5. Frontend UI/UX

1. **Tabel Permohonan Cuti (`/dashboard/leaves`)**:
   - Pada kolom "Aksi":
     - Jika `status === 'PENDING'`: Tampilkan tombol **View** (`<Eye />`), tombol **Edit** (`<Edit className="w-4 h-4 text-amber-600" />`), tombol **Approve HR** (`<CheckCircle2 className="w-4 h-4 text-emerald-600" />`), dan tombol **Hapus Draft** (`<Trash2 className="w-4 h-4 text-rose-600" />`).
     - Jika `status === 'APPROVED'`: Hanya tampilkan tombol **View** (`<Eye />`).
2. **Halaman Edit (`/dashboard/leaves/[id]/edit`)**:
   - Header: `"Edit Permohonan Cuti - No: LV-XXXXXX-XXXX"` dengan tombol *"Kembali ke Daftar"*.
   - Menggunakan container `LeaveRequestForm` yang mendukung mode `edit` dengan ID permohonan.
   - Menampilkan kartu data pemohon (read-only), saldo rill, dan form detail permohonan terisi otomatis.
   - Tombol footer: *"Batal"* dan *"Simpan Perubahan"*.
   - Saat disimpan berhasil: Redirect menggunakan `router.replace('/dashboard/leaves/' + id + '/print')` ke halaman view permohonan.

---

## 6. Security & Integrity
- Proteksi mutasi saldo menggunakan DB Transaction boundary.
- Mencegah race condition saldo negatif.
- Mencegah edit pada dokumen cuti berstatus `APPROVED`.
