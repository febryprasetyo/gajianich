'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { canManageCustodians } from '@/lib/assetCustodian';
import { BRAND_NAME } from '@/lib/gajianichBrand';
import { getDashboardHrefForUser, canAccessRoute } from '@/lib/access/routes';
import NotificationBell from './NotificationBell';
import {
  Building2,
  MapPin,
  Store,
  Users,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  HardDrive,
  Cpu,
  Ticket,
  Key,
  Server,
  Shapes,
  UserRoundCog,
  GitMerge,
  LayoutDashboard,
  CalendarCheck,
  ScanFace,
  Sliders,
  CalendarDays,
  Clock,
  FileInput,
  ClipboardList,
  FileBarChart,
  History,
  ListFilter,
  FileCheck2,
  Settings,
} from 'lucide-react';

export interface NavSubItem {
  name: string;
  href: string;
  icon?: React.ElementType;
  permission?: string;
  badge?: string;
  adminOnly?: boolean;
}

export interface NavItem {
  name: string;
  href?: string;
  icon: React.ElementType;
  permission?: string;
  badge?: string;
  disabled?: boolean;
  adminOnly?: boolean;
  children?: NavSubItem[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    title: 'HR',
    items: [
      {
        name: 'Attendance',
        icon: CalendarCheck,
        children: [
          { name: 'Ringkasan HR', href: '/dashboard/attendance/overview', icon: LayoutDashboard, permission: 'attendance.view' },
          { name: 'Download Presensi', href: '/dashboard/attendance/devices', icon: Cpu, permission: 'attendance.import' },
          { name: 'Data Presensi', href: '/dashboard/attendance/raw-logs', icon: ListFilter, permission: 'attendance.import' },
          { name: 'Laporan Presensi', href: '/dashboard/attendance/transactions', icon: FileCheck2, permission: 'attendance.view' },
          { name: 'Data Absensi', href: '/dashboard/attendance', icon: CalendarCheck, permission: 'attendance.view' },
          { name: 'Impor Absensi', href: '/dashboard/attendance/imports', icon: FileInput, permission: 'attendance.import' },
          { name: 'Kartu Absensi', href: '/dashboard/attendance/employees', icon: ClipboardList, permission: 'attendance.view' },
          { name: 'Laporan Absensi', href: '/dashboard/attendance/reports', icon: FileBarChart, permission: 'attendance.view' },
          { name: 'Riwayat Aktivitas HR', href: '/dashboard/attendance/activity', icon: History, permission: 'attendance.view' },
        ],
      },
      {
        name: 'Verifikasi Presensi',
        icon: ShieldCheck,
        children: [
          { name: 'Review Absensi', href: '/dashboard/attendance/approvals', icon: CalendarCheck, permission: 'attendance.mobile.verify' },
          { name: 'Validasi Foto Wajah', href: '/dashboard/attendance/approvals/photos', icon: ScanFace, permission: 'attendance.mobile.verify' },
          { name: 'Aturan Auto-Approve', href: '/dashboard/attendance/approvals/rules', icon: Sliders, permission: 'attendance.manage' },
        ],
      },
      {
        name: 'Cuti',
        icon: CalendarDays,
        children: [
          { name: 'Pengajuan Cuti', href: '/dashboard/leaves', icon: CalendarDays, permission: 'attendance.view' },
          { name: 'Rekap Saldo Cuti', href: '/dashboard/leaves/balances', icon: Users, permission: 'attendance.view' },
          { name: 'Pengaturan Cuti', href: '/dashboard/leaves/settings', icon: Settings, permission: 'attendance.manage' },
        ],
      },
      {
        name: 'Master Data',
        icon: Users,
        children: [
          { name: 'Karyawan Absensi', href: '/dashboard/attendance/master/employees', icon: Users, permission: 'attendance.view' },
          { name: 'Departemen Absensi', href: '/dashboard/attendance/master/departments', icon: Building2, permission: 'attendance.view' },
          { name: 'Shift & Jam Kerja', href: '/dashboard/attendance/master/shifts', icon: Clock, permission: 'attendance.view' },
          { name: 'Akun Pengguna', href: '/dashboard/access', icon: UserRoundCog, permission: 'access.users.view' },
          { name: 'Pengaturan', href: '/dashboard/attendance/settings', icon: Settings, permission: 'attendance.manage', adminOnly: true },
        ],
      },
    ],
  },
  {
    title: 'GA',
    items: [
      { name: 'Permintaan Barang', href: '/dashboard/ga/requests', icon: ClipboardList, permission: 'ga.requests.view' },
    ],
  },
  {
    title: 'IT & Assets',
    items: [
      {
        name: 'Asset Management',
        icon: HardDrive,
        children: [
          { name: 'Ringkasan Aset', href: '/dashboard/assets/overview', icon: LayoutDashboard, permission: 'assets.view' },
          { name: 'Inventaris Aset', href: '/dashboard/assets', icon: HardDrive, permission: 'assets.view' },
          { name: 'Hardware Audits', href: '/dashboard/hardware-audits', icon: Cpu, permission: 'hardware_audits.view' },
          { name: 'Software Licenses', href: '/dashboard/licenses', icon: Key, permission: 'licenses.view' },
        ],
      },
      {
        name: 'Operations',
        icon: Server,
        children: [
          { name: 'Service Desk', href: '/dashboard/tickets', icon: Ticket, permission: 'tickets.view' },
          { name: 'Accurate & Servers', href: '/dashboard/infrastructure', icon: Server, permission: 'infrastructure.view' },
        ],
      },
      {
        name: 'Master Data IT',
        icon: Shapes,
        children: [
          { name: 'IT Equipment Types', href: '/dashboard/master/equipment-types', icon: Shapes, permission: 'master.view' },
          { name: 'Asset Custodians', href: '/dashboard/master/asset-custodians', icon: UserRoundCog, permission: 'master.manage', adminOnly: true },
          { name: 'HR Reconciliation', href: '/dashboard/master/asset-custodians/reconciliation', icon: GitMerge, permission: 'master.manage', adminOnly: true },
          { name: 'Locations', href: '/dashboard/master/locations', icon: MapPin, permission: 'master.view' },
          { name: 'Vendors', href: '/dashboard/master/vendors', icon: Store, permission: 'master.view' },
          { name: 'Departments', href: '/dashboard/master/departments', icon: Building2, permission: 'master.view' },
          { name: 'Employees', href: '/dashboard/master/employees', icon: Users, permission: 'master.view' },
        ],
      },
    ],
  },
  {
    title: 'Pengguna & Akses',
    items: [
      { name: 'Manajemen Pengguna', href: '/dashboard/access', icon: UserRoundCog, permission: 'access.users.view' },
    ],
  },
];

const ROUTE_PERMISSION_MAP: { prefix: string; permission: string; moduleName: string }[] = [
  { prefix: '/dashboard/ga/requests/new', permission: 'ga.requests.create', moduleName: 'Buat Permintaan Barang' },
  { prefix: '/dashboard/ga/requests', permission: 'ga.requests.view', moduleName: 'Permintaan Barang GA' },
  { prefix: '/dashboard/assets/overview', permission: 'assets.view', moduleName: 'Asset Management Dashboard' },
  { prefix: '/dashboard/assets', permission: 'assets.view', moduleName: 'IT Asset Inventory' },
  { prefix: '/dashboard/hardware-audits', permission: 'hardware_audits.view', moduleName: 'Hardware Audits' },
  { prefix: '/dashboard/licenses', permission: 'licenses.view', moduleName: 'Software Licenses' },
  { prefix: '/dashboard/tickets', permission: 'tickets.view', moduleName: 'Service Desk Tickets' },
  { prefix: '/dashboard/infrastructure', permission: 'infrastructure.view', moduleName: 'Accurate & Server Infrastructure' },
  { prefix: '/dashboard/attendance/devices', permission: 'attendance.import', moduleName: 'Download Presensi Mesin' },
  { prefix: '/dashboard/attendance/approvals/rules', permission: 'attendance.manage', moduleName: 'Aturan Auto-Approve Shift' },
  { prefix: '/dashboard/attendance/approvals/photos', permission: 'attendance.mobile.verify', moduleName: 'Validasi Foto Wajah' },
  { prefix: '/dashboard/attendance/approvals', permission: 'attendance.mobile.verify', moduleName: 'Review Absensi Mobile' },
  { prefix: '/dashboard/attendance', permission: 'attendance.view', moduleName: 'HR Attendance' },
  { prefix: '/dashboard/leaves/settings', permission: 'attendance.manage', moduleName: 'Leave Settings' },
  { prefix: '/dashboard/leaves/balances', permission: 'attendance.view', moduleName: 'Leave Balances' },
  { prefix: '/dashboard/leaves', permission: 'attendance.view', moduleName: 'Leave Requests' },
  { prefix: '/dashboard/master', permission: 'master.view', moduleName: 'Master Data' },
  { prefix: '/dashboard/access', permission: 'access.users.view', moduleName: 'Manajemen Pengguna' },
  { prefix: '/dashboard/employee/overview', permission: '', moduleName: 'Employee Workspace' },
  { prefix: '/dashboard/management/overview', permission: '', moduleName: 'Management Workspace' },
  { prefix: '/dashboard/welcome', permission: '', moduleName: 'Welcome Overview' },
];

const DashboardLayoutContext = React.createContext<boolean>(false);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isNested = React.useContext(DashboardLayoutContext);
  const { user, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isNested) {
    return <>{children}</>;
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center text-slate-600 font-mono">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-xl">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          <span className="text-sm font-medium text-slate-800">Verifying Session Token...</span>
        </div>
      </div>
    );
  }

  const isHrRole = (() => {
    const normRole = (user.roleName || (user as { role?: string }).role || '').toLowerCase().replace(/[\s_-]+/g, '');
    return normRole.includes('hr') || normRole.includes('attendance');
  })();

  const dashboardHref = getDashboardHrefForUser(user);

  const mainNavGroup: NavGroup = {
    title: 'Utama',
    items: [
      {
        name: 'Dashboard',
        href: dashboardHref,
        icon: LayoutDashboard,
      },
    ],
  };

  const hasSubItemAccess = (subItem: NavSubItem): boolean => {
    const normRole = (user.roleName || (user as { role?: string }).role || '').toLowerCase().replace(/[\s_-]+/g, '');
    if (normRole === 'superadmin' || user.permissions?.includes('*')) return true;

    if (subItem.href === '/dashboard/access') {
      return Boolean(
        normRole === 'admin' ||
        normRole === 'superadmin' ||
        normRole.includes('hr') ||
        normRole.includes('attendance') ||
        user.permissions?.includes('access.users.view') ||
        user.permissions?.includes('access.roles.manage')
      );
    }

    if (subItem.adminOnly && !canManageCustodians(user.roleName)) return false;

    if (subItem.permission) {
      return Boolean(user.permissions && user.permissions.includes(subItem.permission));
    }

    return true;
  };

  const hasItemAccess = (item: NavItem): boolean => {
    const normRole = (user.roleName || (user as { role?: string }).role || '').toLowerCase().replace(/[\s_-]+/g, '');
    if (normRole === 'superadmin' || user.permissions?.includes('*')) return true;

    if (item.children && item.children.length > 0) {
      return item.children.some(hasSubItemAccess);
    }

    if (item.href === '/dashboard/access') {
      return Boolean(
        normRole === 'admin' ||
        normRole === 'superadmin' ||
        normRole.includes('hr') ||
        normRole.includes('attendance') ||
        user.permissions?.includes('access.users.view') ||
        user.permissions?.includes('access.roles.manage')
      );
    }

    if (item.adminOnly) {
      if (!canManageCustodians(user.roleName)) return false;
    }

    if (item.permission) {
      return Boolean(user.permissions && user.permissions.includes(item.permission));
    }

    return true;
  };

  const visibleNavGroups = [
    mainNavGroup,
    ...navGroups
      .filter((group) => {
        // Remove IT & Assets menu for HR Attendance role
        if (isHrRole && (group.title.toLowerCase() === 'it & assets' || group.title.toLowerCase() === 'master data')) {
          return false;
        }
        return true;
      })
      .map((group) => ({
        ...group,
        items: group.items
          .filter(hasItemAccess)
          .map((item) => {
            if (item.children) {
              return {
                ...item,
                children: item.children.filter(hasSubItemAccess),
              };
            }
            return item;
          }),
      }))
      .filter((group) => group.items.length > 0),
  ];

  const matchedRouteRule = ROUTE_PERMISSION_MAP.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)
  );

  const canAccessCurrentRoute = canAccessRoute(pathname, user);

  // Flatten all navigable links for breadcrumbs and 403 access list
  const allNavigableItems: { name: string; href: string; groupTitle: string; parentName?: string }[] = [];
  visibleNavGroups.forEach((g) => {
    g.items.forEach((item) => {
      if (item.href) {
        allNavigableItems.push({ name: item.name, href: item.href, groupTitle: g.title });
      }
      if (item.children) {
        item.children.forEach((child) => {
          allNavigableItems.push({ name: child.name, href: child.href, groupTitle: g.title, parentName: item.name });
        });
      }
    });
  });

  const isRouteMatchingHref = (href: string, currentPath: string): boolean => {
    if (href === '/dashboard/assets') {
      return currentPath === '/dashboard/assets' || (currentPath.startsWith('/dashboard/assets/') && !currentPath.startsWith('/dashboard/assets/overview'));
    }
    if (href === '/dashboard/attendance') {
      return currentPath === '/dashboard/attendance';
    }
    if (href === '/dashboard/leaves') {
      return currentPath === '/dashboard/leaves' || (currentPath.startsWith('/dashboard/leaves/') && !currentPath.startsWith('/dashboard/leaves/balances') && !currentPath.startsWith('/dashboard/leaves/settings'));
    }
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  const currentNavigableItem = allNavigableItems
    .filter((item) => item.groupTitle !== "Utama" || pathname === item.href)
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isRouteMatchingHref(item.href, pathname)) ||
    allNavigableItems[0];

  const isSubmenuActive = (item: NavItem): boolean => {
    if (!item.children) return false;
    return item.children.some((child) => isRouteMatchingHref(child.href, pathname));
  };

  const isSubmenuOpen = (item: NavItem): boolean => {
    if (openSubmenus[item.name] !== undefined) {
      return openSubmenus[item.name];
    }
    return isSubmenuActive(item);
  };

  const toggleSubmenu = (itemName: string) => {
    setOpenSubmenus((prev) => {
      const current = prev[itemName] !== undefined ? prev[itemName] : false;
      return {
        ...prev,
        [itemName]: !current,
      };
    });
  };

  return (
    <DashboardLayoutContext.Provider value={true}>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans selection:bg-emerald-500/20 selection:text-emerald-900 print:block print:bg-white print:min-h-0 print:p-0">
        {/* Mobile Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Crisp White Sidebar with Fresh Red Accent */}
        <aside
          className={`fixed md:sticky md:top-0 h-dvh shrink-0 inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 shadow-sm ${collapsed ? 'w-20' : 'w-64'
            } ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} print:hidden`}
        >
          {/* Sidebar Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
            <Link href={dashboardHref} className="flex items-center gap-3 overflow-hidden group">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 group-hover:scale-105 transition-transform">
                <Image src="/branding/gajianich-cat-favicon.png" alt="" width={36} height={36} className="w-9 h-9 object-contain" />
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="font-extrabold text-base text-slate-900 tracking-tight leading-none flex items-center gap-1.5">
                    <span>{BRAND_NAME}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Biar Kantor Jalan</span>
                </div>
              )}
            </Link>

            {/* Collapse Button */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Tutup navigasi"
              className="md:hidden text-slate-400 hover:text-slate-700 p-2 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>


          {/* Navigation Group Section */}
          <div className="flex-1 py-3 px-3 space-y-6 overflow-y-auto custom-scrollbar">
            {visibleNavGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                {!collapsed && (
                  <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2">
                    {group.title}
                  </div>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;

                  // Case A: Item with Sub-Menu (e.g. HR Attendance & HR Master Data)
                  if (item.children && item.children.length > 0) {
                    const activeSubmenu = isSubmenuActive(item);
                    const open = isSubmenuOpen(item);

                    if (collapsed) {
                      return (
                        <Link
                          key={item.name}
                          href={item.children[0]?.href || '/dashboard'}
                          className={`flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 group relative ${activeSubmenu
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                            }`}
                          title={`${item.name}: ${item.children.map((c) => c.name).join(', ')}`}
                        >
                          {activeSubmenu && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-emerald-600" />
                          )}
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${activeSubmenu ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-700'
                              }`}
                          />
                        </Link>
                      );
                    }

                    return (
                      <div key={item.name} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleSubmenu(item.name)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer group ${activeSubmenu
                              ? 'text-emerald-700 bg-emerald-50/70 font-bold'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${activeSubmenu ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-700'
                                }`}
                            />
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                              {item.children.length}
                            </span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-emerald-600' : ''
                                }`}
                            />
                          </div>
                        </button>

                        {open && (
                          <div className="ml-4 pl-3 border-l-2 border-slate-200/80 space-y-1 mt-1 transition-all duration-200">
                            {item.children.map((child) => {
                              const isChildActive = isRouteMatchingHref(child.href, pathname);
                              const ChildIcon = child.icon;

                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={() => setMobileOpen(false)}
                                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all duration-150 cursor-pointer relative ${isChildActive
                                      ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-2xs'
                                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
                                    }`}
                                >
                                  {isChildActive && (
                                    <span className="absolute -left-[15px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-600 ring-2 ring-white" />
                                  )}
                                  {ChildIcon && (
                                    <ChildIcon
                                      className={`w-3.5 h-3.5 shrink-0 ${isChildActive ? 'text-emerald-600' : 'text-slate-400'
                                        }`}
                                    />
                                  )}
                                  <span className="truncate">{child.name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Case B: Standard Nav Item
                  const isActive = item.href && (item.href === dashboardHref && pathname === dashboardHref ? true : isRouteMatchingHref(item.href, pathname));

                  return (
                    <Link
                      key={item.href || item.name}
                      href={item.href || '#'}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer group relative ${isActive
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm shadow-emerald-500/5'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                        }`}
                      title={collapsed ? item.name : undefined}
                    >
                      {/* Active brand accent bar */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-emerald-600" />
                      )}

                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-700'
                          }`}
                      />

                      {!collapsed && (
                        <div className="flex-1 flex items-center justify-between min-w-0">
                          <span className="truncate">{item.name}</span>
                          {item.badge && (
                            <span className="text-[9px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

          {/* User Card in Sidebar Bottom */}
          {!collapsed && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold font-mono text-xs shrink-0 shadow-sm">
                    {user.fullName ? user.fullName[0].toUpperCase() : 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{user.fullName || user.email}</p>
                    <p className="text-[10px] text-emerald-600 font-mono font-bold truncate uppercase">
                      {user.roleName || 'SUPERADMIN'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="text-slate-400 hover:text-emerald-600 p-2 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Main Page Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Navbar */}
          <header className="h-16 bg-white/90 border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 backdrop-blur-xl shadow-2xs print:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
              <button
                onClick={() => setMobileOpen(true)}
                aria-label="Buka navigasi"
                className="md:hidden text-slate-500 hover:text-slate-900 p-2 cursor-pointer"
              >
                <Menu className="w-6 h-6" />
              </button>

              {/* Breadcrumb Trail */}
              <div className="flex min-w-0 items-center gap-2 text-xs font-medium [&>span:not(:last-child)]:hidden md:[&>span:not(:last-child)]:inline">
                <span className="text-slate-400">{BRAND_NAME}</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-400">{currentNavigableItem?.groupTitle || 'Dashboard'}</span>
                {currentNavigableItem?.parentName && (
                  <>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-400">{currentNavigableItem.parentName}</span>
                  </>
                )}
                <span className="text-slate-300">/</span>
                <span className="min-w-0 truncate text-emerald-700 font-bold">{currentNavigableItem?.name || 'Overview'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell />
              {/* User Profile Badge */}
              <div className="flex items-center gap-3 pl-1">
                <div className="flex items-center gap-2.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span className="text-slate-700 font-medium hidden lg:inline truncate max-w-[160px]">{user.email}</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-mono font-bold text-[10px] uppercase border border-emerald-200">
                    {user.roleName || 'ADMIN'}
                  </span>
                </div>

                {/* Topbar Logout Button */}
                <button
                  onClick={logout}
                  className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-emerald-600 px-3 py-1.5 rounded-xl hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit</span>
                </button>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 md:p-8 md:px-10 max-w-[1600px] w-full mx-auto print:p-0 print:m-0 print:max-w-none print:w-full">
            {!canAccessCurrentRoute ? (
              <div className="min-h-[60vh] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-3xl border border-red-200/80 p-8 shadow-xl shadow-red-500/5 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold tracking-wide uppercase mb-3">
                    403 Akses Dibatasi
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">
                    Akses Modul Tidak Diizinkan
                  </h2>
                  <p className="text-xs text-slate-500 leading-relaxed mb-6">
                    Peran akun Anda (<span className="font-semibold text-slate-700">{user.roleName || (user as { role?: string }).role || 'User'}</span>) tidak memiliki izin <code className="px-1.5 py-0.5 bg-slate-100 text-red-600 rounded text-[11px] font-mono">{matchedRouteRule?.permission || 'khusus'}</code> untuk mengakses modul <span className="font-semibold text-slate-700">{matchedRouteRule?.moduleName || pathname}</span>.
                  </p>

                  {allNavigableItems.length > 0 && (
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-[11px] font-medium text-slate-400 mb-3">Menu yang dapat Anda akses:</p>
                      <div className="flex flex-wrap justify-center gap-2 mb-6">
                        {allNavigableItems.slice(0, 4).map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                          >
                            {item.name}
                          </Link>
                        ))}
                      </div>
                      <Link
                        href={allNavigableItems[0]?.href || '/login'}
                        className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all cursor-pointer"
                      >
                        Buka Modul Anda
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </DashboardLayoutContext.Provider>
  );
}
