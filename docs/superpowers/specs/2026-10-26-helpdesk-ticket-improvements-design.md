# Design Spec: Peningkatan Halaman Sistem Tiket Helpdesk IT

- **Tanggal**: 2026-10-26
- **Status**: Siap Direview (Pending User Approval)
- **Topik**: Refinement KPI Cards Interaktif, Penghapusan Delay Rata-Rata, Reset Data Dummy, dan Penyesuaian Format Delay Pencatatan.

---

## 1. Summary & Problem Statement

Halaman Helpdesk Tiket IT (`/dashboard/tickets`) telah beroperasi dengan modular architecture. Namun, terdapat beberapa catatan evaluasi dari pengguna:
1. Kartu ringkasan KPI (Summary Cards) saat ini bersifat statis (hanya menampilkan angka) dan belum dapat digunakan sebagai jalan pintas (shortcut filter) untuk langsung menyaring daftar tiket di bawahnya.
2. Metrik "Rata-rata Delay" pada kartu KPI dianggap tidak relevan/redundant untuk ringkasan operasional harian dan perlu dihapus.
3. Database saat ini terisi dengan puluhan data dummy dan residu pengujian integrasi otomatis (seperti `TKT-STAT-...`, `TKT-TEST-...`, `TCK-COV-...`). Pengguna meminta agar seluruh isi tabel tiket di-reset bersih (total clean reset).
4. Penanda keterlambatan pencatatan saat ini menampilkan selisih menit (`Dicatat: +n menit kemudian`), padahal perbedaan menit atau jam pada hari kalender yang sama adalah hal lumrah dalam operasional IT helpdesk dan tidak perlu dianggap terlambat/diberi label delay. Label delay hanya perlu dimunculkan jika tiket dicatat minimal selisih hari kalender berikutnya (`+n hari kemudian`).

---

## 2. Goals & Non-Goals

### Goals:
1. **Interactive KPI Filters**:
   - Menjadikan kartu KPI di atas tabel tiket interaktif dan dapat diklik (cursor pointer, hover feedback, active state indicator).
   - Menghubungkan klik kartu dengan filter tiket:
     - **Tiket Terbuka**: menyaring tiket dengan status `OPEN`.
     - **Sedang Dikerjakan**: menyaring tiket dengan status `IN_PROGRESS`.
     - **Selesai Hari Ini**: menyaring tiket dengan status `RESOLVED` (atau terselesaikan hari ini).
     - **Tiket Kritis**: menyaring tiket dengan prioritas `CRITICAL`.
     - **Kepatuhan SLA**: menyaring tiket yang mengalami **SLA Breached** (melewati batas waktu target).
   - Mengizinkan toggle on/off: mengklik kartu aktif yang sama akan mematikan filter (reset ke semua).
2. **Hapus Rata-Rata Delay**:
   - Menghilangkan kartu KPI "Rata-rata Delay" dari `TicketStats.tsx`.
   - Mengubah layout grid dari 6 kolom menjadi 5 kolom responsif (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`).
3. **Pembersihan Bersih Data Dummy (Total Reset)**:
   - Mengosongkan data dummy tabel `helpdesk_attachments`, `helpdesk_ticket_comments`, `helpdesk_ticket_audit`, `helpdesk_tickets`, dan mereset `helpdesk_ticket_counters`.
   - Menggunakan mekanisme aman penanganan trigger append-only audit (`trg_helpdesk_ticket_audit_append_only`) selama proses pembersihan administratif.
4. **Format Keterlambatan Pencatatan Minimal +N Hari**:
   - Jika tiket dicatat pada **hari kalender yang sama** dengan waktu laporan diterima (`reported_at`), **TIDAK menampilkan pesan/badge delay** di daftar tiket.
   - Jika dicatat minimal 1 hari kalender kemudian (`diffDays >= 1`), tampilkan `Dicatat: +N hari kemudian`.
   - Pada halaman detail tiket, jika di hari yang sama, tampilkan `Hari yang sama (Tepat Waktu)` berwarna emerald, dan jika terlambat tampilkan `+N hari kemudian` berwarna amber.

### Non-Goals:
- Tidak mengubah skema tabel Drizzle ORM atau menambahkan kolom baru ke database.
- Tidak mengubah kontrak endpoint status update, upload attachment, atau alur 3 identitas helpdesk.
- Tidak mengubah perhitungan persentase kepatuhan SLA formula backend, hanya menambahkan parameter query `slaStatus=BREACHED` pada service tiket.

---

## 3. Data Model & Backend API Specifications

### Backend Query Filter Enhancement: `slaStatus`
Di `backend/src/modules/ticket/service.ts`:
- Tambahkan filter opsional `slaStatus?: "BREACHED" | "COMPLIANT"` pada `TicketListFilters`:
```typescript
if (filters.slaStatus === "BREACHED") {
  conditions.push(`(
    (status IN ('RESOLVED', 'CLOSED') AND resolved_at IS NOT NULL AND (EXTRACT(EPOCH FROM (resolved_at - reported_at)) / 60) >
      CASE priority
        WHEN 'CRITICAL' THEN 60
        WHEN 'HIGH' THEN 240
        WHEN 'MEDIUM' THEN 480
        ELSE 1440
      END)
    OR
    (status IN ('OPEN', 'IN_PROGRESS', 'PENDING') AND (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - reported_at)) / 60) >
      CASE priority
        WHEN 'CRITICAL' THEN 60
        WHEN 'HIGH' THEN 240
        WHEN 'MEDIUM' THEN 480
        ELSE 1440
      END)
  )`);
}
```

### Script Reset Data Dummy
Script administratif satu kali jalan di `backend/scripts/reset-helpdesk-data.ts`:
- Disable trigger `trg_helpdesk_ticket_audit_append_only` & `trg_helpdesk_ticket_audit_truncate` sementara dalam sesi transaksi.
- Truncate cascade atau delete `helpdesk_attachments`, `helpdesk_ticket_comments`, `helpdesk_ticket_audit`, `helpdesk_tickets`, `helpdesk_ticket_counters`.
- Enable kembali trigger append-only.

---

## 4. Frontend Component Specifications

### 1. `TicketStats.tsx`
- Props:
  - `stats: TicketStatsData | null`
  - `loading?: boolean`
  - `activeFilterKey?: string | null`
  - `onSelectFilter?: (filterType: "open" | "in_progress" | "resolved" | "critical" | "sla_breached") => void`
- 5 Kartu KPI:
  1. **Tiket Terbuka** (Key: `open`) -> status `OPEN`
  2. **Sedang Dikerjakan** (Key: `in_progress`) -> status `IN_PROGRESS`
  3. **Selesai Hari Ini** (Key: `resolved`) -> status `RESOLVED`
  4. **Tiket Kritis** (Key: `critical`) -> priority `CRITICAL`
  5. **Kepatuhan SLA** (Key: `sla_breached`) -> `slaStatus: "BREACHED"`
- Interaktivitas:
  - Cursor `pointer` dengan hover `border-emerald-300`, `shadow-xs`.
  - Jika aktif: `ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/30`.
  - Dilengkapi badge kecil "Aktif" atau outline tebal saat kartu sedang aktif terpilih.

### 2. Format Delay Helper (`constants.ts`)
Fungsi `calculateDelayDays(reportedAt: string, createdAt: string): number`:
- Mengambil tanggal kalender lokal `reportedAt` dan `createdAt` (set waktu ke 00:00:00).
- `diffDays = Math.round((createdMidnight - reportedMidnight) / (1000 * 3600 * 24))`.
- Return `Math.max(0, diffDays)`.

Fungsi `formatDelayText(reportedAt: string, createdAt: string): string | null`:
- Jika `diffDays <= 0` (hari kalender sama) -> return `null`.
- Jika `diffDays >= 1` -> return `+${diffDays} hari kemudian`.

### 3. `TicketList.tsx` & `TicketDetail.tsx`
- Pada `TicketList.tsx`:
  - `const delayText = formatDelayText(t.reportedAt, t.createdAt);`
  - Tampilkan hanya jika `delayText !== null`:
    ```tsx
    {delayText && (
      <div className="text-[10px] text-amber-600 font-medium mt-0.5">
        Dicatat: {delayText}
      </div>
    )}
    ```
- Pada `TicketDetail.tsx`:
  - Tampilkan `delayText ? delayText : "Hari yang sama (Tepat Waktu)"`.

---

## 5. Security & Testing

- RBAC dan sanitasi SQL: `slaStatus` di backend menggunakan whitelist nilai enum `"BREACHED" | "COMPLIANT"`.
- Automated test:
  - Unit test fungsi `calculateDelayDays` & `formatDelayText` dengan berbagai variasi tanggal (selang 10 menit hari sama, selang 12 jam hari sama, berganti hari jam 00:01, selang 2 hari).
  - Integration test filter `slaStatus=BREACHED` di backend tickets API.
  - Test interaksi filter di frontend.
