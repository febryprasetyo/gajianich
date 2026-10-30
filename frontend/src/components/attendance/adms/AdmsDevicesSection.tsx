'use client';

import { Cpu, Settings2, Power, Wifi } from 'lucide-react';
import TableShell from '@/components/ui/TableShell';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActionButton from '@/components/ui/RowActionButton';
import FilterToolbar from '@/components/ui/FilterToolbar';
import type { AdmsMonitorDevice, DeviceFilter, AdmsCandidateDevice } from '@/lib/attendance/admsMonitor';

interface AdmsDevicesSectionProps {
  devices: AdmsMonitorDevice[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearchChange: (val: string) => void;
  deviceFilter: DeviceFilter;
  onDeviceFilterChange: (val: DeviceFilter) => void;
  onResetFilters: () => void;
  canManage: boolean;
  onEditDevice: (candidate: AdmsCandidateDevice) => void;
  onToggleDevice: (device: { id: number; enabled: boolean; name: string }) => void;
}

const selectClass =
  'min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const tableClass =
  'w-full text-left text-xs [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-slate-600 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top';
const dateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
const numberFormatter = new Intl.NumberFormat('id-ID');
const formatTime = (value: string | null) => (value ? dateFormatter.format(new Date(value)) : 'Belum ada');
const metric = (value: number | undefined) => (value === undefined ? '—' : numberFormatter.format(value));
const dot = <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />;

export default function AdmsDevicesSection({
  devices,
  loading,
  error,
  search,
  onSearchChange,
  deviceFilter,
  onDeviceFilterChange,
  onResetFilters,
  canManage,
  onEditDevice,
  onToggleDevice,
}: AdmsDevicesSectionProps) {
  return (
    <div className="space-y-4">
      <FilterToolbar
        search={search}
        searchPlaceholder="Cari nama mesin atau nomor seri ADMS…"
        onSearchChange={onSearchChange}
        hasActiveFilters={Boolean(search || deviceFilter !== 'all')}
        onResetFilters={onResetFilters}
        dropdownFilters={
          <select
            aria-label="Filter status mesin ADMS"
            className={selectClass}
            value={deviceFilter}
            onChange={e => onDeviceFilterChange(e.target.value as DeviceFilter)}
          >
            <option value="all">Semua mesin ADMS</option>
            <option value="online">Hanya yang online</option>
            <option value="unmapped">Ada log belum dipetakan</option>
          </select>
        }
      />

      <section className="min-w-0 space-y-3" aria-labelledby="adms-devices-heading">
        <div className="flex items-center justify-between">
          <h2 id="adms-devices-heading" className="text-sm font-bold text-slate-900">
            Daftar Mesin Presensi ADMS <span className="font-normal text-slate-500">({devices.length})</span>
          </h2>
        </div>

        <TableShell
          loading={loading}
          error={!devices.length && error ? error : null}
          isEmpty={!devices.length}
          emptyTitle="Tidak ada mesin ADMS yang cocok"
          emptyDescription="Mesin dalam unit organisasi aktif akan tampil di sini. Ubah filter untuk melihat mesin lainnya."
        >
          <table className={`${tableClass} min-w-[850px]`}>
            <thead className="bg-slate-50">
              <tr>
                <th scope="col">Nama Mesin / Nomor Seri</th>
                <th scope="col">Status Koneksi</th>
                <th scope="col">Terakhir Terhubung</th>
                <th scope="col">Presensi Terakhir</th>
                <th scope="col">Total Log ADMS</th>
                <th scope="col">Belum Dipetakan</th>
                <th scope="col">Batch Ditolak</th>
                {canManage && <th scope="col" className="text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.map(device => (
                <tr key={device.id} className="hover:bg-slate-50/70">
                  <td>
                    <p className="font-semibold text-slate-900">{device.name}</p>
                    <p className="mt-1 font-mono text-slate-600">{device.serial || 'Tanpa nomor seri'}</p>
                  </td>
                  <td>
                    <StatusBadge
                      icon={dot}
                      variant={!device.enabled ? 'slate' : device.online ? 'success' : 'warning'}
                    >
                      {!device.enabled ? 'Dinonaktifkan' : device.online ? 'Online' : 'Offline'}
                    </StatusBadge>
                  </td>
                  <td className="whitespace-nowrap text-slate-600">{formatTime(device.lastSeenAt)}</td>
                  <td className="whitespace-nowrap text-slate-600">{formatTime(device.lastSyncAt)}</td>
                  <td className="tabular-nums font-medium text-slate-800">{metric(device.totalLogs)}</td>
                  <td className="tabular-nums">
                    {device.unmappedLogs > 0 ? (
                      <span className="font-semibold text-amber-600">{metric(device.unmappedLogs)}</span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>
                  <td className="tabular-nums text-slate-600">{metric(device.rejectedBatches)}</td>
                  {canManage && (
                    <td className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <RowActionButton
                          icon={Settings2}
                          label="Edit Allowlist"
                          title="Perbarui IP/Subnet allowlist mesin ini"
                          onClick={() => {
                            const match: AdmsCandidateDevice = {
                              id: device.id,
                              name: device.name,
                              serialNumber: device.serial,
                              ip: '',
                              port: 4370,
                              connectionType: 'ADMS' as const,
                              isEnabled: true,
                              admsRegistered: true,
                              admsEnabled: device.enabled,
                              allowedNetwork: null,
                              lastSeenAt: device.lastSeenAt,
                              lastDataAt: device.lastSyncAt,
                            };
                            onEditDevice(match);
                          }}
                        />
                        <RowActionButton
                          icon={Power}
                          label={device.enabled ? 'Nonaktifkan ADMS' : 'Aktifkan ADMS'}
                          title={device.enabled ? 'Nonaktifkan penerimaan data ADMS' : 'Aktifkan penerimaan data ADMS'}
                          variant={device.enabled ? 'amber' : 'emerald'}
                          onClick={() => void onToggleDevice(device)}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </section>
    </div>
  );
}
