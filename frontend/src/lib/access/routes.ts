export interface RouteRule {
  prefix: string;
  exact?: boolean;
  permission?: string;
  anyPermissions?: string[];
  itOnly?: boolean;
  adminOnly?: boolean;
  moduleName: string;
}

export const IT_ROLES = ['superadmin', 'super_admin', 'itadmin', 'it_admin', 'itstaff', 'it_staff', 'management'];
export const ADMIN_ROLES = ['superadmin', 'super_admin', 'itadmin', 'it_admin', 'admin'];

export const DASHBOARD_ROUTE_RULES: RouteRule[] = [
  { prefix: '/dashboard/attendance/adms', permission: 'attendance.adms.view', moduleName: 'Status Server ADMS' },
  { prefix: '/dashboard/attendance/devices', permission: 'attendance.import', moduleName: 'Daftar Mesin Presensi' },
  { prefix: '/dashboard/attendance/raw-logs', permission: 'attendance.import', moduleName: 'Log Mesin Presensi' },
  { prefix: '/dashboard/attendance/transactions', permission: 'attendance.view', moduleName: 'Hasil Tarik Presensi' },
  { prefix: '/dashboard/attendance/approvals/rules', permission: 'attendance.manage', moduleName: 'Aturan Auto-Approve' },
  { prefix: '/dashboard/attendance/approvals/photos', permission: 'attendance.mobile.verify', moduleName: 'Validasi Foto Wajah' },
  { prefix: '/dashboard/attendance/approvals', permission: 'attendance.mobile.verify', moduleName: 'Review Presensi' },
  { prefix: '/dashboard/ga/requests/new', permission: 'ga.requests.create', moduleName: 'Buat Permintaan Barang' },
  { prefix: '/dashboard/ga/requests', permission: 'ga.requests.view', moduleName: 'Permintaan Barang (GA)' },
  // Super App Landing & Overviews
  {
    prefix: '/dashboard/assets/overview',
    permission: 'assets.view',
    moduleName: 'Ringkasan Aset',
  },
  {
    prefix: '/dashboard/employee/overview',
    moduleName: 'Ruang Kerja Karyawan',
  },
  {
    prefix: '/dashboard/management/overview',
    moduleName: 'Ruang Kerja Manajemen',
  },
  {
    prefix: '/dashboard/welcome',
    moduleName: 'Dashboard',
  },

  // HR Leave Settings & Requests
  {
    prefix: '/dashboard/leaves/settings',
    permission: 'attendance.manage',
    moduleName: 'Pengaturan Cuti',
  },
  {
    prefix: '/dashboard/leaves',
    permission: 'attendance.view',
    moduleName: 'Pengajuan Cuti',
  },
  // HR Attendance Settings (Admin Only - restricted from ordinary HRD)
  {
    prefix: '/dashboard/attendance/settings',
    permission: 'attendance.manage',
    adminOnly: true,
    moduleName: 'Pengaturan Absensi',
  },

  // User Management
  {
    prefix: '/dashboard/access',
    permission: 'access.users.view',
    moduleName: 'Kelola Pengguna',
  },

  // IT Master Data (Restricted from HRD / General Users)
  {
    prefix: '/dashboard/master/asset-custodians',
    permission: 'master.manage',
    adminOnly: true,
    moduleName: 'Pemegang Aset (Custodian)',
  },
  {
    prefix: '/dashboard/master/equipment-types',
    permission: 'assets.view',
    itOnly: true,
    moduleName: 'Tipe Perangkat',
  },
  {
    prefix: '/dashboard/master/vendors',
    permission: 'assets.view',
    itOnly: true,
    moduleName: 'Daftar Vendor',
  },

  // Shared Master Data
  {
    prefix: '/dashboard/master/departments',
    permission: 'master.view',
    moduleName: 'Departemen IT',
  },
  {
    prefix: '/dashboard/master/employees',
    permission: 'master.view',
    moduleName: 'Karyawan IT',
  },
  {
    prefix: '/dashboard/master/locations',
    permission: 'master.view',
    moduleName: 'Lokasi Kantor',
  },
  {
    prefix: '/dashboard/master',
    exact: true,
    permission: 'master.view',
    moduleName: 'Master Data IT',
  },

  // Asset Lifecycle
  {
    prefix: '/dashboard/assets',
    permission: 'assets.view',
    moduleName: 'Daftar Aset',
  },
  {
    prefix: '/dashboard/hardware-audits',
    permission: 'hardware_audits.view',
    moduleName: 'Audit Hardware',
  },
  {
    prefix: '/dashboard/licenses',
    permission: 'licenses.view',
    moduleName: 'Lisensi Software',
  },

  // IT Operations
  {
    prefix: '/dashboard/tickets',
    permission: 'tickets.view',
    moduleName: 'Helpdesk & Tiket',
  },
  {
    prefix: '/dashboard/infrastructure',
    permission: 'infrastructure.view',
    moduleName: 'Monitoring Server Accurate',
  },
  {
    prefix: '/dashboard/servers',
    permission: 'infrastructure.view',
    moduleName: 'Monitoring Server & VPS',
  },
  {
    prefix: '/dashboard/subscriptions',
    permission: 'infrastructure.view',
    moduleName: 'Monitoring Domain, Hosting & Email',
  },

  // HR Leave Requests
  {
    prefix: '/dashboard/leaves',
    permission: 'attendance.view',
    moduleName: 'Pengajuan Cuti',
  },
  // HR Attendance
  {
    prefix: '/dashboard/attendance/identities',
    permission: 'attendance.manage',
    moduleName: 'Identitas Biometrik Karyawan',
  },
  {
    prefix: '/dashboard/attendance/activity',
    permission: 'attendance.view',
    moduleName: 'Riwayat Aktivitas HR',
  },
  {
    prefix: '/dashboard/attendance/daily-report',
    permission: 'attendance.view',
    moduleName: 'Laporan Absensi Harian',
  },
  {
    prefix: '/dashboard/attendance/imports',
    permission: 'attendance.import',
    moduleName: 'Impor Presensi',
  },
  {
    prefix: '/dashboard/attendance',
    permission: 'attendance.view',
    moduleName: 'Data Presensi',
  },
];

export function findMatchingRouteRule(pathname: string): RouteRule | undefined {
  // Sort rules by prefix length descending to match most specific subpaths first
  const sorted = [...DASHBOARD_ROUTE_RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  return sorted.find((rule) => {
    if (rule.exact) {
      return pathname === rule.prefix;
    }
    return pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`);
  });
}

export function canAccessRoute(
  pathname: string,
  user: { roleName?: string; role?: string; permissions?: string[] } | null | undefined
): boolean {
  if (!user) return false;

  const normRole = (user.roleName || user.role || '').toLowerCase().replace(/[\s_-]+/g, '');
  const perms = Array.isArray(user.permissions) ? user.permissions : [];

  // SuperAdmin has full wildcard access
  if (normRole === 'superadmin' || normRole === 'super_admin' || perms.includes('*')) {
    return true;
  }

  // Dedicated open workspace landing pages
  if (pathname === '/dashboard/employee/overview' || pathname === '/dashboard/welcome') {
    return true;
  }

  if (pathname === '/dashboard/management/overview') {
    return normRole === 'management' || perms.includes('management.view');
  }

  const matched = findMatchingRouteRule(pathname);
  if (!matched) {
    // If not specifically registered in DASHBOARD_ROUTE_RULES, allow unless under dashboard
    return true;
  }

  // Admin Only check
  if (matched.adminOnly) {
    const isAdmin = ADMIN_ROLES.some((r) => r.replace(/[\s_-]+/g, '') === normRole);
    if (!isAdmin && !perms.includes('access.roles.manage') && !perms.includes('master.manage')) {
      return false;
    }
  }

  // IT Only check (e.g. IT Equipment Types, Vendors)
  if (matched.itOnly) {
    const isIT = IT_ROLES.some((r) => r.replace(/[\s_-]+/g, '') === normRole);
    const hasITPerm = perms.includes('assets.view') || perms.includes('licenses.view');
    if (!isIT && !hasITPerm) {
      return false;
    }
  }

  if (matched.anyPermissions && !matched.anyPermissions.some(permission => perms.includes(permission))) return false;

  // Permission code check
  if (matched.permission) {
    if (matched.prefix === '/dashboard/access' && (normRole.includes('hr') || normRole.includes('attendance'))) {
      return true;
    }
    if (!perms.includes(matched.permission)) {
      return false;
    }
  }

  return true;
}

export function getDefaultRedirectForUser(
  user: { roleName?: string; role?: string; permissions?: string[]; mustChangePassword?: boolean } | null | undefined
): string {
  if (!user) return '/login';
  if (user.mustChangePassword) return '/change-password';

  const normRole = (user.roleName || user.role || '').toLowerCase().replace(/[\s_-]+/g, '');
  const perms = Array.isArray(user.permissions) ? user.permissions : [];

  // Admin, SuperAdmin, ITAdmin, ITStaff direct to Asset Management Dashboard
  if (
    normRole === 'superadmin' ||
    normRole === 'super_admin' ||
    normRole.includes('itadmin') ||
    normRole.includes('itstaff') ||
    perms.includes('*')
  ) {
    return '/dashboard/assets/overview';
  }

  // Prioritize HR / Attendance role
  if (
    normRole.includes('hr') ||
    normRole.includes('attendance') ||
    perms.includes('attendance.view')
  ) {
    return '/dashboard/attendance/overview';
  }

  // Management workspace
  if (normRole === 'management') {
    return '/dashboard/management/overview';
  }

  if (normRole.includes('ga')) return '/dashboard/ga/requests';

  // Employee workspace
  if (normRole === 'employee') {
    return '/dashboard/employee/overview';
  }

  // IT Asset role
  if (perms.includes('assets.view')) {
    return '/dashboard/assets/overview';
  }

  // Helpdesk Ticket role
  if (perms.includes('tickets.view')) {
    return '/dashboard/tickets';
  }

  // Licenses role
  if (perms.includes('licenses.view')) {
    return '/dashboard/licenses';
  }

  // Server Infrastructure role
  if (perms.includes('infrastructure.view')) {
    return '/dashboard/infrastructure';
  }

  // Access control role
  if (perms.includes('access.users.view') || normRole === 'admin') {
    return '/dashboard/access';
  }

  // Master view fallback
  if (perms.includes('master.view')) {
    return '/dashboard/master/departments';
  }

  return '/dashboard/welcome';
}

export function getDashboardHrefForUser(
  user: { roleName?: string; role?: string; permissions?: string[] } | null | undefined
): string {
  return getDefaultRedirectForUser(user);
}

/**
 * Evaluates whether a sidebar navigation item with `href` should be marked active
 * for `currentPath`.
 *
 * Prevents parent subpaths (e.g. `/dashboard/attendance/approvals`) from remaining active
 * when navigating to child sibling routes (e.g. `/dashboard/attendance/approvals/rules` or `/photos`).
 */
export function isRouteMatchingHref(
  href: string,
  currentPath: string,
  allHrefs?: string[]
): boolean {
  if (href === '/dashboard/assets') {
    return (
      currentPath === '/dashboard/assets' ||
      (currentPath.startsWith('/dashboard/assets/') && !currentPath.startsWith('/dashboard/assets/overview'))
    );
  }
  if (href === '/dashboard/attendance') {
    return currentPath === '/dashboard/attendance';
  }
  if (href === '/dashboard/attendance/approvals') {
    return (
      currentPath === '/dashboard/attendance/approvals' ||
      (currentPath.startsWith('/dashboard/attendance/approvals/') &&
        !currentPath.startsWith('/dashboard/attendance/approvals/photos') &&
        !currentPath.startsWith('/dashboard/attendance/approvals/rules'))
    );
  }
  if (href === '/dashboard/leaves') {
    return (
      currentPath === '/dashboard/leaves' ||
      (currentPath.startsWith('/dashboard/leaves/') &&
        !currentPath.startsWith('/dashboard/leaves/balances') &&
        !currentPath.startsWith('/dashboard/leaves/settings'))
    );
  }
  if (href === '/dashboard/master/asset-custodians') {
    return (
      currentPath === '/dashboard/master/asset-custodians' ||
      (currentPath.startsWith('/dashboard/master/asset-custodians/') &&
        !currentPath.startsWith('/dashboard/master/asset-custodians/reconciliation'))
    );
  }

  if (currentPath === href) {
    return true;
  }

  if (currentPath.startsWith(`${href}/`)) {
    if (allHrefs && allHrefs.length > 0) {
      const hasMoreSpecificRoute = allHrefs.some(
        (otherHref) =>
          otherHref !== href &&
          otherHref.startsWith(`${href}/`) &&
          (currentPath === otherHref || currentPath.startsWith(`${otherHref}/`))
      );
      if (hasMoreSpecificRoute) {
        return false;
      }
    }
    return true;
  }

  return false;
}

