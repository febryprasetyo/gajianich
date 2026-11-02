import * as XLSX from 'xlsx';
import type { DailyAttendanceReportData } from '@/types/dailyAttendance';

/**
 * Exports the daily attendance report data to Excel in landscape table layout
 */
export function exportDailyAttendanceToExcel(data: DailyAttendanceReportData) {
  const wb = XLSX.utils.book_new();

  for (const dept of data.departments) {
    const sheetData: (string | number)[][] = [
      ['LAPORAN ABSENSI HARIAN'],
      ['Tanggal:', data.formattedDate || data.workDate],
      ['Departemen:', dept.departmentName],
      [],
      ['No', dept.departmentName, 'Lokasi Update', 'Jam Masuk', 'Keterangan'],
    ];

    dept.employees.forEach((emp) => {
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
      { wch: 30 }, // Nama Karyawan
      { wch: 32 }, // Lokasi Update
      { wch: 14 }, // Jam Masuk
      { wch: 38 }, // Keterangan
    ];

    const safeSheetName = (dept.departmentName || 'Presensi').slice(0, 30).replace(/[:\\/?*[\]]/g, '_');
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  }

  const filename = `Laporan_Absensi_Harian_${data.workDate || 'export'}.xlsx`;
  XLSX.writeFile(wb, filename);
}
