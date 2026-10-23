'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Pencil } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { employeeDetailGroups, formatEmployeeValue } from '@/lib/employeeDetail';
import type { EmployeeItem } from '@/lib/employeeTypes';

const statusLabel = (status?: string | null) => status === 'Resigned' ? 'Resign' : status === 'Inactive' ? 'Nonaktif' : 'Aktif';

export default function EmployeeDetailPage({ employeeId, basePath = '/dashboard/attendance/master/employees' }: { employeeId: number; basePath?: string }) {
  const [employee, setEmployee] = useState<EmployeeItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    api.get<EmployeeItem>(`/employees/${employeeId}`)
      .then(setEmployee)
      .catch((cause: Error) => setError(cause.message || 'Karyawan tidak ditemukan.'))
      .finally(() => setLoading(false));
  }, [employeeId]);

  async function updateLifecycle(status: 'Active' | 'Inactive' | 'Resigned') {
    if (!employee) return;
    setSavingStatus(true);
    setError(null);
    try {
      setEmployee(await api.put<EmployeeItem>(`/employees/${employee.id}`, { status }));
    } catch (cause: unknown) {
      setError((cause as Error).message || 'Gagal mengubah status.');
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-6xl space-y-6">
        <Link href={basePath} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke data karyawan
        </Link>
        {loading ? (
          <div className="flex justify-center p-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error && !employee ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
        ) : employee && (
          <>
            <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">{employee.photoUrl && <img src={employee.photoUrl} alt={`Foto ${employee.fullName}`} className="h-16 w-16 rounded-full object-cover" />}<p className="font-mono text-sm text-red-700">{employee.employeeCode}</p></div>
                  <h1 className="mt-1 text-2xl font-bold text-slate-900">{employee.fullName}</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {employee.departmentName || 'Departemen belum diisi'} · {employee.position || 'Jabatan belum diisi'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {statusLabel(employee.status)}
                  </span>
                  <Link
                    href={`${basePath}/${employee.id}/edit`}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </Link>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {employee.status === 'Active' && (
                  <>
                    <button
                      disabled={savingStatus}
                      onClick={() => updateLifecycle('Inactive')}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-60"
                    >
                      Nonaktifkan
                    </button>
                    <button
                      disabled={savingStatus}
                      onClick={() => updateLifecycle('Resigned')}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
                    >
                      Tandai Resign
                    </button>
                  </>
                )}
                {employee.status !== 'Active' && (
                  <button
                    disabled={savingStatus}
                    onClick={() => updateLifecycle('Active')}
                    className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 cursor-pointer disabled:opacity-60"
                  >
                    Aktifkan kembali
                  </button>
                )}
              </div>
            </header>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div className="space-y-4">
              {employeeDetailGroups.map(group => (
                <section key={group.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="border-b border-slate-100 pb-3 text-base font-bold text-slate-800">{group.title}</h2>
                  <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
                    {group.fields.map(field => (
                      <div key={field.key}>
                        <dt className="text-xs font-medium text-slate-500">{field.label}</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                          {formatEmployeeValue(employee[field.key as keyof EmployeeItem])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </DashboardLayout>
  );
}
