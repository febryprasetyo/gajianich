'use client';

import FilterToolbar from '@/components/ui/FilterToolbar';
import TableShell from '@/components/ui/TableShell';
import TablePagination from '@/components/ui/TablePagination';
import StatusBadge from '@/components/ui/StatusBadge';
import type { AdmsMonitorData } from '@/lib/attendance/admsMonitor';

interface AdmsReceiptsSectionProps {
  data: AdmsMonitorData | null;
  loading: boolean;
  error: string | null;
  outcome: string;
  onOutcomeChange: (val: string) => void;
  source: string;
  onSourceChange: (val: string) => void;
  page: number;
  onPageChange: (val: number) => void;
  onResetFilters: () => void;
}

const selectClass =
  'min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const tableClass =
  'w-full text-left text-xs [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-slate-600 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top';
const paginationClass = 'flex-wrap gap-3 rounded-xl [&>div:last-child]:flex-wrap';
const dateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
const numberFormatter = new Intl.NumberFormat('id-ID');
const formatTime = (value: string | null) => (value ? dateFormatter.format(new Date(value)) : 'Belum ada');
const metric = (value: number | undefined) => (value === undefined ? '—' : numberFormatter.format(value));
const dot = <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />;

export default function AdmsReceiptsSection({
  data,
  loading,
  error,
  outcome,
  onOutcomeChange,
  source,
  onSourceChange,
  page,
  onPageChange,
  onResetFilters,
}: AdmsReceiptsSectionProps) {
  return (
    <section className="min-w-0 space-y-4" aria-labelledby="adms-panel-receipts-heading">
      <div>
        <h2 id="adms-panel-receipts-heading" className="text-sm font-bold text-slate-900">
          Riwayat Pengiriman Batch ADMS
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Catatan paket data HTTP POST yang dikirim mesin ke server ADMS port 8081
        </p>
      </div>

      <FilterToolbar
        hasActiveFilters={Boolean(outcome || source)}
        onResetFilters={onResetFilters}
        dropdownFilters={
          <>
            <label className="space-y-1 text-xs text-slate-600">
              <span>Status Penerimaan</span>
              <select
                aria-label="Status penerimaan batch"
                className={selectClass}
                value={outcome}
                onChange={e => {
                  onOutcomeChange(e.target.value);
                  onPageChange(1);
                }}
              >
                <option value="">Semua Status</option>
                <option value="ACCEPTED">Diterima</option>
                <option value="REJECTED">Ditolak</option>
                <option value="ARCHIVED">Diarsipkan</option>
              </select>
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span>Sumber Penerimaan</span>
              <select
                aria-label="Sumber penerimaan data"
                className={selectClass}
                value={source}
                onChange={e => {
                  onSourceChange(e.target.value);
                  onPageChange(1);
                }}
              >
                <option value="">Semua Sumber</option>
                <option value="ADMS">ADMS Push</option>
                <option value="MANUAL_IMPORT">Impor Manual</option>
              </select>
            </label>
          </>
        }
      />

      <TableShell
        loading={loading}
        error={!data && error ? error : null}
        isEmpty={!data?.receipts.length}
        emptyTitle="Belum ada pengiriman yang cocok"
        emptyDescription="Batch ADMS akan tercatat otomatis saat mesin aktif mengirimkan data."
      >
        <table className={`${tableClass} min-w-[950px]`}>
          <thead className="bg-slate-50">
            <tr>
              <th scope="col">Waktu Penerimaan</th>
              <th scope="col">Mesin / Nomor Seri</th>
              <th scope="col">Sumber / Tabel</th>
              <th scope="col">Hasil</th>
              <th scope="col">Total Diterima</th>
              <th scope="col">Berhasil Diproses</th>
              <th scope="col">Belum Dipetakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.receipts.map(receipt => (
              <tr key={receipt.id} className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap text-slate-600">{formatTime(receipt.receivedAt)}</td>
                <td>
                  <p className="font-semibold text-slate-900">{receipt.deviceName}</p>
                  <p className="mt-1 font-mono text-slate-600">{receipt.serial || 'Tanpa nomor seri'}</p>
                </td>
                <td>
                  <p className="text-slate-700">{receipt.source === 'MANUAL_IMPORT' ? 'Impor Manual' : receipt.source}</p>
                  <p className="mt-1 font-mono text-slate-500">{receipt.tableName}</p>
                </td>
                <td>
                  <StatusBadge
                    icon={dot}
                    variant={
                      receipt.outcome === 'ACCEPTED'
                        ? 'success'
                        : receipt.outcome === 'REJECTED'
                        ? 'danger'
                        : 'slate'
                    }
                  >
                    {receipt.outcome === 'ACCEPTED'
                      ? 'Diterima'
                      : receipt.outcome === 'REJECTED'
                      ? 'Ditolak'
                      : receipt.outcome === 'ARCHIVED'
                      ? 'Diarsipkan'
                      : receipt.outcome}
                  </StatusBadge>
                  {receipt.errorMessage && (
                    <p className="mt-1 max-w-64 break-words text-rose-700 text-[11px]">{receipt.errorMessage}</p>
                  )}
                </td>
                <td className="tabular-nums font-medium text-slate-800">{metric(receipt.totalReceived)}</td>
                <td className="tabular-nums font-medium text-emerald-700">{metric(receipt.totalInserted)}</td>
                <td className="tabular-nums">
                  {receipt.totalUnmapped > 0 ? (
                    <span className="font-semibold text-amber-600">{metric(receipt.totalUnmapped)}</span>
                  ) : (
                    <span className="text-slate-500">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      {data && (
        <TablePagination
          {...data.pagination}
          onPageChange={onPageChange}
          itemName="batch"
          className={paginationClass}
        />
      )}
    </section>
  );
}

