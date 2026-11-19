'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, Edit3, X } from 'lucide-react';
import { formatTalentaRow, type TalentaFormattedRow, type TalentaKpiFilterKey } from '@/lib/attendance/talentaCard';
import type { CalendarDayRow } from '@/lib/attendance/scheduleShift';
import type { AttendanceRecord } from '@/lib/attendance/types';

interface TalentaAttendanceTableProps {
  rows: CalendarDayRow[];
  canWrite: boolean;
  onEdit: (row: { date: string; existingRecord?: AttendanceRecord | null }) => void;
  activeFilter?: TalentaKpiFilterKey;
  onResetFilter?: () => void;
}

type SortField = 'date' | 'shift' | 'scheduleIn' | 'scheduleOut' | 'clockIn' | 'clockOut';
type SortDirection = 'asc' | 'desc';

const FILTER_LABELS: Record<TalentaKpiFilterKey, string> = {
  ALL: 'Semua Catatan',
  LATE: 'Terlambat',
  EARLY_CLOCK_OUT: 'Pulang awal',
  NO_CLOCK_OUT: 'Tidak scan pulang',
  NO_CLOCK_IN: 'Tidak scan masuk',
  INVALID: 'Tidak valid',
  ABSENT: 'Tidak hadir',
  DAY_OFF: 'Hari libur',
  TIME_OFF: 'Izin / cuti',
  NEXT_WORKDAYS: 'Hari kerja berikutnya',
};

export function TalentaAttendanceTable({
  rows,
  canWrite,
  onEdit,
  activeFilter = 'ALL',
  onResetFilter,
}: TalentaAttendanceTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const formattedRows: TalentaFormattedRow[] = useMemo(() => {
    return rows.map(formatTalentaRow);
  }, [rows]);

  const sortedRows = useMemo(() => {
    const list = [...formattedRows];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortField === 'shift') cmp = a.shiftCode.localeCompare(b.shiftCode);
      else if (sortField === 'scheduleIn') cmp = a.scheduleIn.localeCompare(b.scheduleIn);
      else if (sortField === 'scheduleOut') cmp = a.scheduleOut.localeCompare(b.scheduleOut);
      else if (sortField === 'clockIn') cmp = a.clockIn.localeCompare(b.clockIn);
      else if (sortField === 'clockOut') cmp = a.clockOut.localeCompare(b.clockOut);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [formattedRows, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
      {/* Active Filter Indicator Banner */}
      {activeFilter !== 'ALL' && (
        <div className="bg-emerald-50/70 border-b border-emerald-100/90 px-4 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-900">
            <span className="font-normal text-emerald-700">Filter aktif:</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-950 bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
              {FILTER_LABELS[activeFilter]}
            </span>
            <span className="text-emerald-600 font-medium">({sortedRows.length} baris)</span>
          </div>
          {onResetFilter && (
            <button
              type="button"
              onClick={onResetFilter}
              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-medium px-2 py-1 rounded hover:bg-emerald-100/70 transition-colors cursor-pointer"
            >
              <X size={13} />
              <span>Tampilkan semua</span>
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 text-slate-700 font-semibold border-b border-slate-200">
              {/* Date Column with right vertical dividing line */}
              <th scope="col" className="py-3 px-4 whitespace-nowrap border-r border-slate-200">
                <button
                  type="button"
                  onClick={() => toggleSort('date')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer"
                >
                  <span>Tanggal</span>
                  <ArrowUpDown size={12} className="text-slate-400" />
                </button>
              </th>

              {/* Shift Column */}
              <th scope="col" className="py-3 px-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('shift')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer"
                >
                  <span>Shift</span>
                  <ArrowUpDown size={12} className="text-slate-400" />
                </button>
              </th>

              <th scope="col" className="py-3 px-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('scheduleIn')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer"
                >
                  <span>Jadwal masuk</span>
                  <ArrowUpDown size={12} className="text-slate-400" />
                </button>
              </th>

              <th scope="col" className="py-3 px-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('scheduleOut')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer"
                >
                  <span>Jadwal pulang</span>
                  <ArrowUpDown size={12} className="text-slate-400" />
                </button>
              </th>

              <th scope="col" className="py-3 px-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('clockIn')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer"
                >
                  <span>Jam masuk</span>
                  <ArrowUpDown size={12} className="text-slate-400" />
                </button>
              </th>

              <th scope="col" className="py-3 px-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('clockOut')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer"
                >
                  <span>Jam pulang</span>
                  <ArrowUpDown size={12} className="text-slate-400" />
                </button>
              </th>

              <th scope="col" className="py-3 px-4 whitespace-nowrap">
                Kode kehadiran
              </th>

              <th scope="col" className="py-3 px-4 whitespace-nowrap">
                Kode izin / cuti
              </th>

              <th scope="col" className="py-3 px-4 whitespace-nowrap">
                Terlambat
              </th>

              <th scope="col" className="py-3 px-4 whitespace-nowrap">
                Lembur
              </th>

              {canWrite && (
                <th scope="col" className="py-3 px-4 whitespace-nowrap text-right">
                  Aksi
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 11 : 10} className="py-12 text-center text-slate-500">
                  <p className="font-medium text-slate-700">
                    {activeFilter !== 'ALL'
                      ? `Tidak ada catatan dengan status "${FILTER_LABELS[activeFilter]}".`
                      : 'Tidak ada data absensi pada periode ini.'}
                  </p>
                  {activeFilter !== 'ALL' && onResetFilter && (
                    <button
                      type="button"
                      onClick={onResetFilter}
                      className="mt-2 text-xs text-emerald-600 hover:text-emerald-800 hover:underline font-medium cursor-pointer"
                    >
                      Reset filter dan tampilkan semua catatan
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const isDayOff = row.isDayOff;

                return (
                  <tr
                    key={row.date}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Date with vertical dividing line separating it from Shift */}
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800 border-r border-slate-200">
                      {row.dateDisplay}
                    </td>

                    {/* Shift */}
                    <td className="py-3 px-4 whitespace-nowrap font-medium">
                      {isDayOff ? (
                        <span className="text-rose-500 font-semibold lowercase">
                          dayoff
                        </span>
                      ) : (
                        <span className="text-slate-700">
                          {row.shiftCode}
                        </span>
                      )}
                    </td>

                    {/* Schedule in */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-slate-600">
                      {row.scheduleIn}
                    </td>

                    {/* Schedule out */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-slate-600">
                      {row.scheduleOut}
                    </td>

                    {/* Clock in */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums">
                      {row.clockIn !== '-' ? (
                        <span className="text-slate-800 font-semibold">{row.clockIn}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Clock out */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums">
                      {row.clockOut !== '-' ? (
                        <span className="text-slate-800 font-semibold">{row.clockOut}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Attendance code */}
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                      {row.attendanceCode}
                    </td>

                    {/* Time off code */}
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                      {row.timeOffCode}
                    </td>

                    {/* Keterlambatan */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-amber-700">
                      {row.late}
                    </td>

                    {/* Lembur */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-slate-600">
                      {row.overtime}
                    </td>

                    {/* Uniform Action Button */}
                    {canWrite && (
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => onEdit({ date: row.date, existingRecord: row.record })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-700 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors font-medium cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                          <Edit3 size={11} className="text-slate-400 group-hover:text-emerald-500" />
                          <span>Koreksi</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
