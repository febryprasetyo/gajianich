import test from 'node:test';
import assert from 'node:assert/strict';

test('greeting follows employee timezone and attendance state', async () => {
  const { mobileGreeting } = await import('./mobilePresentation.ts');
  const at = new Date('2026-11-06T00:30:00Z');
  assert.equal(mobileGreeting(at, 'Asia/Jakarta', false).salutation, 'Selamat pagi');
  assert.equal(mobileGreeting(new Date('2026-11-06T08:00:00Z'), 'Asia/Jakarta', true).salutation, 'Selamat sore');
  assert.equal(mobileGreeting(at, 'Asia/Jakarta', true).message, 'Terima kasih untuk kerja hari ini.');
});

test('review filters and search combine without mixing attendance with approval', async () => {
  const { filterMobileHistory } = await import('./mobilePresentation.ts');
  const records = [
    { approvalStatus: 'PENDING', statusText: 'Tepat waktu', dateStr: '06 Nov', workDate: '2026-11-06' },
    { approvalStatus: 'REJECTED', statusText: 'Terlambat', dateStr: '05 Nov', workDate: '2026-11-05', approvalNote: 'Foto gelap' },
    { approvalStatus: 'APPROVED', statusText: 'Terlambat', dateStr: '04 Nov', workDate: '2026-11-04' },
  ];
  assert.deepEqual(filterMobileHistory(records, 'REJECTED', 'FOTO'), [records[1]]);
  assert.deepEqual(filterMobileHistory(records, 'PENDING', '05'), []);
  assert.equal(filterMobileHistory(records, 'ALL', '').length, 3);
});

test('capture cannot submit offline, without GPS, or with device error', async () => {
  const { canCaptureAttendance } = await import('./mobilePresentation.ts');
  const ready = { online: true, enrolled: true, cameraReady: true, busy: false, locationLoading: false, latitude: 0, longitude: 0, locationError: null };
  assert.equal(canCaptureAttendance(ready), true);
  for (const change of [{ online: false }, { enrolled: false }, { cameraReady: false }, { busy: true }, { locationLoading: true }, { latitude: null }, { longitude: null }, { locationError: 'GPS blocked' }]) {
    assert.equal(canCaptureAttendance({ ...ready, ...change }), false);
  }
});


test('mobile payroll ranges stay aligned with the recap period definition', async () => {
  const { attendancePayrollPeriod } = await import('../../../../backend/src/domain/attendancePayrollPeriod.ts');
  const { getPayrollCyclePeriod } = await import('./scheduleShift.ts');
  for (const year of [2024, 2026, 2027]) for (let month = 1; month <= 12; month++) {
    const recap = getPayrollCyclePeriod(year, month);
    const mobile = attendancePayrollPeriod(`${year}-${String(month).padStart(2, '0')}-21`);
    assert.deepEqual(mobile, { startDate: recap.startDate, endDate: recap.endDate, label: recap.label });
    assert.deepEqual(attendancePayrollPeriod(recap.endDate), mobile);
  }
});

test('office attendance is recorded without inventing an HR approval', async () => {
  const { attendanceReviewPresentation } = await import('./mobilePresentation.ts');
  const office = attendanceReviewPresentation(null, true);
  assert.equal(office.label, 'Tercatat');
  assert.equal(office.title, 'Presensi kantor tercatat');
  assert.equal(office.variant, 'success');
  assert.doesNotMatch(office.description, /belum diajukan|menunggu pemeriksaan/i);
  const pending = attendanceReviewPresentation('PENDING', true);
  assert.equal(pending.label, 'Menunggu HRD');
  assert.equal(pending.title, 'Pengajuan luar kantor');
  assert.equal(attendanceReviewPresentation('REJECTED', true).label, 'Ditolak');
  const empty = attendanceReviewPresentation(null, false);
  assert.equal(empty.title, 'Presensi luar kantor');
  assert.equal(empty.label, 'Belum ada catatan');
});
