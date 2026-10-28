import { test, expect, type Page } from '@playwright/test';

const holder = { id: 81, displayName: 'Karyawan Valid Prod', employeeId: 17, employeeCode: 'EMP-017', origin: 'HRD', verificationStatus: 'VERIFIED', recordStatus: 'ACTIVE' };

async function openCreate(page: Page, roleName = 'SuperAdmin') {
  const user = { id: 1, username: 'it-test', email: 'it@example.test', fullName: 'IT Test', roleName, permissions: ['hardware_audits.view', 'hardware_audits.manage'] };
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ userId: 1, roleName, permissions: user.permissions, exp: 4102444800 })).toString('base64url')}.test`;
  await page.context().addCookies([{ name: 'token', value: token, url: test.info().project.use.baseURL as string }, { name: 'gajianich_prod_token', value: token, url: test.info().project.use.baseURL as string }]);
  await page.addInitScript(({ user, token }) => { localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('token', token); }, { user, token });
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  await page.route('**/api/v1/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/api/v1', '');
    let body: unknown = [];
    if (req.method() === 'POST') {
      requests.push({ path, body: req.postDataJSON() });
      if (path === '/asset-custodians/resolve-employee') body = holder;
      else if (path === '/asset-custodians') body = { ...holder, id: 82, displayName: 'Pemegang Manual', origin: 'MANUAL', employeeId: null, verificationStatus: 'UNVERIFIED' };
      else body = { message: 'Pendaftaran berhasil', assetCode: 'LT-TEST' };
    } else if (path === '/auth/me') body = { user };
    else if (path === '/hardware-audits') body = { data: [{ id: 91, custodianName: 'Nama Mentah Collector', serialNumber: 'TEST-SERIAL', manufacturer: 'Lenovo', model: 'T14', status: 'PENDING', scannedAt: '2026-10-22T00:00:00Z', createdAt: '2026-10-22T00:00:00Z', peripherals: [] }] };
    else if (path === '/assets/categories') body = [{ id: 3, name: 'Laptop', codePrefix: 'LT' }];
    else if (path === '/master/locations') body = [{ id: 1, name: 'Lokasi Prod' }];
    else if (path === '/asset-custodians') body = new URL(req.url()).searchParams.get('search') === 'Pemegang Manual' ? { custodians: [], employees: [] } : { custodians: [], employees: [{ id: 17, employeeCode: 'EMP-017', fullName: holder.displayName }] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/dashboard/hardware-audits');
  await page.getByRole('button', { name: 'Buat Aset Baru' }).click();
  return requests;
}

test('hardware registration requires an explicit custodian, searches HRD and submits stable custodian ID', async ({ page }) => {
  const requests = await openCreate(page);
  const submit = page.getByRole('button', { name: 'Daftarkan ke Inventaris', exact: true });
  await expect(submit).toBeDisabled();
  const search = page.getByRole('combobox').filter({ hasNot: page.locator('option') });
  await search.fill('EMP-017');
  await page.getByRole('button', { name: /Karyawan Valid Prod/ }).click();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText('Pendaftaran berhasil')).toBeVisible();
  expect(requests.find(r => r.path.endsWith('/create-asset'))?.body).toMatchObject({ custodianId: 81, locationId: null });
  expect(requests.find(r => r.path.endsWith('/create-asset'))?.body).not.toHaveProperty('custodianName');
  expect(requests.find(r => r.path === '/asset-custodians/resolve-employee')?.body).toEqual({ employeeId: 17 });
});

test('IT admin can explicitly create a manual custodian before registering hardware', async ({ page }) => {
  const requests = await openCreate(page, 'ITAdmin');
  await page.getByPlaceholder('Search holder name or employee code...').fill('Pemegang Manual');
  await page.getByRole('button', { name: /Add new holder/ }).click();
  await page.getByRole('button', { name: 'Use new holder', exact: true }).click();
  await page.getByRole('button', { name: 'Daftarkan ke Inventaris', exact: true }).click();
  await expect(page.getByText('Pendaftaran berhasil')).toBeVisible();
  expect(requests.find(r => r.path === '/asset-custodians')?.body).toMatchObject({ displayName: 'Pemegang Manual' });
  expect(requests.find(r => r.path.endsWith('/create-asset'))?.body).toMatchObject({ custodianId: 82 });
});

test('IT staff can search HRD without the admin-only manual holder action', async ({ page }) => {
  await openCreate(page, 'ITStaff');
  await page.getByPlaceholder('Search holder name or employee code...').fill('EMP-017');
  await expect(page.getByRole('button', { name: /Karyawan Valid Prod/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Add new holder/ })).toHaveCount(0);
});


test('Available hardware can be registered without assigning the raw collector holder', async ({ page }) => {
  const requests = await openCreate(page);
  await page.getByRole('radio', { name: 'Available (Gudang)' }).check();
  const submit = page.getByRole('button', { name: 'Daftarkan ke Inventaris', exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText('Pendaftaran berhasil')).toBeVisible();
  expect(requests.find(r => r.path.endsWith('/create-asset'))?.body).toMatchObject({ status: 'Available', custodianId: null, locationId: null });
  expect(requests.filter(r => r.path.startsWith('/asset-custodians') && r.body)).toHaveLength(0);
});
