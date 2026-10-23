'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { createAttendanceRepository } from '@/lib/attendance/repository';
import type { AttendanceCommand, AttendanceDataset, AttendanceRole } from '@/lib/attendance/types';
import './attendance.css';

interface AttendanceContextValue {
  data: AttendanceDataset;
  execute: (command: AttendanceCommand) => Promise<AttendanceDataset>;
  refresh: () => Promise<void>;
  canWrite: boolean;
  canReview: boolean;
}

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (!context) throw new Error('AttendanceProvider diperlukan.');
  return context;
}

function Provider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const repository = useMemo(() => createAttendanceRepository(user!.id), [user]);
  const [data, setData] = useState<AttendanceDataset | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'ams:attendance-workspace:v2') {
        setReload(v => v + 1);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    repository.load(controller.signal).then(value => {
      if (!controller.signal.aborted) {
        setData(value);
        setError('');
      }
    }).catch((err: unknown) => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Data gagal dimuat.');
    });
    return () => controller.abort();
  }, [repository, reload]);

  const execute = useCallback(async (command: AttendanceCommand) => {
    const next = await repository.execute(command);
    setData(next);
    return next;
  }, [repository]);

  const refresh = useCallback(async () => {
    const fresh = await repository.reset();
    setData(fresh);
  }, [repository]);

  const effectiveRole = useMemo((): AttendanceRole => {
    if (!data || !user) return 'REPORT_VIEWER';

    const username = (user.username || '').trim().toLowerCase();
    const email = (user.email || '').trim().toLowerCase();
    const grant = data.grants?.find(
      g => g.isActive && (
        (username && g.principalKey.trim().toLowerCase() === username) ||
        (email && g.principalKey.trim().toLowerCase() === email)
      )
    );

    if (grant) return grant.role;

    const isSuperAdmin = user.permissions?.includes('*') || (user.roleName || '').toLowerCase() === 'superadmin';
    const isHrAdmin = user.permissions?.includes('attendance.manage') || (user.roleName || '').toLowerCase().includes('admin');
    const isHrStaff = user.permissions?.includes('attendance.view') || user.permissions?.includes('attendance.import') || Boolean((user.roleName || '').toLowerCase().includes('hr'));

    if (isSuperAdmin || isHrAdmin) return 'HR_ADMIN';
    if (isHrStaff) return 'HR_STAFF';
    return 'REPORT_VIEWER';
  }, [data, user]);

  const resolvedData = useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      meta: {
        ...data.meta,
        role: effectiveRole,
        canManageAccess: effectiveRole === 'HR_ADMIN',
        actor: user?.fullName || user?.username || data.meta.actor,
      }
    };
  }, [data, effectiveRole, user]);

  const restricted = effectiveRole === 'REPORT_VIEWER' && pathname !== '/dashboard/attendance/reports';

  return (
    <div className="attendance-ui space-y-6">
      {error ? (
        <div className="hr-panel p-6" role="alert">
          <p className="mb-4 text-sm font-medium text-red-700">{error}</p>
          <button className="hr-btn" onClick={() => setReload(v => v + 1)}>Coba lagi</button>
        </div>
      ) : !data ? (
        <div className="hr-panel flex items-center justify-center gap-3 p-12 text-slate-600 font-medium" role="status">
          <Loader2 className="animate-spin text-emerald-600" size={20} />
          Memuat data absensi…
        </div>
      ) : restricted ? (
        <div className="hr-panel p-8 text-center max-w-lg mx-auto my-8">
          <h1 className="text-xl font-bold text-slate-900">Akses Terbatas</h1>
          <p className="my-3 text-sm text-slate-600 leading-relaxed">
            Akun pembaca laporan hanya dapat melihat ringkasan tanpa identitas karyawan.
          </p>
          <Link className="hr-btn-primary inline-flex mt-2" href="/dashboard/attendance/reports">
            Buka Laporan
          </Link>
        </div>
      ) : (
        <AttendanceContext.Provider value={{ data: resolvedData!, execute, refresh, canWrite: effectiveRole === 'HR_ADMIN' || effectiveRole === 'HR_STAFF' || Boolean(user?.permissions?.includes('attendance.import')), canReview: effectiveRole !== 'REPORT_VIEWER' }}>
          {children}
        </AttendanceContext.Provider>
      )}
    </div>
  );
}

export default function AttendanceWorkspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/dashboard/attendance/approvals')) return <DashboardLayout>{children}</DashboardLayout>;
  return (
    <DashboardLayout>
      <Provider>{children}</Provider>
    </DashboardLayout>
  );
}
