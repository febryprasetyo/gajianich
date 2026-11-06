'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useMobileEnvironment } from '@/hooks/useMobileEnvironment';
import { mobileGreeting } from '@/lib/attendance/mobilePresentation';
import type { MobileEmployeeProfile } from '@/lib/attendance/mobileApi';

export default function EmployeeGreeting({ employee, timeZone, completed = false }: { employee?: MobileEmployeeProfile; timeZone?: string; completed?: boolean }) {
  const { now } = useMobileEnvironment();
  const greeting = now ? mobileGreeting(now, timeZone, completed) : { salutation: 'Halo', message: 'Semoga harimu lancar.' };
  return <header className="flex items-start justify-between gap-4 py-2">
    <div className="min-w-0 space-y-1">
      <p className="text-sm font-medium text-slate-500">{greeting.salutation},</p>
      <h1 className="break-words text-2xl font-extrabold tracking-tight text-slate-900">{employee?.fullName || 'Karyawan'}</h1>
      <p className="text-sm text-slate-600">{greeting.message}</p>
      <p className="pt-1 text-xs text-slate-500">{employee?.position || 'Karyawan'}{employee?.employeeCode ? ` · ${employee.employeeCode}` : ''}</p>
    </div>
    <Link href="/m/profile" aria-label="Buka profil saya" title="Buka profil saya" className="group relative mt-1 shrink-0 rounded-full border-4 border-white bg-emerald-100 shadow-sm ring-1 ring-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600">
      {employee?.photoUrl ? <img src={employee.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-extrabold text-emerald-800">{employee?.avatarInitial || 'EM'}</span>}
      <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-white bg-emerald-600 p-1 text-white"><ChevronRight size={12} /></span>
    </Link>
  </header>;
}
