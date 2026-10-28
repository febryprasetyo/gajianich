import { test, expect } from '@playwright/test';

for (const width of [360, 390, 768, 1280]) {
  test(`Dinas Luar can be recorded and corrected at ${width}px`, async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const user = { id: 1, username: 'field-duty-test', email: 'hr@example.test', fullName: 'HR Test', roleName: 'SuperAdmin', permissions: ['*'] };
    const token = `test.${Buffer.from(JSON.stringify({ ...user, userId: 1 })).toString('base64url')}.test`;
    await context.addCookies([{ name: 'gajianich_prod_token', value: token, url: baseURL! }]);
    await page.addInitScript(({ user, token }) => {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
    }, { user, token });
    let workspace = {
      schemaVersion: 1,
      meta: { defaultDate: '2026-10-21', periodStart: '2026-10-01', actor: user.fullName, role: 'HR_ADMIN', canManageAccess: true },
      departments: [], locations: [], sources: [], identities: [], batches: [], audit: [], revisions: [], grants: [], locks: [],
      employees: [{ id: 1, employeeCode: 'TEST-1', fullName: 'Karyawan Pengujian', email: '', departmentId: null, locationId: null, position: 'Staff', isActive: true }],
      shifts: [{ id: 1, code: 'OFFICE', name: 'Office', scheduleIn: '08:00', scheduleOut: '17:00', workDays: 5, isDefault: true, isActive: true }],
      shiftAssignments: [], records: [] as Record<string, unknown>[],
    };
    const commands: Record<string, any>[] = [];
    let rejectCorrection = true;
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/me')) return route.fulfill({ json: { user } });
      if (path.endsWith('/attendance/workspace')) return route.fulfill({ json: { success: true, data: workspace } });
      if (path.endsWith('/attendance/commands')) {
        const { command } = route.request().postDataJSON();
        commands.push(command);
        if (command.type === 'correct' && rejectCorrection) {
          rejectCorrection = false;
          return route.fulfill({ status: 409, json: { error: 'Data sudah berubah. Muat ulang sebelum menyimpan.' } });
        }
        const record = { id: 1, employeeId: 1, workDate: '2026-10-21', shift: 'Office', scheduleIn: '08:00', scheduleOut: '17:00', scanIn: '08:00', scanOut: '17:00', rawScanIn: null, rawScanOut: null, lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0, attendanceStatus: 'DINAS_LUAR', isDayOff: false, normalized: false, revision: command.type === 'correct' ? 2 : 1, sourceBatchId: null };
        workspace = { ...workspace, records: [record] };
        return route.fulfill({ json: { success: true, data: { changed: true, eventId: '1', data: workspace } } });
      }
      return route.fulfill({ json: [] });
    });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/dashboard/attendance');
    await page.getByRole('button', { name: 'Catat Absensi', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Kategori hari').selectOption('DINAS_LUAR');
    await expect(dialog.getByText('Scan efektif Dinas Luar', { exact: true })).toBeVisible();
    await expect(dialog.locator('input[type="time"]')).toHaveCount(0);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/gajianich-dinas-luar-${width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Simpan Data' }).click();
    await expect(dialog).toHaveCount(0);
    expect(commands[0]).toMatchObject({ type: 'record_attendance', attendanceStatus: 'DINAS_LUAR', isDayOff: false, scanIn: null, scanOut: null });

    await page.reload();
    await expect(page.locator('tbody').getByText('Dinas Luar', { exact: true })).toBeVisible();
    await page.locator('summary').filter({ hasText: 'Aksi' }).click();
    await page.getByRole('button', { name: 'Koreksi', exact: true }).click();
    await expect(dialog.getByLabel('Kategori hari')).toHaveValue('DINAS_LUAR');
    await dialog.getByRole('button', { name: 'Simpan perubahan' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Data sudah berubah');
    await expect(dialog.getByLabel('Kategori hari')).toHaveValue('DINAS_LUAR');
    await dialog.getByRole('button', { name: 'Simpan perubahan' }).click();
    await expect(dialog).toHaveCount(0);
    expect(commands.at(-1)).toMatchObject({ type: 'correct', expectedRevision: 1, values: { attendanceStatus: 'DINAS_LUAR', isDayOff: false } });
    await page.getByRole('button', { name: 'Detail & riwayat' }).click();
    await expect(dialog.getByText('Dinas Luar', { exact: true })).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
