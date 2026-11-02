import * as XLSX from 'xlsx';
import type { DailyAttendanceReportData, DailyAttendanceEmployeeRow } from '@/types/dailyAttendance';

/**
 * Exports the daily attendance report data to Excel in 1 single landscape table layout
 */
export function exportDailyAttendanceToExcel(data: DailyAttendanceReportData, departmentName?: string) {
  const wb = XLSX.utils.book_new();

  const allEmployees: DailyAttendanceEmployeeRow[] = (data?.departments || [])
    .flatMap((dept) => dept.employees)
    .map((emp, idx) => ({
      ...emp,
      no: idx + 1,
    }));

  const deptHeader = departmentName && departmentName !== 'Semua Departemen (Gabungan)'
    ? departmentName.toUpperCase()
    : 'NAMA KARYAWAN';

  const sheetData: (string | number)[][] = [
    ['LAPORAN ABSENSI HARIAN'],
    ['Tanggal:', data.formattedDate || data.workDate],
    ['Departemen:', departmentName || 'Semua Departemen'],
    [],
    ['No', deptHeader, 'Lokasi Update', 'Jam Masuk', 'Keterangan'],
  ];

  allEmployees.forEach((emp) => {
    sheetData.push([
      emp.no,
      emp.employeeName,
      emp.locationUpdate || '',
      emp.scanIn || '',
      emp.keterangan || '',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 30 }, // Nama Karyawan / Departemen
    { wch: 32 }, // Lokasi Update
    { wch: 14 }, // Jam Masuk
    { wch: 38 }, // Keterangan
  ];

  const safeSheetName = (departmentName || 'Presensi Harian').slice(0, 30).replace(/[:\\/?*[\]]/g, '_');
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  const filename = `Laporan_Absensi_Harian_${data.workDate || 'export'}.xlsx`;
  XLSX.writeFile(wb, filename);
}
