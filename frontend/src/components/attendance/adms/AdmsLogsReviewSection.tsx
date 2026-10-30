'use client';

import { RefreshCw, Download, UserCheck } from 'lucide-react';
import FilterToolbar from '@/components/ui/FilterToolbar';
import TableShell from '@/components/ui/TableShell';
import TablePagination from '@/components/ui/TablePagination';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  formatAdmsLocalTimestamp,
  admsReadCommandStatus,
  type AdmsReviewLogsData,
  type AdmsReadCommandsData,
  type AdmsMonitorDevice,
} from '@/lib/attendance/admsMonitor';

interface AdmsLogsReviewSectionProps {
  review: { data: AdmsReviewLogsData | null; error: string | null | undefined; loading: boolean };
  commands: { data: AdmsReadCommandsData | null; error: string | null | undefined; loading: boolean };
  devices: AdmsMonitorDevice[];
  reviewDevice: string;
  onReviewDeviceChange: (val: string) => void;
  pin: string;
  onPinChange: (val: string) => void;
  startDate: string;
  onStartDateChange: (val: string) => void;
  endDate: string;
  onEndDateChange: (val: string) => void;
  reviewUnmappedOnly: string;
  onReviewUnmappedOnlyChange: (val: string) => void;
  reviewPage: number;
  onReviewPageChange: (val: number) => void;
  onResetReviewFilters: () => void;
  rangeError: string | null;
  selectedGroupId: number | null;
  syncingAttendance: boolean;
  onSyncToAttendance: () => void;
  onOpenHistoryModal: () => void;
  onOpenResolvePinModal: (pin: string) => void;
}

const selectClass =
  'min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const tableClass =
  'w-full text-left text-xs [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-slate-600 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top';
const paginationClass = 'flex-wrap gap-3 rounded-xl [&>div:last-child]:flex-wrap';
const dateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
const formatTime = (value: string | null) => (value ? dateFormatter.format(new Date(value)) : 'Belum ada');
const dot = <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />;

export default function AdmsLogsReviewSection({
  review,
  commands,
  devices,
  reviewDevice,
  onReviewDeviceChange,
  pin,
  onPinChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  reviewUnmappedOnly,
  onReviewUnmappedOnlyChange,
  reviewPage,
  onReviewPageChange,
  onResetReviewFilters,
  rangeError,
  selectedGroupId,
  syncingAttendance,
  onSyncToAttendance,
  onOpenHistoryModal,
  onOpenResolvePinModal,
}: AdmsLogsReviewSectionProps) {
  const hasActiveFilters = Boolean(reviewDevice || pin || startDate || endDate || reviewUnmappedOnly);

  return (
    <section className="min-w-0 space-y-4" aria-labelledby="adms-panel-logs-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="adms-panel-logs-heading" className="text-sm font-bold text-slate-900">
            Log Presensi ADMS Real-Time
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Log scan otomatis dari mesin absensi · Mengikuti waktu lokal perangkat
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={selectedGroupId === null || syncingAttendance}
            onClick={onSyncToAttendance}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Bersihkan dan masukkan log ADMS yang valid ke daftar absensi karyawan (FIFO)"
          >
            <RefreshCw className={`h-4 w-4 ${syncingAttendance ? 'animate-spin' : ''}`} aria-hidden="true" />
            {syncingAttendance ? 'Menyinkronkan…' : 'Sinkronkan ke Absensi'}
          </button>
          <button
            type="button"
            disabled={selectedGroupId === null}
            onClick={onOpenHistoryModal}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Minta Log Historis
          </button>
        </div>
      </div>

      <FilterToolbar
        hasActiveFilters={hasActiveFilters}
        onResetFilters={onResetReviewFilters}
        dropdownFilters={
          <>
            <label className="space-y-1 text-xs text-slate-600">
              <span>Mesin Presensi</span>
              <select
                className={selectClass}
                value={reviewDevice}
                onChange={e => {
                  onReviewDeviceChange(e.target.value);
                  onReviewPageChange(1);
                }}
              >
                <option value="">Semua mesin ADMS</option>
                {devices.map(device => (
                  <option key={device.id} value={device.id}>
                    {device.name} · {device.serial}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span>Status Pemetaan</span>
              <select
                className={selectClass}
                value={reviewUnmappedOnly}
                onChange={e => {
                  onReviewUnmappedOnlyChange(e.target.value);
                  onReviewPageChange(1);
                }}
              >
                <option value="">Semua Status</option>
                <option value="true">Belum Dipetakan (Unmapped)</option>
                <option value="false">Sudah Dipetakan</option>
              </select>
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span>PIN Mesin</span>
              <input
                className={selectClass}
                type="text"
                inputMode="numeric"
                value={pin}
                placeholder="Cari nomor PIN"
                onChange={e => {
                  onPinChange(e.target.value);
                  onReviewPageChange(1);
                }}
              />
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span>Tanggal Mulai</span>
              <input
                className={`${selectClass} cursor-pointer`}
                type="date"
                value={startDate}
                max={endDate || undefined}
                onClick={e => {
                  try {
                    e.currentTarget.showPicker?.();
                  } catch {}
                }}
                onChange={e => {
                  onStartDateChange(e.target.value);
                  onReviewPageChange(1);
                }}
              />
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span>Tanggal Akhir</span>
              <input
                className={`${selectClass} cursor-pointer`}
                type="date"
                value={endDate}
                min={startDate || undefined}
                onClick={e => {
                  try {
                    e.currentTarget.showPicker?.();
                  } catch {}
                }}
                onChange={e => {
                  onEndDateChange(e.target.value);
                  onReviewPageChange(1);
                }}
              />
            </label>
          </>
        }
      />

      {review.error && review.data && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          {review.error} Tabel menampilkan log terakhir yang berhasil dimuat.
        </p>
      )}

      <TableShell
        loading={review.loading}
        error={rangeError || (!review.data && review.error ? review.error : null)}
        isEmpty={!review.data?.logs.length}
        emptyTitle="Belum ada log ADMS yang cocok"
        emptyDescription="Log baru dari mesin ADMS akan muncul otomatis di sini. Sesuaikan mesin, status pemetaan, atau tanggal untuk mencari data."
      >
        <table className={`${tableClass} min-w-[800px]`}>
          <thead className="bg-slate-50">
            <tr>
              <th scope="col">Mesin / Nomor Seri</th>
              <th scope="col">PIN / Karyawan</th>
              <th scope="col">Waktu Scan (Lokal)</th>
              <th scope="col">Mode Verifikasi</th>
              <th scope="col">Status Scan</th>
              <th scope="col">Sumber Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {review.data?.logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50/70">
                <td>
                  <p className="font-semibold text-slate-900">{log.deviceName}</p>
                  <p className="mt-1 font-mono text-slate-600">{log.serial}</p>
                </td>
                <td>
                  <p className="font-mono font-semibold text-slate-900">{log.pin}</p>
                  {log.employeeName ? (
                    <p className="mt-1 text-slate-600">{log.employeeName}</p>
                  ) : (
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        Belum dipetakan
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenResolvePinModal(log.pin)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                        title="Petakan PIN ini ke nama karyawan"
                      >
                        <UserCheck className="h-3 w-3" />
                        Petakan
                      </button>
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap text-slate-700">{formatAdmsLocalTimestamp(log.timestamp)}</td>
                <td className="font-mono text-slate-700">{log.verifyMode || '—'}</td>
                <td className="font-mono text-slate-700">{log.inOutState || '—'}</td>
                <td className="text-slate-700">{log.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      {review.data && !rangeError && (
        <TablePagination
          {...review.data.pagination}
          onPageChange={onReviewPageChange}
          itemName="log presensi"
          className={paginationClass}
        />
      )}

      {/* Sub-seksi: Status Permintaan Historis */}
      <section className="space-y-3 pt-3" aria-labelledby="adms-commands-heading">
        <h3 id="adms-commands-heading" className="text-sm font-bold text-slate-900">
          Status Permintaan Log Historis
        </h3>
        <p className="text-xs text-slate-500">
          Maksimal 50 permintaan terbaru. Perintah membaca log dari memori mesin fisik secara bertahap.
        </p>

        {commands.error && commands.data && (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {commands.error} Status di bawah adalah data terakhir.
          </p>
        )}

        <TableShell
          loading={commands.loading}
          error={!commands.data && commands.error ? commands.error : null}
          isEmpty={!commands.data?.commands.length}
          emptyTitle="Belum ada permintaan historis"
          emptyDescription="Permintaan akan tercatat setelah Anda menekan tombol Minta Log Historis."
        >
          <table className={`${tableClass} min-w-[760px]`}>
            <thead className="bg-slate-50">
              <tr>
                <th scope="col">Mesin / Nomor Seri</th>
                <th scope="col">Rentang Waktu Mesin</th>
                <th scope="col">Status Permintaan</th>
                <th scope="col">Dibuat / Kedaluwarsa</th>
                <th scope="col">Kode Balasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commands.data?.commands.map(command => {
                const status = admsReadCommandStatus(command.status);
                return (
                  <tr key={command.id} className="hover:bg-slate-50/70">
                    <td>
                      <p className="font-semibold text-slate-900">{command.deviceName}</p>
                      <p className="mt-1 font-mono text-slate-600">{command.serial}</p>
                    </td>
                    <td className="whitespace-nowrap text-slate-700">
                      <p>{formatAdmsLocalTimestamp(command.startAt)}</p>
                      <p className="mt-1">s.d. {formatAdmsLocalTimestamp(command.endAt)}</p>
                    </td>
                    <td>
                      <StatusBadge icon={dot} variant={status.variant}>
                        {status.label}
                      </StatusBadge>
                    </td>
                    <td className="whitespace-nowrap text-slate-600">
                      <p>{formatTime(command.createdAt)}</p>
                      <p className="mt-1 text-slate-400">s.d. {formatTime(command.expiresAt)}</p>
                    </td>
                    <td className="font-mono text-slate-700">{command.returnCode ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      </section>
    </section>
  );
}
