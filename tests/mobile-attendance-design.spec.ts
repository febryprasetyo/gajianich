import { test, expect } from '@playwright/test';

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

for (const width of [360, 390, 768]) {
  test(`fresh mobile attendance, fullscreen capture and review filters at ${width}px`, async ({ page, context, baseURL }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 844 });
    const user = { id: 12, username: 'employee', email: 'employee@example.test', fullName: 'Andini Putri Maharani', roleName: 'Employee', permissions: [] };
    const token = `test.${Buffer.from(JSON.stringify({ ...user, userId: 12 })).toString('base64url')}.test`;
    await context.addCookies([{ name: 'token', value: token, url: baseURL! }]);
    await page.addInitScript(({ user, token }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); }, { user, token });
    await context.grantPermissions(['geolocation', 'camera']);
    await context.setGeolocation({ latitude: -6.2, longitude: 106.8 });
    const employee = { id: 12, fullName: user.fullName, avatarInitial: 'AP', employeeCode: 'EMP-12', position: 'Staff operasional', department: 'Office', workLocation: 'HQ', photoUrl: null };
    const summary = { employee, shift: { id: 1, name: 'Reguler', scheduleIn: '08:00', scheduleOut: '17:00' }, attendance: { workDate: '2026-11-06', checkedIn: false, checkedOut: false, checkInTime: null as string | null, checkOutTime: null as string | null, totalHours: '00:00', status: 'NOT_CHECKED_IN', approvalStatus: null as string | null, approvalNote: '', timeZone: 'Asia/Jakarta', timeZoneLabel: 'WIB', txHash: 'TEST', events: [], isCheckoutCooldown: false, cooldownRemainingMinutes: 0, shiftWindow: { canDirectOut: false } }, faceEnrollment: { isFaceEnrolled: true, faceId: 'TEST' } };
    const records = [
      { id: 1, workDate: '2026-11-06', dayShort: 'Jum', dateStr: '06 Nov', clockIn: '07:43', clockOut: '--:--', workHours: '00:00', status: 'CHECKED_IN', statusText: 'Tepat waktu', approvalStatus: 'PENDING', approvalNote: 'Menunggu pemeriksaan', schedule: '08:00–17:00', events: [] },
      { id: 2, workDate: '2026-11-05', dayShort: 'Kam', dateStr: '05 Nov', clockIn: '08:12', clockOut: '17:01', workHours: '08:49', status: 'LATE', statusText: 'Terlambat', approvalStatus: 'REJECTED', approvalNote: 'Foto gelap', schedule: '08:00–17:00', events: [] },
      { id: 3, workDate: '2026-11-04', dayShort: 'Rab', dateStr: '04 Nov', clockIn: '07:45', clockOut: '17:02', workHours: '09:17', status: 'ON_TIME', statusText: 'Tercatat', approvalStatus: undefined, approvalNote: 'Tercatat di sistem kantor.', schedule: '08:00–17:00', events: [] },
    ];
    let submitted: Record<string, unknown>[] = [];
    let failNext = false;
    let holdNextSummary = false;
    let releaseSummary: (() => void) | undefined;
    let historyUnauthorized = false;
    let reverseGeocodingRequests = 0;
    await page.route('https://nominatim.openstreetmap.org/**', route => { reverseGeocodingRequests++; return route.fulfill({ json: { display_name: 'Kantor pusat', address: { road: 'Jalan Kantor', city: 'Jakarta' } } }); });
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/me')) return route.fulfill({ json: { user } });
      if (path.endsWith('/summary')) {
        const snapshot = structuredClone(summary);
        if (holdNextSummary) { holdNextSummary = false; await new Promise<void>(resolve => { releaseSummary = resolve; }); }
        return route.fulfill({ json: { data: snapshot } });
      }
      if (path.endsWith('/history') && historyUnauthorized) return route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
      if (path.endsWith('/history')) {
        const previous = new URL(route.request().url()).searchParams.get('period') === 'PREVIOUS';
        const periodOptions = [
          { value: 'CURRENT', label: 'Oktober 2026', startDate: '2026-10-21', endDate: '2026-11-20' },
          { value: 'PREVIOUS', label: 'September 2026', startDate: '2026-09-21', endDate: '2026-10-20' },
        ];
        return route.fulfill({ json: { data: { records: previous ? [] : records, monthName: previous ? 'September 2026' : 'Oktober 2026', periodOptions, ...periodOptions[previous ? 1 : 0] } } });
      }
      if (path.endsWith('/clock')) {
        submitted.push(route.request().postDataJSON());
        if (failNext) { failNext = false; return route.fulfill({ status: 422, json: { message: 'Foto kurang jelas. Silakan ulangi.' } }); }
        const eventType = submitted[submitted.length - 1].eventType;
        summary.attendance.checkedIn = true; summary.attendance.checkedOut = eventType === 'OUT'; summary.attendance.checkInTime = '07:43'; summary.attendance.status = eventType === 'OUT' ? 'COMPLETED' : 'CHECKED_IN'; summary.attendance.approvalStatus = 'PENDING';
        return route.fulfill({ json: { success: true, data: { workDate: '2026-11-06', eventType, scanTime: '07:43', timeZoneLabel: 'WIB', approvalStatus: 'PENDING', approvalNote: 'Menunggu pemeriksaan HRD.', isWithinGeofence: true, distanceMeters: 24, txHash: 'TEST' } } });
      }
      return route.fulfill({ json: { success: true } });
    });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/m/beranda');
    await expect(page.getByRole('heading', { name: user.fullName })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Presensi', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Buka profil saya' })).toHaveAttribute('href', '/m/profile');
    await expect(page.getByRole('button', { name: 'Absen Masuk dengan verifikasi wajah' })).toBeEnabled();
    await page.screenshot({ path: `/tmp/gajianich-new-home-${width}.png`, fullPage: true });
    expect(reverseGeocodingRequests).toBe(0);
    await expect(page.getByRole('heading', { name: 'Presensi luar kantor' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Absen Masuk dengan verifikasi wajah' }).click();
    const camera = page.getByRole('dialog');
    await expect(camera.getByRole('button', { name: 'Ambil foto dan presensi' })).toBeEnabled({ timeout: 15000 });
    const bounds = await camera.boundingBox(); expect(bounds?.width).toBe(width); expect(bounds?.height).toBe(844);
    await page.evaluate(() => { (window as any).__cameraStream = (document.querySelector('video') as HTMLVideoElement).srcObject; });
    await page.screenshot({ path: `/tmp/gajianich-new-camera-${width}.png`, fullPage: true });
    holdNextSummary = true;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => Boolean(releaseSummary)).toBe(true);
    failNext = true;
    await camera.getByRole('button', { name: 'Ambil foto dan presensi' }).click();
    await expect(camera.getByRole('alert')).toContainText('Foto kurang jelas');
    await camera.getByRole('button', { name: 'Ambil foto dan presensi' }).click();
    await expect(page.getByRole('heading', { name: 'Presensi masuk tercatat' })).toBeVisible();
    expect(submitted).toHaveLength(2); expect(submitted[1].eventType).toBe('IN'); expect(String(submitted[1].photoBase64)).toContain('data:image/jpeg;base64,');
    await expect.poll(() => page.evaluate(() => (window as any).__cameraStream.getTracks().every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
    const staleResponse = page.waitForResponse(response => response.url().endsWith('/attendance/mobile/summary'));
    releaseSummary!();
    await staleResponse;
    await page.getByRole('button', { name: 'Selesai', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Absen Pulang dengan verifikasi wajah' })).toBeVisible();
    summary.attendance.isCheckoutCooldown = true; summary.attendance.cooldownRemainingMinutes = 23;
    await page.reload();
    await expect(page.getByRole('button', { name: 'Jeda pulang 23m dengan verifikasi wajah' })).toBeDisabled();
    summary.attendance.isCheckoutCooldown = false; summary.attendance.checkedOut = true; summary.attendance.checkOutTime = '17:04';
    await page.reload();
    await expect(page.getByRole('button', { name: 'Perbarui Pulang dengan verifikasi wajah' })).toBeEnabled();
    summary.attendance.checkedIn = false; summary.attendance.checkedOut = false; summary.attendance.shiftWindow.canDirectOut = true;
    await page.reload();
    await page.getByRole('button', { name: 'Absen Masuk dengan verifikasi wajah' }).click();
    await expect(page.getByRole('button', { name: 'Lanjutkan Presensi' })).toBeDisabled();
    await page.getByLabel('Keterangan Kehadiran Pagi').fill('Hadir pukul 08.00, lupa absen masuk.');
    await page.getByRole('button', { name: 'Lanjutkan Presensi' }).click();
    await expect(page.getByRole('button', { name: 'Ambil foto dan presensi' })).toBeEnabled();
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Ambil foto dan presensi' })).toBeDisabled();
    await context.setOffline(false);
    await expect(page.getByRole('button', { name: 'Ambil foto dan presensi' })).toBeEnabled();
    await page.getByRole('button', { name: 'Ambil foto dan presensi' }).click();
    await expect(page.getByRole('heading', { name: 'Presensi pulang tercatat' })).toBeVisible();
    expect(submitted[2]).toMatchObject({ eventType: 'OUT', isDirectOut: true, notes: 'Hadir pukul 08.00, lupa absen masuk.' });
    await page.getByRole('button', { name: 'Selesai', exact: true }).click();
    await page.getByRole('link', { name: 'Presensi', exact: true }).click();
    await expect(page.getByRole('button').filter({ hasText: '04 Nov' })).toContainText('Tercatat');
    await expect(page.getByRole('button').filter({ hasText: '04 Nov' })).not.toContainText('Belum diajukan');
    const periodPicker = page.getByRole('combobox', { name: 'Periode presensi' });
    await expect(periodPicker.locator('option:checked')).toHaveText('Periode Oktober 2026');
    await expect(page.getByText('21 Okt 2026 – 20 Nov 2026')).toBeVisible();
    await periodPicker.selectOption('PREVIOUS');
    await expect(periodPicker.locator('option:checked')).toHaveText('Periode September 2026');
    await expect(page.getByText('21 Sep 2026 – 20 Okt 2026')).toBeVisible();
    await periodPicker.selectOption('CURRENT');
    await expect(page.getByRole('button').filter({ hasText: '06 Nov' })).toBeVisible();
    await page.getByRole('button', { name: /Ditolak.*1/ }).click();
    await expect(page.getByRole('button').filter({ hasText: '05 Nov' })).toBeVisible();
    await expect(page.getByRole('button').filter({ hasText: '06 Nov' })).toHaveCount(0);
    await page.getByPlaceholder('Cari tanggal atau catatan…').fill('tidak cocok');
    await expect(page.getByText('Tidak ada catatan yang cocok')).toBeVisible();
    await page.getByRole('button', { name: 'Reset Filter' }).click();
    await expect(page.getByRole('button').filter({ hasText: '06 Nov' })).toBeVisible();
    await page.screenshot({ path: `/tmp/gajianich-new-history-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Profil', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Profil saya' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Profil', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.screenshot({ path: `/tmp/gajianich-new-profile-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    const homeLink = page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Beranda', exact: true });
    const homeHit = await homeLink.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + 8, rect.y + rect.height / 2);
      return { clear: hit?.closest('a') === element, blocker: hit?.tagName };
    });
    expect(homeHit.clear, `Home touch target is obstructed by ${homeHit.blocker}`).toBe(true);
    await homeLink.click({ position: { x: 8, y: 28 } });
    await expect(page).toHaveURL(/\/m\/beranda/);

    summary.attendance.checkedIn = true; summary.attendance.checkedOut = true;
    summary.attendance.checkInTime = '07:45'; summary.attendance.checkOutTime = '17:02';
    summary.attendance.approvalStatus = null;
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Presensi kantor tercatat' })).toBeVisible();
    await expect(page.getByText('Belum diajukan', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Tidak perlu mengajukan presensi mobile', { exact: false })).toBeVisible();
    await expect(page.getByText('07:45', { exact: true })).toBeVisible();
    await page.screenshot({ path: `/tmp/gajianich-office-attendance-${width}.png`, fullPage: true });
    historyUnauthorized = true;
    await page.goto('/m/presensi');
    await expect(page).toHaveURL(/\/login/);
  });
}
