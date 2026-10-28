# Frontend Page Refactor — Codex Handoff & Implementation Plan

> **Untuk agen Codex penerima:** Dokumen ini memuat konteks, hasil analisis, batasan, urutan kerja, dan kriteria penerimaan dalam satu file. Saat ditugaskan mengimplementasikan, gunakan skill `superpowers:subagent-driven-development` atau `superpowers:executing-plans` bila tersedia. Jika tidak tersedia, ikuti checklist di dokumen ini tanpa menambah dependency hanya untuk menjalankan workflow.

**Goal:** Merapikan seluruh halaman frontend GAJIANICH dengan memisahkan tanggung jawab dan mengurangi duplikasi melalui komponen kecil yang dapat digunakan ulang, sambil mempertahankan perilaku aplikasi.

**Architecture:** Halaman menjadi pengatur komposisi dan koordinasi fitur. Komponen fitur memiliki tanggung jawab yang jelas; draft form berada dekat form, data server dikelola hook fitur, dan aturan/payload yang digunakan bersama berada di modul domain. Komponen UI bersama tidak bergantung pada endpoint atau aturan bisnis fitur.

**Tech Stack:** Next.js 16.2.12 App Router, React 19.2.4, TypeScript, Tailwind CSS 4, lucide-react, qrcode; API client lokal di `frontend/src/lib/api.ts`.

**Spec:** Spesifikasi dan scope berada di dokumen ini. Tidak memerlukan percakapan sebelumnya atau dokumen desain terpisah.

**Status:** Dokumen analisis dan handoff; implementasi belum dilakukan. Pembuatan dokumen ini tidak mengubah kode aplikasi.

**Baseline:** 22 September 2026, commit `318b170`, 17 file `page.tsx`, 12.059 baris termasuk komentar/baris kosong; enam halaman lebih dari 1.000 baris. Agen penerima wajib memeriksa kondisi terbaru sebelum mengedit.

**Konvensi path:** Semua path dalam dokumen relatif terhadap root repository, kecuali dinyatakan lain.

## 1. Scope dan batasan global

- Scope mencakup evaluasi seluruh 17 halaman pada inventaris bagian 3, komponen yang dipakai halaman tersebut, dan hook/utilitas/tipe pendukung yang diperlukan.
- Refactor mempertahankan URL, kontrak API, payload, aturan akses, validasi, isi tampilan, dan alur bisnis.
- Pertahankan layout responsif dan gaya visual. Dokumen ini tidak meminta redesign.
- Pertahankan mekanisme autentikasi dan pemakaian API client yang sudah ada.
- Tidak mengubah backend, database, migrasi, deployment, versi framework, atau menambah dependency tanpa kebutuhan terpisah yang jelas.
- Tidak perlu mengganti seluruh halaman menjadi Server Components, menambah state manager global, atau mengganti strategi data fetching secara menyeluruh.
- Jangan memindahkan satu halaman besar ke satu komponen besar dengan nama baru dan menyebutnya selesai.
- Jangan membuat engine CRUD, form berbasis schema, atau tabel universal hanya untuk menyeragamkan fitur yang berbeda.
- Halaman yang sudah fokus, terutama halaman utama 35 baris, boleh tetap seperti semula.
- Hormati perubahan pengguna yang sudah ada. Hindari perubahan format massal atau perbaikan lain di luar scope.
- Temuan bug/perubahan perilaku dicatat terpisah dari pemindahan struktur. Jangan diam-diam memasukkannya ke refactor.
- Baca `README.md` dan `frontend/AGENTS.md`. Jalankan perintah frontend dari direktori `frontend/`.
- Untuk API Next.js khusus versi, periksa dokumentasi lokal `frontend/node_modules/next/dist/docs/` jika tersedia.
- Dokumen ini tidak meminta commit, push, merge, atau deployment otomatis. Ikuti instruksi pengguna pada sesi implementasi.

## 2. Fokus review dan perilaku yang harus dijaga

| Kondisi | Perilaku yang harus dipertahankan | Pemilik verifikasi |
|---|---|---|
| Modal ditutup, dibuka lagi, atau berpindah item | Nilai awal, draft, error, dan status submit mengikuti perilaku masing-masing form; draft tidak bocor ke item lain. | Tahap 1–6 |
| Mutation diikuti refresh | Data yang berubah diperbarui; tab/filter/halaman dan draft lain tidak kehilangan state akibat komponen terlepas saat loading. | Tahap 2–7 |
| Role, status entitas, dan kapasitas berbeda | Tombol, disabled state, serta guard aksi tetap mengikuti aturan yang ada. | Tahap 2–7 |
| Field kosong/null, opsi belum dimuat, request gagal | Tidak mengubah arti kosong/null/undefined pada payload dan tidak mencampurkan gagal memuat dengan data kosong tanpa keputusan eksplisit. | Tahap 1–7 |
| Endpoint serupa tetapi workflow berbeda | Alokasi lisensi, custody aset, rekonsiliasi, dan pembuatan aset dari scan tetap memakai aturan serta endpoint masing-masing. | Tahap 2–6 |

Saat ekstraksi mempertemukan dua perilaku yang berbeda, pertahankan perbedaan melalui kontrak kecil yang eksplisit atau dokumentasikan keputusan. Jangan menyamakan perilaku secara kebetulan.

## 3. Inventaris seluruh halaman

P1 = prioritas utama karena kompleksitas atau duplikasi langsung; P2 = berikutnya; P3 = perapian ringan/opsional. Prioritas tidak hanya ditentukan jumlah baris.

| File di bawah `frontend/src/app/` | Baris baseline | Prioritas | Kandidat pemecahan |
|---|---:|:---:|---|
| `dashboard/assets/page.tsx` | 1.314 | P1 | AssetFilters, AssetTable, AssignAssetModal, ReturnAssetModal, AssetImportDialog. |
| `dashboard/assets/[id]/page.tsx` | 1.089 | P1 | AssetDetailHeader, AssetInformationCard, ComputerSpecsCard, AssetAccessoriesCard, AssetHistoryTabs, modal maintenance/disposal, QR/print. |
| `dashboard/licenses/page.tsx` | 1.192 | P1 | LicenseStats, LicenseFilters, LicenseTable, LicenseFormModal dan LicenseAllocationModal bersama. |
| `dashboard/licenses/[id]/page.tsx` | 1.253 | P1 | LicenseCredentialCard, SeatUtilizationCard, LicenseAllocationsTable; gunakan form edit dan alokasi bersama. |
| `dashboard/tickets/page.tsx` | 1.121 | P1 | TicketStats, TicketFilters, TicketTable, CreateTicketModal, AssignTechnicianModal, ResolveTicketModal bersama. |
| `dashboard/tickets/[id]/page.tsx` | 867 | P1 | TicketWorkflowBar, TicketDiscussionThread, CommentForm, TicketSlaCard, kartu reporter/aset, ResolveTicketModal. |
| `dashboard/hardware-audits/page.tsx` | 1.187 | P1 | HardwareAuditFilters, HardwareAuditCard, PeripheralSummary, LinkAuditToAssetModal, CreateAssetFromAuditModal. |
| `dashboard/master/asset-custodians/page.tsx` | 788 | P1 | CustodianDirectoryTable, HeldAssetsModal, CustodianAssetCard, CustodianMetadataFields, modal create/edit. |
| `dashboard/master/employees/page.tsx` | 579 | P2 | EmployeeFormModal, EmployeeTable, statistik dan pencarian; pemisahan data employee dari opsi department/location. |
| `dashboard/master/vendors/page.tsx` | 470 | P2 | VendorFormModal, VendorTable; adopsi UI bersama. |
| `dashboard/infrastructure/page.tsx` | 490 | P2 | AccurateServerCard, MonitoringToolbar, AccurateLicenseTable, DatabasePanels, hook sync dan formatter telemetry. |
| `dashboard/master/asset-custodians/reconciliation/page.tsx` | 289 | P2 | ReconciliationCandidateCard dan hook kandidat/link/merge/dismiss. |
| `dashboard/master/locations/page.tsx` | 413 | P3 | LocationFormModal, LocationsTable; adopsi UI bersama. |
| `dashboard/master/departments/page.tsx` | 402 | P3 | DepartmentFormModal, DepartmentsTable; adopsi UI bersama. |
| `dashboard/master/equipment-types/page.tsx` | 384 | P3 | EquipmentTypeFormModal, EquipmentTypesTable; pertahankan role guard. |
| `login/page.tsx` | 186 | P3 | Opsional LoginForm dan PasswordField jika memberi batas tanggung jawab yang lebih jelas. |
| `page.tsx` | 35 | P3 | Pertahankan redirect berbasis autentikasi; tidak perlu dipecah. |

Nama kandidat adalah usulan. Tidak semua kandidat wajib menjadi file sendiri; gabungkan bagian yang kecil dan berubah bersama.

## 4. Komponen dan modul yang sudah tersedia

| Existing | Pemakaian/rekomendasi |
|---|---|
| `frontend/src/components/layout/DashboardLayout.tsx` | Pertahankan layout dan integrasi autentikasi yang sudah digunakan. |
| `frontend/src/components/ui/ConfirmDeleteModal.tsx` | Sudah dipakai untuk delete/revoke/konfirmasi. Pertahankan kontraknya; jangan buat komponen konfirmasi duplikat. |
| `frontend/src/components/assets/AssetFormModal.tsx` | Sudah digunakan daftar dan detail aset. Baseline 608 baris; pisahkan bagian identitas, spesifikasi, dan aksesori bila diperlukan. |
| `frontend/src/components/assets/CustodianPicker.tsx` | Sudah menangani pemilihan holder, resolusi employee, dan holder manual. Pertahankan kemampuan ini. |
| `VerificationBadge` di `CustodianPicker.tsx` | Dipakai lintas halaman aset/custodian. Layak dipisahkan agar pemakai badge tidak bergantung pada modul picker. |
| `frontend/src/lib/api.ts` | Gunakan kembali untuk request; jangan membuat jalur autentikasi/request paralel. |
| `frontend/src/lib/assetForm.ts` | Validasi dan pembentukan payload spesifikasi yang sudah memiliki test. |
| `frontend/src/lib/assetImport.ts` | Tipe, guard, serta pembacaan hasil validasi import yang sudah memiliki test. |
| `frontend/src/lib/assetCustodian.ts` | Tipe, payload, aturan holder, dan helper yang sudah memiliki test. |
| `frontend/src/lib/confirmModal.ts` | Helper teks/variant konfirmasi yang sudah memiliki test. |
| `frontend/src/context/AuthContext.tsx` | Pertahankan sumber state autentikasi. |

`ConfirmDeleteModal` belum menyediakan slot form khusus. Modal yang membutuhkan input alasan tidak dapat diganti langsung tanpa mempertimbangkan submit dan validasi.

## 5. Batas komponen dan organisasi file

Ikuti pola direktori yang sudah ada. Tidak perlu memigrasikan seluruh repository ke struktur baru.

| Lokasi | Tanggung jawab |
|---|---|
| `frontend/src/app/**/page.tsx` | Route, layout, komposisi fitur, dan koordinasi callback. |
| `frontend/src/components/ui/` | Primitive visual tanpa pengetahuan endpoint/domain. |
| `frontend/src/components/<domain>/` | Komponen fitur. Domain: assets, licenses, tickets, hardware-audits, custodians, master, infrastructure, auth. Pertahankan direktori assets existing; direktori lain dibuat hanya ketika ada ekstraksi konkret. |
| `frontend/src/hooks/<domain>/` | Hook data/mutation yang memang cukup besar atau digunakan ulang. |
| `frontend/src/lib/<domain>/` | Tipe, pemetaan presentasi, pure function, dan pembentukan payload bersama yang baru. |
| Modul flat `frontend/src/lib/` yang sudah ada | Tetap dapat digunakan; jangan memindahkannya hanya demi konsistensi folder. |

Kontrak antarbagiannya:

- Komponen tabel/kartu menerima data serta callback aksi. Komponen ini tidak perlu mengambil ulang data sendiri.
- Modal memiliki draft, validasi lokal, dan status proses melalui hook-nya. Parent menerima callback berhasil untuk refresh.
- State pembukaan modal tetap berada pada parent bersama jika pemicunya muncul di beberapa tempat.
- Query/filter/pagination berada pada pemilik data; toolbar dapat menjadi komponen controlled.
- Hook data menerima ID/query eksplisit dan mengembalikan data, loading/error, serta refresh. Hook tidak mengembalikan JSX.
- Opsi reference data yang dipakai banyak form memiliki pemilik jelas; hindari setiap anak mengulang fetch yang sama.
- Subform yang ikut satu submit memakai sumber nilai form yang sama. Jangan membuat salinan state yang harus terus disinkronkan dengan effect.
- UI bersama tidak mengimpor komponen fitur atau halaman. Fitur tidak mengimpor tipe dari `page.tsx`.
- Sesuaikan tipe terhadap kontrak API. Tipe spesifikasi komputer saat ini berbeda optional/nullability antara daftar dan detail; jangan menyatukannya dengan cast paksa.

Patokan ukuran, bukan syarat kelulusan: page sederhana 50–150 baris, page kompleks 100–200, komponen fitur 50–150, modal form 80–200, hook 30–120. Template cetak atau form yang tetap fokus dapat melebihi kisaran.

## 6. Kandidat UI bersama

Buat komponen berikut bertahap dari pemakaian nyata, lalu gunakan setidaknya pada pemakai yang sudah terbukti berulang.

| Kandidat | Kontrak minimum dan batasannya |
|---|---|
| ModalShell | open/close, title, children, footer, ukuran. Pertahankan perilaku close saat busy dan scroll pada setiap pemakai. Jangan menambahkan fetch/submit domain ke shell. |
| FormField | label, input ID, required/hint/error, children. Validasi bisnis tetap pada form. |
| PageHeader | title, description, icon, actions. Breadcrumb/back link dapat diberikan sebagai konten tambahan. |
| SearchField / FilterToolbar | value/change dan slot filter. Debounce serta query server bukan tanggung jawab tampilan. |
| StatCard | label, value, icon, tone, keterangan. Perhitungan statistik tetap milik fitur. |
| SectionCard / DetailField | heading/actions/content atau pasangan label–nilai dengan fallback eksplisit. |
| LoadingState / EmptyState / ErrorAlert | Pesan dan aksi opsional. Tidak menentukan sendiri apakah error berarti data kosong. |
| Badge dasar dan badge domain | Tampilan dasar dapat bersama; pemetaan status aset, prioritas tiket, tipe lisensi, dan verifikasi holder tetap terpisah. |

Pagination baru terlihat jelas pada katalog aset; belum perlu menjadi abstraksi lintas aplikasi. Tabel katalog lisensi, alokasi seat, tiket, master, dan telemetry mempunyai kolom/aksi berbeda; pertahankan komponen tabel fitur masing-masing.

## 7. Urutan implementasi dan deliverable

### Tahap 0 — Baseline

**Files dibaca:** seluruh halaman inventaris, `frontend/AGENTS.md`, `frontend/package.json`, komponen/modul existing bagian 4.

- [x] Periksa git status, versi dependency, inventaris halaman, dan perubahan sejak commit baseline.
- [x] Catat perilaku form saat buka/tutup, filter, role, dan refresh pada halaman yang akan dikerjakan.
- [x] Jalankan pemeriksaan baseline bagian 9; pisahkan kegagalan lama dari regresi baru.
- [x] Tentukan ownership komponen bersama agar pekerjaan paralel tidak mengedit file yang sama.
- [x] Lanjutkan bertahap; jangan melakukan pemindahan seluruh halaman sekaligus.

**Deliverable:** baseline aktual dan batas perubahan jelas sebelum ekstraksi.

### Tahap 1 — Fondasi minimum

**Files:** `frontend/src/components/ui/`, `ConfirmDeleteModal.tsx` hanya jika memang perlu memakai fondasi yang sama.

- [x] Bentuk ModalShell dan primitive form/status dari modal nyata yang akan dipisahkan pada tahap lisensi.
- [x] Pastikan kontrak mendukung konten form, footer submit, loading, error, dan ukuran tanpa banyak flag domain.
- [x] Pertahankan existing ConfirmDeleteModal; integrasikan shell hanya jika tidak mengubah kontrak/perilakunya.
- [x] Verifikasi modal panjang dapat di-scroll, tombol submit/cancel bekerja, label terkait input, dan close/focus behavior tidak mengalami regresi.
- [x] Tambahkan primitive lain ketika pemakai kedua membuktikan kebutuhan reuse.

**Deliverable:** fondasi kecil yang langsung digunakan oleh fitur, tanpa folder komponen kosong atau abstraksi spekulatif.

### Tahap 2 — Lisensi: pengurangan duplikasi terbesar

**Modify:** `frontend/src/app/dashboard/licenses/page.tsx`, `frontend/src/app/dashboard/licenses/[id]/page.tsx`.

**Target files:** `frontend/src/components/licenses/LicenseFormModal.tsx`, `LicenseAllocationModal.tsx`, `LicenseTable.tsx`, `LicenseAllocationsTable.tsx`, `LicenseCredentialCard.tsx`, `SeatUtilizationCard.tsx`; hook/model di direktori domain bila diperlukan.

- [x] Satukan field dan pembentukan payload create/edit dengan initial value serta mode yang jelas.
- [x] Satukan modal alokasi employee/asset; gunakan callback berhasil sesuai halaman pemakai.
- [x] Pisahkan tabel katalog dari tabel alokasi dan kartu detail.
- [x] Pindahkan tipe bersama, badge tipe lisensi, dan perhitungan yang benar-benar identik dari kedua halaman.
- [x] Pisahkan data lisensi dari reference data vendor/location/employee/asset tanpa mengubah opsi yang tersedia.
- [x] Verifikasi create/edit dari daftar serta edit dari detail menghasilkan payload setara.
- [x] Verifikasi alokasi employee dan asset, kapasitas habis, revoke, delete, reveal/copy key, nilai tanggal/cost kosong, dan kegagalan request.

**Deliverable:** satu implementasi form lisensi dan satu implementasi alokasi yang dipakai kedua halaman.

### Tahap 3 — Aset dan form aset existing

**Modify:** kedua halaman aset dan `frontend/src/components/assets/AssetFormModal.tsx`.

**Target files di `frontend/src/components/assets/`:** `AssetFilters.tsx`, `AssetTable.tsx`, `AssignAssetModal.tsx`, `ReturnAssetModal.tsx`, `AssetImportDialog.tsx`, `AssetInformationCard.tsx`, `ComputerSpecsCard.tsx`, `AssetAccessoriesCard.tsx`, `AssetHistoryTabs.tsx`, `LogMaintenanceModal.tsx`, `DisposeAssetModal.tsx`, `PrintAssetTagModal.tsx`. Bagian form dapat menjadi `AssetIdentityFields.tsx`, `ComputerSpecsFields.tsx`, `AccessoriesEditor.tsx` jika batasnya membantu.

- [x] Pertahankan reuse AssetFormModal di daftar/detail dan pemakaian CustodianPicker.
- [x] Pisahkan assignment dan return berikut draft, validasi, dan status submit.
- [x] Pindahkan alur import menjadi pemilik file, preview, validasi, commit, dan hasil; bagian besar preview dapat menjadi subkomponen.
- [x] Pisahkan filter/tabel/pagination dan badge aset/kondisi yang terduplikasi.
- [x] Pisahkan kartu informasi, spesifikasi, aksesori, serta tiga isi tab riwayat.
- [x] Pisahkan data hook, pembuatan QR, dan utilitas/template cetak. Preview JSX dan HTML string cetak adalah dua renderer; jangan menganggap satu ekstraksi React otomatis menyatukannya.
- [x] Verifikasi filter mereset pagination seperti sebelumnya; assignment/return mempertahankan arti custodian dan location.
- [x] Verifikasi import file salah, preview error/warning, commit disabled, hasil sukses, dan refresh.
- [x] Verifikasi tambah/edit aset dengan spesifikasi kosong/parsial, aksesori, dan holder manual/HRD.
- [x] Verifikasi maintenance/disposal, tab saat refresh, QR, preview, dan cetak 80 × 50 mm.

**Deliverable:** halaman aset menjadi komposisi; alur import, lifecycle, riwayat, dan cetak mempunyai pemilik terpisah.

### Tahap 4 — Tiket

**Modify:** kedua halaman tiket.

**Target files di `frontend/src/components/tickets/`:** `TicketFilters.tsx`, `TicketStats.tsx`, `TicketTable.tsx`, `CreateTicketModal.tsx`, `AssignTechnicianModal.tsx`, `ResolveTicketModal.tsx`, `TicketWorkflowBar.tsx`, `TicketDiscussionThread.tsx`, `CommentForm.tsx`, `TicketSlaCard.tsx`. Hook di `frontend/src/hooks/tickets/`; tipe dan perhitungan SLA di modul domain.

- [x] Satukan ResolveTicketModal daftar/detail dan pemetaan badge priority/status.
- [x] Pisahkan form create/assign beserta draft dan validasinya.
- [x] Pisahkan tabel, filter, dan statistik; KPI saat ini dihitung dari hasil daftar yang sedang difilter.
- [x] Pisahkan workflow detail, diskusi/comment composer, SLA, dan metadata.
- [x] Tetapkan pemilik data tiket dan opsi technician; jangan menggandakan fetch pada setiap anak.
- [x] Verifikasi assign pada tiket Open tetap mengikuti transisi status yang ada.
- [x] Verifikasi resolve wajib memiliki notes, status Closed/Resolved, komentar internal/publik, dan kegagalan submit.
- [x] Verifikasi draft komentar serta resolve tidak hilang atau bocor saat close/refetch/berpindah tiket.
- [x] Verifikasi perhitungan SLA untuk tanpa due date, overdue, dan tiket selesai.

**Deliverable:** alur resolve bersama dan detail tiket tersusun dari bagian workflow, diskusi, serta konteks.

### Tahap 5 — Hardware audit

**Modify:** `frontend/src/app/dashboard/hardware-audits/page.tsx`.

**Target files di `frontend/src/components/hardware-audits/`:** `HardwareAuditFilters.tsx`, `HardwareAuditCard.tsx`, `PeripheralSummary.tsx`, `LinkAuditToAssetModal.tsx`, `CreateAssetFromAuditModal.tsx`; hook/model domain.

- [x] Pisahkan data/reference lookup serta mutation/feedback dari tampilan.
- [x] Pisahkan kartu audit; gunakan ulang ringkasan peripheral pada kartu dan preview modal bila bentuk datanya sama.
- [x] Pisahkan link dan create sebagai dua workflow.
- [x] Pertahankan kandidat rekomendasi, guard serial placeholder, pilihan update spesifikasi/peripheral, dan status audit.
- [x] Pertahankan endpoint `/hardware-audits/:id/create-asset`. AssetFormModal existing menggunakan `/assets`; tidak dapat menggantikannya langsung.
- [x] Verifikasi link ke kandidat maupun pilihan aset lain, create dari scan, peripheral kosong/terisi, delete audit, dan clear synced.

**Deliverable:** halaman audit berfokus pada daftar, dengan proses link/create terisolasi.

### Tahap 6 — Custodian dan master data

**Modify:** seluruh tujuh halaman `frontend/src/app/dashboard/master/**/page.tsx`.

**Target files:** `frontend/src/components/custodians/` untuk directory, metadata fields/modal, held-assets, candidate reconciliation, dan VerificationBadge; `frontend/src/components/master/` untuk form/tabel employee, vendor, location, department, equipment type.

- [x] Mulai dari directory custodian: pisahkan tabel, tampilan aset yang dipegang, serta create/edit metadata.
- [x] Gunakan bersama field nama/location/unit/notes jika kontraknya cocok dengan input holder manual pada CustodianPicker; duplicate acknowledgement tetap milik workflow yang memerlukannya.
- [x] Pisahkan kartu rekonsiliasi dan state link/merge/dismiss per kandidat.
- [x] Pisahkan EmployeeFormModal dan EmployeeTable; reference department/location tetap mempunyai pemilik jelas.
- [x] Lanjutkan vendor, kemudian location, department, dan equipment type.
- [x] Terapkan PageHeader, StatCard, pencarian/count, serta loading/error/kosong berdasarkan kesamaan nyata.
- [x] Biarkan controller CRUD sederhana di page apabila hook baru belum memberi manfaat.
- [x] Verifikasi role non-admin/admin: equipment type tetap dapat dibaca non-admin dengan aksi mutation tersembunyi; directory custodian dan rekonsiliasi tetap menolak non-admin sesuai baseline.
- [x] Verifikasi holder manual/HRD, ACTIVE/INACTIVE/MERGED, debounce pencarian custodian 200 ms dan status query, serta held assets yang dimuat ketika modal dibuka.
- [x] Verifikasi link employee dan merge custodian tetap berbeda serta kandidat yang di-dismiss mengikuti perilaku sesi yang ada.
- [x] Verifikasi create/edit/delete dan pencarian pada masing-masing lima master biasa, termasuk reference option kosong.

**Deliverable:** semua halaman master dievaluasi; form dan tabel yang besar dipisah tanpa membangun engine CRUD universal.

### Tahap 7 — Infrastructure dan halaman kecil

**Modify:** `frontend/src/app/dashboard/infrastructure/page.tsx`; login hanya bila ekstraksi bermanfaat; halaman utama boleh tetap.

**Target files di `frontend/src/components/infrastructure/`:** `AccurateServerCard.tsx`, `MonitoringToolbar.tsx`, `AccurateLicenseTable.tsx`, `DatabasePanels.tsx`; hook dan helper telemetry domain.

- [x] Pisahkan fetch/sync dan feedback dari kartu server serta kedua jenis panel.
- [x] Pertahankan manual sync satu server/semua server, notifikasi hasil parsial, dan waktu terakhir sync.
- [x] Pertahankan parsing tanggal khusus sumber Accurate, format uptime/bytes, dan fallback nilai tidak valid.
- [x] Verifikasi tab, server filter, pencarian, data kosong, sync sukses/sebagian gagal, dan gagal request.
- [x] Evaluasi LoginForm/PasswordField tanpa mengubah autentikasi, redirect, atau isi form.
- [x] Verifikasi login berhasil/gagal, toggle password, dan redirect halaman utama sesuai status autentikasi.
- [x] Dokumentasikan keputusan mempertahankan halaman kecil yang sudah fokus.

**Deliverable:** seluruh 17 halaman memiliki hasil refactor atau alasan eksplisit untuk tetap.

## 8. Catatan baseline yang bukan perubahan otomatis

Temuan ini perlu dikenali agar ekstraksi tidak menyembunyikan masalah atau mengubah perilaku tanpa sengaja:

- Detail aset menyimpan maintError/disposeError tetapi belum menampilkannya dalam JSX. Menambahkan tampilan error adalah perubahan perilaku yang perlu dinyatakan terpisah.
- Preview label aset dan template cetak memakai fallback kategori/lokasi yang berbeda. Penyatuan fallback bukan sekadar pemindahan file.
- Detail aset mempunyai currentCustodian pada tipe, tetapi ringkasan assigned user masih memakai field assignedEmployee. Refactor tidak otomatis mengganti sumber tampilan.
- Beberapa halaman mengganti seluruh subtree dengan loading pada refresh. State yang dipindahkan ke komponen anak dapat ter-reset, termasuk tab dan draft komentar.
- Form create/edit aset existing melakukan mount ulang konten dialog berdasarkan ID aset dan ketika dibuka. Pertahankan semantik initial value ini.
- Modal resolve tiket pada daftar mengisi notes lama ketika dibuka; detail memiliki pola draft berbeda. Definisikan kontrak initial value/reset secara eksplisit.
- Fetch auxiliary data tiket daftar ikut terpanggil saat filter berubah; detail memuat ulang opsi technician saat refresh. Pemisahan request atau caching adalah perubahan tersendiri yang perlu diverifikasi.
- SLA tiket dihitung menggunakan waktu saat render, tanpa timer khusus. Menambahkan countdown otomatis bukan bagian wajib ekstraksi.
- Pencarian beberapa halaman langsung memicu request; menambahkan debounce, pembatalan request, atau strategi concurrency perlu keputusan eksplisit.
- Sebagian tipe dan helper identik hanya secara konsep, tetapi nullable field, label badge, ukuran, atau pemetaan status berbeda. Jangan menyeragamkan tanpa memeriksa pemakai.

## 9. Verifikasi

Dokumen ini dibuat melalui analisis statis; lint, test, build, dan browser belum dijalankan untuk handoff ini.

Saat implementasi, jalankan perintah berikut dengan working directory `frontend/`:

| Waktu | Perintah | Tujuan |
|---|---|---|
| Baseline dan checkpoint relevan | `npm run lint` | Catat error lama dan cegah regresi pada file yang berubah. |
| Baseline dan setelah perubahan helper/domain | `npm run test` | Menjalankan test konfigurasi, asset form/import/custodian, serta confirmation helper yang sudah ada. |
| Baseline dan setelah integrasi akhir | `npm run build` | Memeriksa hasil build dan integrasi aplikasi. |
| Verifikasi interaksi bila lingkungan tersedia | `npm run dev` | Memeriksa alur UI sesuai checklist tiap tahap menggunakan browser. |

- Jangan mengklaim seluruh interaksi UI teruji hanya karena unit test helper lulus.
- Tambahkan test yang memeriksa perilaku bermakna pada perhitungan/payload/validasi yang diekstrak. Hindari test yang hanya mencocokkan struktur JSX atau nama class.
- Script test saat baseline menyebut file secara eksplisit. Jika menambah test, pastikan file baru benar-benar dijalankan, baik melalui script yang disesuaikan maupun perintah yang dilaporkan.
- Untuk perubahan presentasi kecil, pemeriksaan browser terarah cukup; tidak perlu menambah test yang meniru implementasi.
- Gunakan data lokal/test untuk mutation dan konfirmasi destructive, bukan data produksi.
- Periksa desktop dan viewport sempit terutama modal panjang, filter, tabel, dan detail.
- Bila API, akun, database, atau browser tidak tersedia, tetap kerjakan verifikasi yang memungkinkan dan laporkan skenario yang belum terverifikasi.
- Jangan berulang kali menjalankan seluruh pemeriksaan setelah hasil lulus kecuali ada perubahan atau temuan baru yang relevan.

## 10. Definition of done

- [x] Seluruh 17 halaman dipetakan ke hasil perubahan atau alasan mempertahankannya.
- [x] Form lisensi dan alokasi digunakan bersama oleh daftar/detail.
- [x] Resolve modal serta badge tiket yang identik digunakan bersama.
- [x] AssetFormModal dan CustodianPicker existing tetap digunakan; tidak ada implementasi duplikat baru.
- [x] Alur import, assignment/return, riwayat, cetak, hardware link/create, dan custody memiliki batas tanggung jawab yang jelas.
- [x] State form tidak seluruhnya tertinggal di page dengan puluhan setter diteruskan ke anak.
- [x] Komponen UI bersama bebas dari aturan endpoint/domain.
- [x] Tidak ada circular import atau import tipe fitur dari page route.
- [x] Route, kontrak API, aturan akses, payload, dan perilaku interaksi tetap terjaga; perubahan perilaku yang disengaja dijelaskan terpisah.
- [x] Pemeriksaan yang relevan dijalankan dengan hasil nyata; kegagalan baseline dan batas verifikasi dilaporkan.
- [x] Tidak ada perubahan backend/database/deployment atau dependency yang tidak diperlukan.
- [x] Ukuran file membaik karena pembagian tanggung jawab, bukan pemecahan elemen kecil tanpa manfaat.

## 11. Format laporan agen pelaksana

Setelah implementasi, berikan:

1. Ringkasan perubahan per domain dan daftar komponen yang sekarang digunakan bersama.
2. Tabel jumlah baris sebelum/sesudah untuk halaman yang berubah, dengan penjelasan bila file tetap panjang.
3. Halaman yang sengaja dipertahankan beserta alasannya.
4. Perintah verifikasi dan hasilnya; bedakan hasil yang dijalankan dari skenario yang belum dapat diuji.
5. Perubahan perilaku atau temuan di luar scope, bila ada.
6. Sisa pekerjaan konkret jika seluruh scope belum selesai; jangan menyebut refactor selesai hanya karena P1 sudah dikerjakan.

## 12. Instruksi singkat untuk diserahkan ke Codex

> Gunakan dokumen ini sebagai brief refactor frontend GAJIANICH. Baca baseline dan aturan repository terlebih dahulu, lalu kerjakan tahap 0–7 secara bertahap. Pertahankan tampilan, route, API, payload, permission, dan perilaku form yang ada. Utamakan komponen fitur beserta ownership state, gunakan kembali komponen existing, dan buat primitive bersama hanya berdasarkan duplikasi nyata. Jangan menambah dependency atau mengubah backend. Verifikasi sesuai bagian 9, gunakan definition of done bagian 10, dan laporkan hasil sesuai bagian 11. Halaman yang sudah fokus boleh dipertahankan dengan alasan yang jelas.
