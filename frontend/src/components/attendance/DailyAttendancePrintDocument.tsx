'use client';

import React from 'react';
import type { DailyAttendanceReportData, DailyAttendanceEmployeeRow } from '@/types/dailyAttendance';

interface DailyAttendancePrintDocumentProps {
  data: DailyAttendanceReportData;
  departmentName?: string;
}

export function DailyAttendancePrintDocument({ data, departmentName }: DailyAttendancePrintDocumentProps) {
  // Flatten all employees from all groups into a single list
  const allEmployees: DailyAttendanceEmployeeRow[] = (data?.departments || [])
    .flatMap((dept) => dept.employees)
    .map((emp, idx) => ({
      ...emp,
      no: idx + 1,
    }));

  const displayDeptHeader = departmentName && departmentName !== 'Semua Departemen (Gabungan)'
    ? departmentName.toUpperCase()
    : 'NAMA KARYAWAN';

  if (!data || allEmployees.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans text-sm">
        Tidak ada data absensi untuk dicetak pada tanggal {data?.formattedDate || data?.workDate || '-'}.
      </div>
    );
  }

  return (
    <div className="daily-attendance-print-root text-black font-sans text-xs">
      <style jsx global>{`
        @page {
          size: landscape;
          margin: 8mm 10mm;
        }
        @media print {
          body {
            background-color: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .daily-attendance-print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
          }
          .daily-attendance-print-table th,
          .daily-attendance-print-table td {
            border: 1px solid #000 !important;
            padding: 4px 6px !important;
            color: #000 !important;
          }
          .print-highlight-yellow {
            background-color: #fef08a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-highlight-late {
            background-color: #fca5a5 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Header Tanggal Terpusat Sesuai Contoh Fisik */}
      <div className="text-center font-bold text-sm mb-2 uppercase tracking-wide">
        {data.formattedDate}
      </div>

      {/* 1 Tabel Tunggal Sesuai Contoh Fisik */}
      <table className="daily-attendance-print-table w-full border-collapse border border-slate-900 text-slate-900 text-xs">
        <thead>
          <tr className="bg-slate-100 font-bold uppercase text-[11px] text-center border-b border-slate-900">
            <th className="border border-slate-900 py-1.5 px-2 w-[45px]">No</th>
            <th className="border border-slate-900 py-1.5 px-3 text-left w-[240px]">
              {displayDeptHeader}
            </th>
            <th className="border border-slate-900 py-1.5 px-3 text-left w-[250px]">
              Lokasi Update
            </th>
            <th className="border border-slate-900 py-1.5 px-2 w-[100px]">
              Jam Masuk
            </th>
            <th className="border border-slate-900 py-1.5 px-3 text-left">
              Keterangan
            </th>
          </tr>
        </thead>
        <tbody>
          {allEmployees.map((row) => (
            <tr key={row.employeeId} className="border-b border-slate-900">
              {/* Kolom 1: No */}
              <td className="border border-slate-900 py-1 px-2 text-center font-medium">
                {row.no}
              </td>

              {/* Kolom 2: Nama Karyawan (Stabilo Kuning jika Koordinator/Direktur/Manual) */}
              <td
                className={`border border-slate-900 py-1 px-3 text-left font-semibold ${
                  row.isHighlighted ? 'bg-yellow-200 print-highlight-yellow' : ''
                }`}
              >
                {row.employeeName}
              </td>

              {/* Kolom 3: Lokasi Update */}
              <td className="border border-slate-900 py-1 px-3 text-left">
                {row.locationUpdate || ''}
              </td>

              {/* Kolom 4: Jam Masuk (Merah Muda jika Terlambat) */}
              <td
                className={`border border-slate-900 py-1 px-2 text-center font-mono font-medium ${
                  row.isLate ? 'bg-red-200 print-highlight-late' : ''
                }`}
              >
                {row.scanIn || ''}
              </td>

              {/* Kolom 5: Keterangan */}
              <td className="border border-slate-900 py-1 px-3 text-left uppercase text-[11px] font-medium">
                {row.keterangan || ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
