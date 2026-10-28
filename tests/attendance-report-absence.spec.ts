import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`report separates four non-present categories and exports at ${width}px`, async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date('2026-09-30T05:00:00Z') });
    const user = { id: 1, username: 'report-test', email: 'hr@example.test', fullName: 'HR Test', roleName: 'SuperAdmin', permissions: ['*'] };
    const token = `test.${Buffer.from(JSON.stringify({ ...user, userId: 1 })).toString('base64url')}.test`;
    await context.addCookies(['token', 'gajianich_prod_token'].map(name => ({ name, value: token, url: baseURL! })));
    await page.addInitScript(({ user, token }) => {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
    }, { user, token });
    const workspace = {
      schemaVersion: 1,
      meta: { defaultDate: '2026-09-30', periodStart: '2026-09-21', actor: 'HR Test', role: 'HR_ADMIN', canManageAccess: true },
      employees: [
        { id: 1, employeeCode: 'TEST-1', fullName: 'Karyawan Dengan Alpha', email: '', departmentId: 1, locationId: null, position: 'Staff', isActive: true },
        { id: 2, employeeCode: 'TEST-2', fullName: 'Karyawan Tanpa Catatan', email: '', departmentId: 2, locationId: null, position: 'Staff', isActive: true },
      ],
      departments: [{ id: 1, code: 'HR', name: 'HR', isActive: true }, { id: 2, code: 'IT', name: 'IT', isActive: true }],
      locations: [], sources: [], identities: [], batches: [], audit: [], revisions: [], grants: [], locks: [],
      records: ['PRESENT', 'IZIN', 'CUTI', 'SAKIT', 'ALPHA', 'DINAS_LUAR'].map((attendanceStatus, i) => ({ id: i + 1, employeeId: 1, workDate: `2026-09-${21 + i}`, attendanceStatus, isDayOff: false, lateMinutes: 0, overtimeMinutes: 0, earlyMinutes: 0, revision: 1 })),
    };
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/me')) return route.fulfill({ json: { user } });
      if (path.endsWith('/attendance/workspace')) return route.fulfill({ json: { success: true, data: workspace } });
      return route.fulfill({ json: [] });
    });
    await page.goto('/dashboard/attendance/reports');
    await expect(page.getByRole('columnheader', { name: 'Tidak Hadir', exact: true })).toBeVisible();
    const row = page.getByRole('row').filter({ hasText: 'Karyawan Dengan Alpha' });
    await expect(row.getByRole('cell').nth(2)).toHaveText('2');
    for (const index of [5, 6, 7, 8]) await expect(row.getByRole('cell').nth(index)).toHaveText('1');
    await expect(page.getByRole('row').filter({ hasText: 'Karyawan Tanpa Catatan' }).getByRole('cell').nth(8)).toHaveText('0');
    await page.getByRole('button', { name: 'Ekspor', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh Excel (.xlsx)', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^rekap-absensi-.*\.xlsx$/);
    expect(await download.failure()).toBeNull();
    await page.getByLabel('Filter Departemen').selectOption('2');
    await expect(page.getByRole('row').filter({ hasText: 'Karyawan Dengan Alpha' })).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: 'Karyawan Tanpa Catatan' }).getByRole('cell').nth(8)).toHaveText('0');
    await page.goto('/dashboard/attendance/employees/1');
    const alphaFilter = page.getByRole('button', { name: '1 Tidak hadir', exact: true });
    await expect(alphaFilter).toBeVisible();
    await alphaFilter.click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}
