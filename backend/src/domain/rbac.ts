export interface PermissionSeed {
  code: string;
  name: string;
  module: string;
  description: string;
}

export const DEFAULT_PERMISSIONS: PermissionSeed[] = [
  { code: 'ga.requests.view', name: 'View Goods Requests', module: 'ga', description: 'Melihat permintaan barang GA dan bukti harga' },
  { code: 'ga.requests.create', name: 'Create Goods Request', module: 'ga', description: 'Membuat permintaan barang beserta lampiran' },

  // Assets
  { code: 'assets.view', name: 'View Assets', module: 'assets', description: 'Melihat inventaris aset dan detail' },
  { code: 'assets.create', name: 'Create Asset', module: 'assets', description: 'Menambahkan aset baru & impor' },
  { code: 'assets.edit', name: 'Edit Asset', module: 'assets', description: 'Memperbarui spesifikasi & detail aset' },
  { code: 'assets.delete', name: 'Delete Asset', module: 'assets', description: 'Menghapus atau mendisposisi aset' },
  { code: 'assets.assign', name: 'Assign & Return Asset', module: 'assets', description: 'Serah terima dan pengembalian aset' },

  // Tickets
  { code: 'tickets.view', name: 'View Tickets', module: 'tickets', description: 'Melihat tiket helpdesk IT' },
  { code: 'tickets.create', name: 'Create Ticket', module: 'tickets', description: 'Membuat permohonan tiket baru' },
  { code: 'tickets.manage', name: 'Manage & Resolve Tickets', module: 'tickets', description: 'Mengubah status, teknisi, & resolusi' },

  // Licenses
  { code: 'licenses.view', name: 'View Licenses', module: 'licenses', description: 'Melihat lisensi software' },
  { code: 'licenses.manage', name: 'Manage Licenses', module: 'licenses', description: 'Menambah, mengedit, & alokasi lisensi' },

  // Infrastructure
  { code: 'infrastructure.view', name: 'View Infrastructure', module: 'infrastructure', description: 'Melihat status server & database' },
  { code: 'infrastructure.manage', name: 'Manage Infrastructure', module: 'infrastructure', description: 'Konfigurasi node server' },

  // Hardware Audits
  { code: 'hardware_audits.view', name: 'View Hardware Audits', module: 'hardware_audits', description: 'Melihat log audit hardware agen' },
  { code: 'hardware_audits.manage', name: 'Manage Hardware Audits', module: 'hardware_audits', description: 'Konversi dan tautkan audit ke aset' },

  // Attendance
  { code: 'attendance.mobile.verify', name: 'Review Mobile Attendance & Photos', module: 'attendance', description: 'Approval absensi wajah, perubahan foto dan pengaturan persetujuan otomatis shift' },
  { code: 'hr.audit.view', name: 'View HR Activity Audit', module: 'attendance', description: 'Melihat riwayat perubahan data HR' },
  { code: 'attendance.view', name: 'View Attendance', module: 'attendance', description: 'Melihat rekap & kartu absensi' },
  { code: 'attendance.import', name: 'Import Attendance', module: 'attendance', description: 'Mengunggah file log absensi mesin' },
  { code: 'attendance.manage', name: 'Manage Attendance', module: 'attendance', description: 'Koreksi log & pengaturan absensi' },

  // Master Data
  { code: 'master.view', name: 'View Master Data', module: 'master', description: 'Melihat master data organisasi' },
  { code: 'master.manage', name: 'Manage Master Data', module: 'master', description: 'Menambah dan mengubah master data' },

  // Access Control
  { code: 'access.users.view', name: 'View Users', module: 'access', description: 'Melihat daftar pengguna sistem' },
  { code: 'access.users.manage', name: 'Manage Users', module: 'access', description: 'Tambah, edit user, reset password' },
  { code: 'access.roles.manage', name: 'Manage Roles & Permissions', module: 'access', description: 'Mengatur peran & matriks hak akses' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'],
  ga_staff: ['ga.requests.view', 'ga.requests.create'],
  it_admin: [
    'assets.view', 'assets.create', 'assets.edit', 'assets.delete', 'assets.assign',
    'tickets.view', 'tickets.create', 'tickets.manage',
    'licenses.view', 'licenses.manage',
    'infrastructure.view', 'infrastructure.manage',
    'hardware_audits.view', 'hardware_audits.manage',
    'master.view', 'master.manage',
    'access.users.view',
  ],
  it_staff: [
    'assets.view', 'assets.assign',
    'tickets.view', 'tickets.create', 'tickets.manage',
    'licenses.view',
    'hardware_audits.view',
    'master.view',
  ],
  employee: [
    'tickets.view', 'tickets.create',
  ],
  management: [
    'assets.view',
    'tickets.view',
    'licenses.view',
    'infrastructure.view',
    'hardware_audits.view',
    'attendance.view',
    'master.view',
  ],
  hr_attendance: [
    'attendance.mobile.verify',
    'hr.audit.view',
    'attendance.view',
    'attendance.import',
    'attendance.manage',
    'access.users.view',
    'access.users.manage',
  ],
};
