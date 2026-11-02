'use client';

import React from 'react';
import type { DailyAttendanceReportData } from '@/types/dailyAttendance';

interface DailyAttendancePrintDocumentProps {
  data: DailyAttendanceReportData;
}

export function DailyAttendancePrintDocument({ data }: DailyAttendancePrintDocumentProps) {
  if (!data || !data.departments.length) {
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
          .page-break-dept {
            page-break-after: always !important;
            break-after: page !important;
          }
        }
      `}</style>

      {data.departments.map((dept, deptIdx) => {
        const isLastDept = deptIdx === data.departments.length - 1;

        return (
          <div
            key={dept.departmentId || deptIdx}
            className={`print-dept-sheet mb-8 ${!isLastDept ? 'page-break-dept' : ''}`}
          >
            {/* Header Tanggal Terpusat Sesuai Contoh Fisik */}
            <div className="text-center font-bold text-sm mb-2 uppercase tracking-wide">
              {data.formattedDate}
            </div>

            {/* Tabel Format Fisik */}
            <table className="daily-attendance-print-table w-full border-collapse border border-slate-900 text-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 font-bold uppercase text-[11px] text-center border-b border-slate-900">
                  <th className="border border-slate-900 py-1.5 px-2 w-[45px]">No</th>
                  <th className="border border-slate-900 py-1.5 px-3 text-left w-[240px]">
                    {dept.departmentName || 'Karyawan'}
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
                {dept.employees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border border-slate-900 py-6 text-center text-slate-500 italic">
                      Tidak ada karyawan terdaftar pada departemen ini.
                    </td>
                  </tr>
                ) : (
                  dept.employees.map((row) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
