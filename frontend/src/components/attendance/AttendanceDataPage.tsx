'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Download, HelpCircle, LockKeyhole, UnlockKeyhole, Upload, ChevronDown, Calendar } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { useAttendance } from './AttendanceWorkspace';
import { Heading, SearchInput, EmployeeName, Status, Pagination, FormDialog, Empty } from './shared';
import { CorrectionDialog, RecordDetails } from './RecordDialogs';
import { RecordAttendanceDialog } from './RecordAttendanceDialog';
import { dateLabel, durationLabel, filterEmployees, filterRecords, summarizeEmployees, validDate, getJakartaToday } from '@/lib/attendance/domain';
import { exportAttendanceReportToExcel } from '@/lib/attendance/excelExport';
import { resolveEmployeeShift, getWorkingScheduleForDate } from '@/lib/attendance/scheduleShift';
import type { AttendanceRecord, Employee } from '@/lib/attendance/types';

export default function AttendanceDataPage() {
  const { data, execute, canWrite, refresh } = useAttendance();
  const searchParams = useSearchParams();

  const defaultDate = useMemo(() => {
    const paramDate = searchParams?.get('date');
    if (paramDate && validDate(paramDate)) return paramDate;
    if (data.meta.defaultDate && validDate(data.meta.defaultDate)) return data.meta.defaultDate;
    if (data.records.length > 0) {
      return data.records.reduce((max, r) => (r.workDate > max ? r.workDate : max), data.records[0].workDate);
    }
    return getJakartaToday();
  }, [data, searchParams]);

  const [date, setDate] = useState(defaultDate);
  useEffect(() => { refresh().catch(() => {}); }, [refresh]);
  useEffect(() => { if (defaultDate && !searchParams?.get("date")) { setDate(defaultDate); } }, [defaultDate, searchParams]);

  const [q, setQ] = useState('');
  const [departmentId, setDepartment] = useState(0);
  const initialCondition = searchParams?.get('condition') || 'all';
  const [condition, setCondition] = useState(initialCondition);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [correcting, setCorrecting] = useState<AttendanceRecord | null>(null);
  const [recordingEmployee, setRecordingEmployee] = useState<Employee | null>(null);
  const [detail, setDetail] = useState<AttendanceRecord | null>(null);
  const [lockOpen, setLockOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const c = searchParams?.get('condition');
    if (c) setCondition(c);
  }, [searchParams]);

  const locked = data.locks.some(l => l.workDate === date);
  const filter = { startDate: date, endDate: date, q, departmentId };
  const records = date ? filterRecords(data, filter) : [];
  const lookup = new Map(records.map(r => [r.employeeId, r]));

  const metrics: { key: string; label: string; test: (r: AttendanceRecord) => boolean }[] = [
    { key: 'ontime', label: 'Tepat waktu', test: r => !r.isDayOff && ['PRESENT', 'DINAS_LUAR'].includes(r.attendanceStatus) && r.lateMinutes === 0 },
    { key: 'late', label: 'Terlambat', test: r => !r.isDayOff && r.lateMinutes > 0 },
    { key: 'early', label: 'Pulang awal', test: r => !r.isDayOff && r.earlyMinutes > 0 },
    { key: 'noout', label: 'Scan pulang kosong', test: r => !r.isDayOff && r.attendanceStatus === 'PRESENT' && !r.rawScanOut },
    { key: 'noin', label: 'Scan masuk kosong', test: r => !r.isDayOff && r.attendanceStatus === 'PRESENT' && !r.rawScanIn },
    { key: 'normalized', label: 'Dinormalisasi', test: r => r.normalized },
    { key: 'absent', label: 'Tidak hadir', test: r => !r.isDayOff && r.attendanceStatus === 'ALPHA' },
    { key: 'off', label: 'Libur', test: r => r.isDayOff },
    { key: 'field-duty', label: 'Dinas Luar', test: r => r.attendanceStatus === 'DINAS_LUAR' },
    { key: 'leave', label: 'Izin / sakit / cuti', test: r => ['IZIN', 'SAKIT', 'CUTI'].includes(r.attendanceStatus) },
  ];

  const activeMetric = metrics.find(m => m.key === condition);
  const employees = filterEmployees(data, filter).filter(e => !activeMetric || (lookup.has(e.id) && activeMetric.test(lookup.get(e.id)!)));
  const actualPage = Math.min(page, Math.max(1, Math.ceil(employees.length / 10)));
  const visible = employees.slice((actualPage - 1) * 10, actualPage * 10);

  const resetPage = () => {
    setPage(1);
    setSelected([]);
  };

  const exportRows = () => {
    const ids = new Set((selected.length ? employees.filter(e => selected.includes(e.id)) : employees).map(e => e.id));
    const targetReports = summarizeEmployees(data, filter).filter(r => ids.has(r.employee.id));
    exportAttendanceReportToExcel(targetReports, filter, {
      departmentLookup: id => data.departments.find(d => d.id === id)?.name,
      filename: `absensi-${date}.xlsx`,
    });
  };

  return (
    <div className="space-y-6">
      <Heading
        title="Data Absensi"
        description="Jadwal, catatan kehadiran, dan durasi kerja per karyawan dalam satu tampilan."
      >
        <button className="hr-btn" onClick={() => setHelpOpen(true)}>
          <HelpCircle size={15} />
          Panduan
        </button>
        <Link className="hr-btn" href="/dashboard/attendance/imports">
          <Upload size={15} />
          Impor absensi
        </Link>
        {canWrite && (
          <button
            className={locked ? 'hr-btn' : 'hr-btn-primary'}
            disabled={!date}
            onClick={() => setLockOpen(true)}
          >
            {locked ? <UnlockKeyhole size={15} /> : <LockKeyhole size={15} />}
            {locked ? 'Buka kunci' : 'Kunci data'}
          </button>
        )}
      </Heading>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label
            className="relative flex items-center bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 cursor-pointer shadow-2xs hover:border-emerald-500 transition-colors"
            onClick={(e) => {
              const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement | null;
              if (input && e.target !== input) {
                input.focus();
                try {
                  input.showPicker?.();
                } catch {}
              }
            }}
          >
            <Calendar className="w-4 h-4 text-slate-500 mr-2 shrink-0 pointer-events-none" />
            <span className="sr-only">Tanggal absensi</span>
            <input
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              type="date"
              value={date}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker?.();
                } catch {}
              }}
              onChange={e => {
                setDate(e.target.value);
                resetPage();
              }}
            />
          </label>
          <label>
            <span className="sr-only">Departemen</span>
            <select
              className="hr-input cursor-pointer"
              value={departmentId}
              onChange={e => {
                setDepartment(Number(e.target.value));
                resetPage();
              }}
            >
              <option value={0}>Semua departemen</option>
              {data.departments.map(d => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          {condition !== 'all' && (
            <button
              className="hr-btn text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
              onClick={() => {
                setCondition('all');
                resetPage();
              }}
            >
              Hapus filter status
            </button>
          )}
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <SearchInput
            value={q}
            onChange={v => {
              setQ(v);
              resetPage();
            }}
          />
          <button
            className="hr-btn"
            disabled={!date || !employees.length}
            onClick={exportRows}
          >
            <Download size={15} />
            {selected.length ? `Ekspor ${selected.length} pilihan` : 'Ekspor'}
          </button>
        </div>
      </div>

      {/* 9 Status Filter Strip */}
      <div className="hr-panel overflow-x-auto">
        <div className="grid min-w-[1050px] grid-cols-9 divide-x divide-slate-200">
          {metrics.map(m => {
            const count = records.filter(m.test).length;
            const isSelected = condition === m.key;
            return (
              <button
                key={m.key}
                aria-pressed={isSelected}
                onClick={() => {
                  setCondition(isSelected ? 'all' : m.key);
                  resetPage();
                }}
                className={`px-4 py-3.5 text-left transition-colors hover:bg-slate-50 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50/80 ring-1 ring-inset ring-emerald-400'
                    : ''
                }`}
              >
                <span className={`block text-base font-bold tabular-nums ${
                  isSelected ? 'text-emerald-800' : 'text-slate-900'
                }`}>
                  {count}
                </span>
                <span className="mt-0.5 block text-[10px] font-medium leading-4 text-slate-600 truncate">
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-500">
        <p>
          {date ? dateLabel(date) : 'Pilih tanggal'} · {records.length} catatan final.
        </p>
        {locked && (
          <span className="flex items-center gap-1 font-medium text-amber-800">
            <LockKeyhole size={13} />
            Tanggal ini dikunci
          </span>
        )}
      </div>

      {/* Tabel Data Absensi */}
      <div className="hr-panel">
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead>
              <tr>
                <th className="hr-employee-cell">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua karyawan di halaman"
                      checked={visible.length > 0 && visible.every(e => selected.includes(e.id))}
                      onChange={e =>
                        setSelected(
                          e.target.checked
                            ? [...new Set([...selected, ...visible.map(emp => emp.id)])]
                            : selected.filter(id => !visible.some(emp => emp.id === id))
                        )
                      }
                    />
                    <span>Karyawan</span>
                  </div>
                </th>
                {[
                  'Tanggal',
                  'Shift',
                  'Jadwal masuk',
                  'Jadwal pulang',
                  'Scan masuk',
                  'Scan pulang',
                  'Kehadiran',
                  'Telat',
                  'Aksi',
                ].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(employee => {
                const r = lookup.get(employee.id);
                const plannedShift = !r && data.shifts?.some(s => s.isActive)
                  ? resolveEmployeeShift(employee, data.shifts, data.shiftAssignments)
                  : null;
                const plannedSchedule = plannedShift && date ? getWorkingScheduleForDate(date, plannedShift) : null;
                const dept = data.departments.find(d => d.id === employee.departmentId)?.name;
                return (
                  <tr key={employee.id}>
                    <td className="hr-employee-cell">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${employee.fullName}`}
                          checked={selected.includes(employee.id)}
                          onChange={e =>
                            setSelected(
                              e.target.checked
                                ? [...selected, employee.id]
                                : selected.filter(id => id !== employee.id)
                            )
                          }
                        />
                        <EmployeeName employee={employee} detail={dept} />
                      </div>
                    </td>
                    <td>{date ? dateLabel(date) : '—'}</td>
                    <td>{r?.shift ?? plannedShift?.name ?? '—'}</td>
                    <td className="text-slate-500">{r?.scheduleIn ?? plannedSchedule?.scheduleIn ?? '—'}</td>
                    <td className="text-slate-500">{r?.scheduleOut ?? plannedSchedule?.scheduleOut ?? '—'}</td>
                    <td className={r?.lateMinutes && !r.isDayOff ? 'font-semibold text-amber-700' : 'text-emerald-700'}>
                      {r?.scanIn ?? '—'}
                      {r?.normalized && !r.rawScanIn && (
                        <span className="ml-1 text-amber-700" title="Scan sumber kosong, dinormalisasi">
                          *
                        </span>
                      )}
                    </td>
                    <td className={r?.earlyMinutes && !r.isDayOff ? 'text-amber-700' : ''}>
                      {r?.scanOut ?? '—'}
                      {r?.normalized && !r.rawScanOut && (
                        <span className="ml-1 text-amber-700" title="Scan sumber kosong, dinormalisasi">
                          *
                        </span>
                      )}
                    </td>
                    <td>
                      {r ? (
                        <Status status={r.attendanceStatus} dayOff={r.isDayOff} />
                      ) : (
                        <span className="text-slate-500">Belum ada data</span>
                      )}
                    </td>
                    <td>
                      {r ? (
                        r.lateMinutes > 0 ? (
                          <span className="font-semibold text-rose-600">
                            {durationLabel(r.lateMinutes)}
                          </span>
                        ) : (
                          <span className="text-slate-400">0 menit</span>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {r ? (
                        <details>
                          <summary className="hr-btn list-none cursor-pointer">
                            Aksi
                            <ChevronDown size={13} />
                          </summary>
                          <div className="mt-2 flex flex-col gap-1">
                            <button className="hr-btn" onClick={() => setDetail(r)}>
                              Detail & riwayat
                            </button>
                            {canWrite && (
                              <button
                                className="hr-btn"
                                disabled={locked}
                                onClick={() => setCorrecting(r)}
                              >
                                Koreksi
                              </button>
                            )}
                          </div>
                        </details>
                      ) : (
                        <div className="flex items-center gap-1">
                          {canWrite && (
                            <button
                              className="hr-btn text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                              disabled={locked}
                              onClick={() => setRecordingEmployee(employee)}
                              title="Catat kehadiran manual, sakit, cuti, izin, atau alpha"
                            >
                              Catat Absensi
                            </button>
                          )}
                          <Link className="hr-btn text-[11px]" href={`/dashboard/attendance/employees/${employee.id}`}>
                            Kartu
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!employees.length && <Empty />}
        <Pagination total={employees.length} page={actualPage} onChange={setPage} />
      </div>

      <p className="text-[11px] text-slate-500">
        <span className="text-amber-700 font-semibold">*</span> Data Excel tidak lengkap, sudah dinormalisasi. Ketidakhadiran tidak disimpulkan dari scan kosong.
      </p>

      {correcting && <CorrectionDialog record={correcting} onClose={() => setCorrecting(null)} />}
      {recordingEmployee && (
        <RecordAttendanceDialog
          employee={recordingEmployee}
          date={date}
          onClose={() => setRecordingEmployee(null)}
        />
      )}
      {detail && <RecordDetails record={detail} onClose={() => setDetail(null)} />}
      {lockOpen && (
        <FormDialog
          title={locked ? 'Buka kunci data' : 'Kunci data absensi'}
          description={`${dateLabel(date)} · Berlaku untuk seluruh karyawan pada tanggal ini. Koreksi dan penyimpanan impor akan ditolak selama terkunci.`}
          fields={[{ name: 'reason', label: 'Alasan', type: 'textarea', required: true }]}
          onClose={() => setLockOpen(false)}
          onSubmit={async f => {
            await execute({
              type: 'lock',
              workDate: date,
              locked: !locked,
              reason: String(f.get('reason')),
            });
          }}
          submitLabel={locked ? 'Buka kunci' : 'Kunci data'}
        />
      )}
      <ModalShell
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Membaca data absensi"
        footer={
          <button className="hr-btn" onClick={() => setHelpOpen(false)}>
            Tutup panduan
          </button>
        }
      >
        <div className="space-y-3 text-sm leading-6 text-slate-600">
          <p>
            Pilih tanggal, lalu klik indikator untuk menampilkan catatan yang sesuai. Cari berdasarkan nama atau ID karyawan.
          </p>
          <p>
            Data awal berasal dari {data.meta.sourceFile ?? 'file sumber'} ({data.meta.sourceRows ?? data.records.length} baris). Jadwal dan durasi mengikuti isi file mesin.
          </p>
          <p>
            Impor menerima file Excel (.xls atau .xlsx) dengan kolom No. ID, Nama, dan Tanggal. Pemetaan, normalisasi dan konflik diperiksa sebelum disimpan.
          </p>
          <p>
            Koreksi membutuhkan alasan. Rekap hanya menghitung catatan final dan tidak menghitung nominal potongan atau upah lembur.
          </p>
        </div>
      </ModalShell>
    </div>
  );
}
