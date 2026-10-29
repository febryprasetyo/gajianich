'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Download, Upload, Loader2, Trash2 } from 'lucide-react';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import { useAttendance } from './AttendanceWorkspace';
import { Heading, SearchInput, Empty, EmployeeName, FormDialog, Pagination, type Field } from './shared';
import EmployeeImportModal from '@/components/master/EmployeeImportModal';
import { api } from '@/lib/api';
import { roleLabels } from '@/lib/attendance/domain';
import type { AttendanceGrant, Employee, Identity, MasterItem } from '@/lib/attendance/types';

type Mode = 'employees' | 'departments' | 'locations' | 'identities' | 'sources' | 'access' | 'cards';
const titles: Record<Mode, string> = { employees: 'Master Karyawan Absensi', departments: 'Departemen Absensi', locations: 'Lokasi Absensi', identities: 'Pemetaan Identitas', sources: 'Sumber Absensi', access: 'Akses Absensi', cards: 'Kartu Absensi' };
const descriptions: Record<Mode, string> = { employees: 'Master karyawan HR dengan sinkronisasi master data GAJIANICH & Talenta.', departments: 'Kelola departemen yang digunakan oleh karyawan absensi.', locations: 'Kelola lokasi kerja absensi. Lokasi yang tidak tersedia pada file sumber tetap kosong.', identities: 'Hubungkan nomor mesin ke karyawan. Angka nol di depan nomor tetap dipertahankan.', sources: 'Sumber file menjadi pembeda nomor identitas mesin.', access: 'Simulasi grant modul HR. Perubahan di sini tidak mengubah akun atau hak akses login GAJIANICH.', cards: 'Pilih karyawan untuk melihat catatan harian, total durasi, dan riwayat koreksi.' };
type Entry = Employee | MasterItem | Identity | AttendanceGrant;
export default function AttendanceDirectoryPage({ mode }: { mode: Mode }) {
  const { data, execute, canWrite, refresh } = useAttendance();
  const [q, setQ] = useState(''), [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Entry | null | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [grantToDelete, setGrantToDelete] = useState<AttendanceGrant | null>(null);
  const [isDeletingGrant, setIsDeletingGrant] = useState(false);
  const [deleteGrantError, setDeleteGrantError] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ mode: Mode; item: Entry } | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [deleteItemError, setDeleteItemError] = useState<string | null>(null);

  const allowed = mode === 'access' ? data.meta.canManageAccess : canWrite;
  const entries: Entry[] = mode === 'cards' || mode === 'employees' ? data.employees : mode === 'access' ? data.grants : data[mode];
  const titleOf = (entry: Entry): string => 'fullName' in entry ? entry.fullName : 'name' in entry ? entry.name : 'displayName' in entry ? entry.displayName : `${entry.externalNoId} ${data.employees.find(e => e.id === entry.employeeId)?.fullName ?? ''}`;
  const filtered = entries.filter(e => `${titleOf(e)} ${'employeeCode' in e ? e.employeeCode : 'code' in e ? e.code : ''}`.toLowerCase().includes(q.toLowerCase()));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 10)));
  const existingEmployee = editing && 'fullName' in editing ? editing : null;
  const existingMaster = editing && 'name' in editing ? editing : null;
  const existingIdentity = editing && 'externalNoId' in editing ? editing : null;
  const existingGrant = editing && 'principalKey' in editing ? editing : null;
  const activeField: Field = { name: 'isActive', label: 'Status', type: 'select', value: editing && 'isActive' in editing && !editing.isActive ? 'false' : 'true', options: [{ value: 'true', label: 'Aktif' }, { value: 'false', label: 'Nonaktif' }] };
  let fields: Field[];
  if (mode === 'employees') fields = [
    { name: 'fullName', label: 'Nama lengkap', value: existingEmployee?.fullName, required: true },
    { name: 'employeeCode', label: 'No. ID / Kode karyawan', value: existingEmployee?.employeeCode, hint: 'Rujukan unique ID karyawan dari mesin absensi (No. ID)' },
    { name: 'email', label: 'Email', type: 'email', value: existingEmployee?.email },
    { name: 'departmentId', label: 'Departemen absensi', type: 'select', required: true, value: existingEmployee?.departmentId ?? '', options: [{ value: '', label: 'Pilih departemen' }, ...data.departments.map(d => ({ value: d.id, label: d.name }))] },
    { name: 'locationId', label: 'Lokasi absensi', type: 'select', value: existingEmployee?.locationId ?? '', options: [{ value: '', label: 'Belum ditentukan' }, ...data.locations.map(l => ({ value: l.id, label: l.name }))] },
    { name: 'position', label: 'Jabatan', value: existingEmployee?.position }, activeField,
  ];
  else if (mode === 'identities') fields = [
    { name: 'sourceId', label: 'Sumber', type: 'select', value: existingIdentity?.sourceId ?? data.sources[0]?.id, required: true, options: data.sources.map(s => ({ value: s.id, label: s.name })) },
    { name: 'externalNoId', label: 'No. ID mesin (Unique ID)', value: existingIdentity?.externalNoId, required: true, hint: 'Rujukan unique ID karyawan pada mesin absensi (contoh: 2018). Teks, bukan angka.' },
    { name: 'employeeId', label: 'Karyawan absensi', type: 'select', value: existingIdentity?.employeeId ?? '', required: true, options: [{ value: '', label: 'Pilih karyawan' }, ...data.employees.map(e => ({ value: e.id, label: `${e.employeeCode || 'Tanpa kode'} · ${e.fullName}` }))] },
  ];
  else if (mode === 'access') fields = [
    { name: 'principalKey', label: 'Identitas akun', value: existingGrant?.principalKey, required: true, hint: 'Contoh: email atau username. Grant ini tidak membuat akun login GAJIANICH.' },
    { name: 'displayName', label: 'Nama tampilan', value: existingGrant?.displayName, required: true },
    { name: 'role', label: 'Peran absensi', type: 'select', value: existingGrant?.role ?? 'HR_STAFF', options: Object.entries(roleLabels).map(([value, label]) => ({ value, label })) }, activeField,
  ];
  else fields = [{ name: 'code', label: 'Kode', value: existingMaster?.code, required: true }, { name: 'name', label: 'Nama', value: existingMaster?.name, required: true }, activeField];
  
  const handleDeleteGrant = async () => {
    if (!grantToDelete) return;
    setIsDeletingGrant(true);
    setDeleteGrantError(null);
    try {
      await execute({ type: 'delete_grant', id: grantToDelete.id });
      setNotice({ type: 'success', text: `Akses absensi untuk "${grantToDelete.displayName}" berhasil dihapus.` });
      setGrantToDelete(null);
    } catch (err: unknown) {
      setDeleteGrantError((err as Error).message || 'Gagal menghapus akses absensi.');
    } finally {
      setIsDeletingGrant(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeletingItem(true);
    setDeleteItemError(null);
    try {
      if (itemToDelete.mode === 'departments' || itemToDelete.mode === 'locations') {
        await api.delete(`/master/${itemToDelete.mode}/${itemToDelete.item.id}`);
        setNotice({ type: 'success', text: `${itemToDelete.mode === 'departments' ? 'Departemen' : 'Lokasi'} berhasil dihapus.` });
        setItemToDelete(null);
        await refresh();
      } else if (itemToDelete.mode === 'sources') {
        await execute({ type: 'source', action: 'delete', source: itemToDelete.item as any });
        setNotice({ type: 'success', text: 'Sumber absensi berhasil dihapus.' });
        setItemToDelete(null);
      } else if (itemToDelete.mode === 'identities') {
        await execute({ type: 'delete_identity', id: itemToDelete.item.id });
        setNotice({ type: 'success', text: 'Pemetaan identitas berhasil dihapus.' });
        setItemToDelete(null);
      }
    } catch (err: unknown) {
      setDeleteItemError((err as Error).message || 'Gagal menghapus data.');
    } finally {
      setIsDeletingItem(false);
    }
  };

  const submit = async (form: FormData) => {
    const text = (key: string) => String(form.get(key) ?? '');
    const id = editing?.id ?? 0; const isActive = text('isActive') === 'true';
    if (mode === 'sources') {
      await execute({
        type: 'source',
        action: id ? 'update' : 'create',
        source: {
          id,
          code: text('code'),
          name: text('name'),
          isActive,
        },
      });
    } else if (mode === 'identities') {
      await execute({
        type: 'identity',
        value: {
          id,
          externalNoId: text('externalNoId'),
          sourceId: Number(text('sourceId')),
          employeeId: Number(text('employeeId')),
        },
      });
    } else if (mode === 'access') {
      await execute({
        type: 'grant',
        value: {
          id,
          principalKey: text('principalKey'),
          displayName: text('displayName'),
          role: text('role') as AttendanceGrant['role'],
          isActive,
        },
      });
    } else if (mode === 'departments') {
      try {
        const payload = { code: text('code'), name: text('name'), isActive };
        if (id) {
          await api.put(`/master/departments/${id}`, payload);
          setNotice({ type: 'success', text: `Departemen "${text('name')}" berhasil diperbarui.` });
        } else {
          await api.post('/master/departments', payload);
          setNotice({ type: 'success', text: `Departemen "${text('name')}" berhasil ditambahkan.` });
        }
        setEditing(undefined);
        await refresh();
      } catch (err: any) {
        setNotice({ type: 'error', text: err.message || 'Gagal menyimpan departemen.' });
      }
    } else if (mode === 'locations') {
      try {
        const payload = { code: text('code'), name: text('name'), isActive };
        if (id) {
          await api.put(`/master/locations/${id}`, payload);
          setNotice({ type: 'success', text: `Lokasi "${text('name')}" berhasil diperbarui.` });
        } else {
          await api.post('/master/locations', payload);
          setNotice({ type: 'success', text: `Lokasi "${text('name')}" berhasil ditambahkan.` });
        }
        setEditing(undefined);
        await refresh();
      } catch (err: any) {
        setNotice({ type: 'error', text: err.message || 'Gagal menyimpan lokasi.' });
      }
    } else if (mode === 'employees') {
      setNotice({
        type: 'error',
        text: 'Pengelolaan master karyawan dilakukan melalui menu Data Karyawan GAJIANICH atau import Talenta.',
      });
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setNotice(null);
      const blob = await api.download('/employees/export');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `master_karyawan_talenta_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setNotice({ type: 'success', text: 'File Excel data master karyawan berhasil diunduh.' });
    } catch (err: unknown) {
      setNotice({ type: 'error', text: (err as Error).message || 'Gagal mengekspor data karyawan' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSuccess = async () => {
    try {
      const [empData, deptData] = await Promise.all([
        api.get<any[]>('/employees'),
        api.get<any[]>('/master/departments'),
      ]);
      const mappedEmployees: Employee[] = empData.map((e) => ({
        id: Number(e.id),
        employeeCode: String(e.employeeId || e.nik || e.employeeCode || ''),
        fullName: String(e.fullName || e.name || ''),
        email: String(e.email || ''),
        departmentId: Number(e.departmentId || 0),
        locationId: e.locationId ? Number(e.locationId) : null,
        position: String(e.jobPosition || e.position || ''),
        isActive: e.isActive !== false,
      }));
      const mappedDepartments: MasterItem[] = deptData.map((d) => ({
        id: Number(d.id),
        code: String(d.code || ''),
        name: String(d.name || ''),
        isActive: d.isActive !== false,
      }));
      await execute({
        type: 'sync_employees',
        employees: mappedEmployees,
        departments: mappedDepartments,
      });
      setNotice({ type: 'success', text: `${mappedEmployees.length} data karyawan berhasil disinkronkan ke modul absensi.` });
    } catch (err) {
      console.error('Failed to sync after import:', err);
    }
  };

  if (mode === 'access' && !data.meta.canManageAccess) return <Empty text="Pengelolaan akses hanya tersedia bagi pengelola grant." />;
  return (
    <div className="space-y-6">
      <Heading title={titles[mode]} description={descriptions[mode]}>
        {mode === 'identities' && <Link className="hr-btn" href="/dashboard/attendance/identities/sources">Kelola sumber</Link>}
        {mode === 'sources' && <Link className="hr-btn" href="/dashboard/attendance/identities">Pemetaan identitas</Link>}
        {mode === 'employees' && (
          <>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="hr-btn flex items-center gap-1.5"
              title="Ekspor seluruh data karyawan aktif ke file Excel format Talenta"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              <span>{isExporting ? 'Mengekspor...' : 'Export Excel'}</span>
            </button>
            {allowed && (
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="hr-btn flex items-center gap-1.5"
                title="Impor data master karyawan dari file Excel format Talenta"
              >
                <Upload size={16} />
                <span>Import Excel</span>
              </button>
            )}
          </>
        )}
        {mode !== 'cards' && allowed && (
          <button className="hr-btn-primary" onClick={() => setEditing(null)}>
            <Plus size={16} />
            {mode === 'identities' ? 'Tambah pemetaan' : mode === 'access' ? 'Tambah akses' : 'Tambah data'}
          </button>
        )}
      </Heading>

      {notice && (
        <div
          className={`flex items-center justify-between rounded-xl border p-3.5 text-xs font-medium transition-all ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-3 font-semibold underline hover:opacity-75"
          >
            Tutup
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder={mode === 'employees' || mode === 'cards' ? 'Cari nama atau No. ID karyawan' : 'Cari kode atau nama'}
        />
        <span className="text-xs font-medium text-slate-500">{filtered.length} data</span>
      </div>

      <div className="hr-panel">
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead>
              <tr>
                <th>{mode === 'identities' ? 'No. ID mesin' : 'Nama'}</th>
                <th>{mode === 'identities' ? 'Sumber' : mode === 'access' ? 'Akun / peran' : 'Kode / departemen'}</th>
                <th>{mode === 'identities' ? 'Karyawan absensi' : 'Status / lokasi'}</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((currentPage - 1) * 10, currentPage * 10).map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {'fullName' in entry ? (
                      <EmployeeName employee={entry} detail={entry.position} />
                    ) : (
                      <span className="font-medium">{'externalNoId' in entry ? entry.externalNoId : titleOf(entry)}</span>
                    )}
                  </td>
                  <td>
                    {'fullName' in entry ? (
                      data.departments.find((d) => d.id === entry.departmentId)?.name || '-'
                    ) : 'externalNoId' in entry ? (
                      data.sources.find((s) => s.id === entry.sourceId)?.name
                    ) : 'principalKey' in entry ? (
                      <>
                        <span>{entry.principalKey}</span>
                        <p className="mt-1 text-slate-500">{roleLabels[entry.role]}</p>
                      </>
                    ) : (
                      entry.code
                    )}
                  </td>
                  <td>
                    {'externalNoId' in entry ? (
                      data.employees.find((e) => e.id === entry.employeeId)?.fullName
                    ) : (
                      <>
                        <span className={entry.isActive ? 'text-emerald-700' : 'text-slate-500'}>
                          {entry.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                        {'locationId' in entry && (
                          <p className="mt-1 text-slate-500">
                            {data.locations.find((l) => l.id === entry.locationId)?.name ?? 'Lokasi belum ditentukan'}
                          </p>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {'fullName' in entry && (
                        <Link className="hr-btn" href={`/dashboard/attendance/employees/${entry.id}`}>
                          Lihat kartu
                        </Link>
                      )}
                      {mode !== 'cards' && allowed && (
                        <button className="hr-btn" onClick={() => setEditing(entry)}>
                          Edit
                        </button>
                      )}
                      {mode === 'access' && allowed && (
                        <button
                          type="button"
                          className="hr-btn text-rose-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-300"
                          onClick={() => {
                            setDeleteGrantError(null);
                            setGrantToDelete(entry as AttendanceGrant);
                          }}
                          title="Hapus Akses"
                        >
                          <Trash2 size={13} className="text-rose-600" />
                          <span>Hapus</span>
                        </button>
                      )}
                      {(mode === 'departments' || mode === 'locations' || mode === 'sources' || mode === 'identities') && allowed && (
                        <button
                          type="button"
                          className="hr-btn text-rose-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-300"
                          onClick={() => {
                            setDeleteItemError(null);
                            setItemToDelete({ mode, item: entry });
                          }}
                          title={`Hapus ${mode === 'departments' ? 'Departemen' : 'Data'}`}
                        >
                          <Trash2 size={13} className="text-rose-600" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty text={q ? 'Tidak ada hasil pencarian.' : 'Belum ada data. Tambahkan melalui tombol di atas.'} />
        )}
        <Pagination total={filtered.length} page={currentPage} onChange={setPage} />
      </div>

      {editing !== undefined && (
        <FormDialog
          title={`${editing ? 'Edit' : 'Tambah'} ${
            mode === 'identities'
              ? 'pemetaan'
              : mode === 'access'
              ? 'akses'
              : mode === 'employees'
              ? 'karyawan absensi'
              : 'data master'
          }`}
          fields={fields}
          onClose={() => setEditing(undefined)}
          onSubmit={submit}
        />
      )}

      {mode === 'employees' && (
        <EmployeeImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={handleImportSuccess}
        />
      )}

      {grantToDelete && (
        <ConfirmDeleteModal
          isOpen={true}
          onClose={() => {
            if (!isDeletingGrant) {
              setGrantToDelete(null);
              setDeleteGrantError(null);
            }
          }}
          onConfirm={handleDeleteGrant}
          title="Hapus Akses Absensi"
          description="Apakah Anda yakin ingin menghapus akses absensi ini? Akun tersebut tidak lagi memiliki izin khusus pada modul absensi."
          itemName={grantToDelete.displayName}
          itemDetails={[
            { label: 'Identitas Akun', value: grantToDelete.principalKey },
            { label: 'Nama Tampilan', value: grantToDelete.displayName },
            { label: 'Peran Absensi', value: roleLabels[grantToDelete.role] || grantToDelete.role },
          ]}
          confirmText="Hapus Akses"
          variant="danger"
          isLoading={isDeletingGrant}
          error={deleteGrantError}
        />
      )}

      {itemToDelete && (
        <ConfirmDeleteModal
          isOpen={true}
          onClose={() => {
            if (!isDeletingItem) {
              setItemToDelete(null);
              setDeleteItemError(null);
            }
          }}
          onConfirm={handleDeleteItem}
          title={`Hapus ${itemToDelete.mode === 'departments' ? 'Departemen' : itemToDelete.mode === 'locations' ? 'Lokasi' : 'Data'}`}
          description={
            itemToDelete.mode === 'departments'
              ? 'Apakah Anda yakin ingin menghapus departemen ini? Departemen yang masih memiliki karyawan atau jadwal terkait tidak dapat dihapus.'
              : 'Apakah Anda yakin ingin menghapus data ini?'
          }
          itemName={'name' in itemToDelete.item ? String((itemToDelete.item as any).name ?? '') : 'code' in itemToDelete.item ? String((itemToDelete.item as any).code ?? '') : String(itemToDelete.item.id)}
          itemDetails={[
            { label: 'Kode', value: 'code' in itemToDelete.item ? String((itemToDelete.item as any).code ?? '-') : '-' },
            { label: 'Nama', value: 'name' in itemToDelete.item ? String((itemToDelete.item as any).name ?? '-') : '-' },
          ]}
          confirmText="Hapus Data"
          variant="danger"
          isLoading={isDeletingItem}
          error={deleteItemError}
        />
      )}
    </div>
  );
}
