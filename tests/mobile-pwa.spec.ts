import { test, expect } from '@playwright/test';

for (const mode of ['browser', 'standalone', 'fullscreen', 'ios'] as const) {
  test(`PWA layout and install metadata in ${mode} mode`, async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    const user = { id: 12, userId: 12, username: 'pwa-test', email: 'pwa@example.test', fullName: 'PWA Tester', roleName: 'Employee', permissions: [] };
    const token = `test.${Buffer.from(JSON.stringify(user)).toString('base64url')}.test`;
    await context.addCookies([{ name: 'token', value: token, url: baseURL! }]);
    await page.addInitScript(({ user, token, mode }) => {
      localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user));
      if (mode === 'ios') Object.defineProperty(navigator, 'standalone', { value: true });
      if (mode === 'standalone' || mode === 'fullscreen') {
        const original = window.matchMedia.bind(window);
        window.matchMedia = query => {
          const result = original(query);
          if (query.includes(`display-mode: ${mode}`)) Object.defineProperty(result, 'matches', { value: true });
          return result;
        };
      }
    }, { user, token, mode });
    const summary = { employee: { id: 12, employeeCode: 'EMP-12', fullName: user.fullName, position: 'Staff', department: 'Office', avatarInitial: 'PT' }, faceEnrollment: { isFaceEnrolled: false } };
    await page.route('**/api/v1/**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/auth/me') ? { user } : { data: summary } }));
    await page.goto('/m/profile');
    await expect(page.getByRole('heading', { name: 'Profil saya' })).toBeVisible();
    const shell = page.locator('#interactivePhoneWrapper');
    const installed = mode !== 'browser';
    if (installed) await expect(page.locator('.mobile-app-surface')).toHaveAttribute('data-installed', 'true');
    await expect.poll(async () => Math.round((await shell.boundingBox())?.width || 0)).toBe(installed ? 768 : 412);
    if (installed) {
      await expect(shell).toHaveCSS('border-top-width', '0px');
      await expect(shell).toHaveCSS('border-radius', '0px');
      await expect(page.locator('.mobile-device-status')).toBeHidden();
      expect(Math.round((await shell.boundingBox())!.height)).toBe(900);
    } else await expect(page.locator('.mobile-device-status')).toBeVisible();
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', '/manifest.webmanifest');
    const response = await page.request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.display).toBe('fullscreen');
    expect(manifest.display_override).toEqual(['fullscreen', 'standalone']);
    expect('/login'.startsWith(manifest.scope)).toBe(true);
    expect('/change-password'.startsWith(manifest.scope)).toBe(true);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
    await expect(page.getByRole('link', { name: 'Beranda', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (installed) await page.screenshot({ path: `/tmp/gajianich-pwa-${mode}.png`, fullPage: true });
  });
}
