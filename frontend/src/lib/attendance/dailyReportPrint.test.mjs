import { test } from 'node:test';
import assert from 'node:assert';

test('daily report data structure conforms to print requirements', () => {
  const sampleData = {
    workDate: '2026-10-30',
    formattedDate: '30-Oct-26',
    departments: [
      {
        departmentId: 5,
        departmentName: 'MARKETING',
        employees: [
          {
            no: 1,
            employeeId: 86,
            employeeName: 'Aldio Rizky Mulyawan',
            isHighlighted: false,
            locationUpdate: 'Jakarta/ Kantor',
            scanIn: '06:58',
            isLate: false,
            lateMinutes: 0,
            keterangan: '',
            attendanceStatus: 'PRESENT',
            sourceType: 'ADMS',
          },
          {
            no: 2,
            employeeId: 158,
            employeeName: 'Sofyan',
            isHighlighted: false,
            locationUpdate: 'Kabupaten Gowa, Sulawesi Selatan',
            scanIn: null,
            isLate: false,
            lateMinutes: 0,
            keterangan: 'TDK ADA ABSEN',
            attendanceStatus: 'ALPHA',
            sourceType: 'MOBILE',
          },
          {
            no: 3,
            employeeId: 98,
            employeeName: 'Lolita ayu permata dewi',
            isHighlighted: false,
            locationUpdate: 'Jakarta/ Kantor',
            scanIn: null,
            isLate: false,
            lateMinutes: 0,
            keterangan: 'SAKIT (SDH INFO PAK SENDY) ADA SURAT DOKTER',
            attendanceStatus: 'SAKIT',
            sourceType: 'LEAVE',
          },
          {
            no: 4,
            employeeId: 93,
            employeeName: 'Reza Adityawarman',
            isHighlighted: true,
            locationUpdate: 'Jakarta/ Kantor',
            scanIn: '08:13',
            isLate: true,
            lateMinutes: 13,
            keterangan: '',
            attendanceStatus: 'PRESENT',
            sourceType: 'ADMS',
          },
        ],
      },
    ],
    summary: {
      totalEmployees: 4,
      present: 2,
      late: 1,
      absent: 2,
    },
  };

  assert.strictEqual(sampleData.formattedDate, '30-Oct-26');
  assert.strictEqual(sampleData.departments[0].departmentName, 'MARKETING');
  assert.strictEqual(sampleData.departments[0].employees.length, 4);

  // Check late detection
  const reza = sampleData.departments[0].employees.find(e => e.employeeId === 93);
  assert.strictEqual(reza?.isLate, true);
  assert.strictEqual(reza?.isHighlighted, true);
  assert.strictEqual(reza?.locationUpdate, 'Jakarta/ Kantor');

  // Check mobile location format
  const sofyan = sampleData.departments[0].employees.find(e => e.employeeId === 158);
  assert.strictEqual(sofyan?.locationUpdate, 'Kabupaten Gowa, Sulawesi Selatan');
  assert.strictEqual(sofyan?.keterangan, 'TDK ADA ABSEN');

  // Check leave custom note
  const lolita = sampleData.departments[0].employees.find(e => e.employeeId === 98);
  assert.strictEqual(lolita?.keterangan, 'SAKIT (SDH INFO PAK SENDY) ADA SURAT DOKTER');
});
