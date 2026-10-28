import { test, expect } from '@playwright/test';

function createMockJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.mocksig`;
}

test.describe('HR Activity Audit History Page', () => {
  test('unauthenticated visit to /dashboard/attendance/activity redirects to /login', async ({ page }) => {
    await page.goto('/dashboard/attendance/activity');
    await expect(page).toHaveURL(/\/login/);
  });

  test('displays activity audit shell and controls when authenticated with mock state or login', async ({ page, context }) => {
    const mockUser = {
      id: 1,
      userId: 1,
      username: 'superadmin',
      fullName: 'Super Administrator',
      email: 'admin@example.com',
      roleName: 'superadmin',
      permissions: ['attendance.view', 'attendance.manage', 'hr.audit.view'],
    };

    const mockToken = createMockJwt({
      userId: 1,
      username: 'superadmin',
      roleName: 'superadmin',
      permissions: ['attendance.view', 'attendance.manage', 'hr.audit.view'],
    });

    await context.addCookies([
      { name: 'token', value: mockToken, domain: '127.0.0.1', path: '/' },
      { name: 'gajianich_prod_token', value: mockToken, domain: '127.0.0.1', path: '/' },
    ]);

    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: mockToken, user: mockUser });

    // Mock API requests
    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname.includes('/auth/me')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: mockUser }),
        });
      }

      if (url.pathname.includes('/attendance/workspace')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              sources: [],
              identities: [],
              shifts: [],
              assignments: [],
              locks: [],
              grants: [],
              importBatches: [],
              systemSettings: { strictIntegrity: true },
            }
          }),
        });
      }

      if (url.pathname.includes('/hr/activities/actors')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            items: [
              { id: '1', username: 'superadmin', name: 'Super Administrator' },
              { id: '2', username: 'hr_staff', name: 'Staff HRD' },
            ],
            nextCursor: null,
          }),
        });
      }

      if (url.pathname.includes('/targets')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            targets: [
              {
                id: '101',
                entityType: 'shift',
                entityId: '1',
                entityLabel: 'Shift Kantor Pusat',
                before: { clockIn: '08:00', clockOut: '17:00' },
                after: { clockIn: '08:30', clockOut: '17:30' },
                changedFields: ['clockIn', 'clockOut'],
              }
            ],
            nextCursor: null,
          }),
        });
      }

      if (url.pathname.includes('/hr/activities/1')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            event: {
              id: '1',
              occurredAt: '2026-10-19T08:00:00.000Z',
              operationId: '11111111-2222-3333-4444-555555555555',
              actor: { id: '1', username: 'superadmin', name: 'Super Administrator' },
              action: 'UPDATE',
              entityType: 'shift',
              entityId: '1',
              entityLabel: 'Shift Kantor Pusat',
              outcome: 'SUCCESS',
              summary: 'Mengubah jam kerja shift Kantor Pusat menjadi 08:30 - 17:30',
              targetCount: 1,
            },
            metadata: {},
            targets: [
              {
                id: '101',
                entityType: 'shift',
                entityId: '1',
                entityLabel: 'Shift Kantor Pusat',
                before: { clockIn: '08:00', clockOut: '17:00' },
                after: { clockIn: '08:30', clockOut: '17:30' },
                changedFields: ['clockIn', 'clockOut'],
              }
            ],
            nextTargetCursor: null,
          }),
        });
      }

      if (url.pathname.includes('/hr/activities')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            items: [
              {
                id: '1',
                occurredAt: '2026-10-19T08:00:00.000Z',
                operationId: '11111111-2222-3333-4444-555555555555',
                actor: { id: '1', username: 'superadmin', name: 'Super Administrator' },
                action: 'UPDATE',
                entityType: 'shift',
                entityId: '1',
                entityLabel: 'Shift Kantor Pusat',
                outcome: 'SUCCESS',
                summary: 'Mengubah jam kerja shift Kantor Pusat menjadi 08:30 - 17:30',
                targetCount: 1,
              }
            ],
            nextCursor: null,
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/dashboard/attendance/activity');

    // Page title and heading
    await expect(page.getByRole('heading', { name: 'Riwayat Aktivitas HR' })).toBeVisible();
    await expect(page.getByText('Audit trail server append-only')).toBeVisible();

    // Filters should be visible
    await expect(page.getByPlaceholder('ID, nama, atau keterangan...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Terapkan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();

    // Audit event table row should render
    await expect(page.getByText('Shift Kantor Pusat', { exact: true })).toBeVisible();
    await expect(page.getByText('Mengubah jam kerja shift Kantor Pusat menjadi 08:30 - 17:30')).toBeVisible();
    await expect(page.getByText('Super Administrator').first()).toBeVisible();

    // Detail button opens drawer
    const detailBtn = page.getByRole('button', { name: 'Detail' }).first();
    await expect(detailBtn).toBeVisible();
    await detailBtn.click();

    // Detail drawer assertions
    await expect(page.getByText('Pelaku (Identitas Akun Server)')).toBeVisible();
    await expect(page.getByText(/Target Objek Terdampak/)).toBeVisible();
    await expect(page.getByText('clockIn')).toBeVisible();
    await expect(page.getByText('clockOut')).toBeVisible();
  });

  test('adapts layout cleanly on mobile viewport (390px)', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const mockUser = {
      id: 1,
      userId: 1,
      username: 'superadmin',
      fullName: 'Super Administrator',
      email: 'admin@example.com',
      roleName: 'superadmin',
      permissions: ['attendance.view', 'attendance.manage', 'hr.audit.view'],
    };

    const mockToken = createMockJwt({
      userId: 1,
      username: 'superadmin',
      roleName: 'superadmin',
      permissions: ['attendance.view', 'attendance.manage', 'hr.audit.view'],
    });

    await context.addCookies([
      { name: 'token', value: mockToken, domain: '127.0.0.1', path: '/' },
      { name: 'gajianich_prod_token', value: mockToken, domain: '127.0.0.1', path: '/' },
    ]);

    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: mockToken, user: mockUser });

    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname.includes('/auth/me')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: mockUser }),
        });
      }

      if (url.pathname.includes('/attendance/workspace')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              sources: [],
              identities: [],
              shifts: [],
              assignments: [],
              locks: [],
              grants: [],
              importBatches: [],
              systemSettings: { strictIntegrity: true },
            }
          }),
        });
      }

      if (url.pathname.includes('/hr/activities/actors')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, items: [], nextCursor: null }),
        });
      }

      if (url.pathname.includes('/hr/activities')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, items: [], nextCursor: null }),
        });
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.goto('/dashboard/attendance/activity');
    await expect(page.getByRole('heading', { name: 'Riwayat Aktivitas HR' })).toBeVisible();
    await expect(page.getByText('Tidak ada riwayat aktivitas')).toBeVisible();
  });
});
