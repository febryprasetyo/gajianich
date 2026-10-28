import { test, expect, type Route } from '@playwright/test';
import dotenv from '../backend/node_modules/dotenv';
import sharp from '../backend/node_modules/sharp';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { createHrAuditTestDatabase } from '../backend/src/testing/hrAuditDatabase';
import { runMigrations } from '../backend/src/db/migrate';
test.describe.configure({ mode: 'serial' });
let fixture: Awaited<ReturnType<typeof createHrAuditTestDatabase>>;
let storage: string, apiBase: string, token: string, image: Buffer;
let server: Server, closeDatabase: () => Promise<void>;
let user: Record<string, unknown>;
test.beforeAll(async () => {
  dotenv.config({ path: path.resolve('backend/.env'), quiet: true });
  fixture = await createHrAuditTestDatabase(); storage = await mkdtemp(path.join(tmpdir(), 'ga-browser-'));
  await runMigrations(fixture.ownerUrl, path.resolve('backend/drizzle'), fixture.runtimeRole);
  await fixture.owner.query('GRANT SELECT ON users, employees, roles, permissions, role_permissions TO "' + fixture.runtimeRole + '"');
  process.env.DATABASE_URL = fixture.runtime.options.connectionString!; process.env.GA_STORAGE_DIR = storage;
  const { rows: [role] } = await fixture.owner.query("SELECT id FROM roles WHERE code='ga_staff'");
  const { rows: [actor] } = await fixture.owner.query("INSERT INTO users(username,email,password_hash,role_id,role) VALUES('ga_browser','ga_browser@example.test','unused',$1,'GA Staff') RETURNING id", [role.id]);
  const { createApp } = require('../backend/src/app') as typeof import('../backend/src/app');
  const backendDatabase = require('../backend/src/db') as typeof import('../backend/src/db');
  const applicationPool = backendDatabase.db.$client;
  const managedPool = backendDatabase.getPool();
  closeDatabase = async () => { await applicationPool.end(); if (managedPool !== applicationPool) await managedPool.end(); };
  const { generateToken } = await import('../backend/src/utils/jwt');
  user = { id: Number(actor.id), username: 'ga_browser', fullName: 'GA Browser', email: 'ga_browser@example.test', roleId: Number(role.id), roleName: 'GA Staff', permissions: ['ga.requests.view', 'ga.requests.create'] };
  token = generateToken({ userId: Number(actor.id), email: String(user.email), roleId: Number(role.id), roleName: 'GA Staff', permissions: user.permissions as string[] });
  server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
  apiBase = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  image = await sharp(Buffer.from('<svg width="900" height="450" xmlns="http://www.w3.org/2000/svg"><rect width="900" height="450" fill="white"/><text x="40" y="100" font-size="40">Laptop Referensi</text><text x="40" y="180" font-size="40">Rp6.199.000</text></svg>')).png().toBuffer();
});
test.afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await closeDatabase?.();
  await new Promise<void>(resolve => setImmediate(resolve));
  await fixture?.cleanup(); if (storage) await rm(storage, { recursive: true, force: true });
});
test.beforeEach(async ({ page, context }) => {
  await context.addCookies([{ name: 'gajianich_prod_token', value: token, domain: '127.0.0.1', path: '/' }, { name: 'token', value: token, domain: '127.0.0.1', path: '/' }]);
  await page.addInitScript(({ token, user }) => { Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true }); localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); }, { token, user });
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: apiBase + url.pathname + url.search, postData: route.request().postDataBuffer() || undefined });
    await route.fulfill({ response });
  });
});
test('requires proof for every item, pastes screenshots, saves and reopens the form', async ({ page }, info) => {
  test.setTimeout(60000); page.setDefaultTimeout(10000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dashboard/ga/requests/new');
  await expect(page.getByRole('heading', { name: 'Form Permintaan Barang' })).toBeVisible();
  await expect(page.locator('header')).toContainText('Permintaan Barang');
  const sheet = page.getByRole('group', { name: 'Lembar permintaan barang', exact: true });
  await expect(sheet).toHaveCount(1);
  await expect(sheet.getByRole('table', { name: 'Daftar barang', exact: true })).toBeVisible();
  await expect(sheet.getByRole('table', { name: 'Pengesahan permintaan barang', exact: true })).toBeVisible();
  expect(await sheet.evaluate(node => {
    const goods = node.querySelector('table[aria-label="Daftar barang"]')!;
    const signatures = node.querySelector('table[aria-label="Pengesahan permintaan barang"]')!;
    const evidence = node.querySelector('[aria-label="Lampiran bukti harga"]')!;
    return Boolean(goods.compareDocumentPosition(signatures) & Node.DOCUMENT_POSITION_FOLLOWING)
      && Boolean(signatures.compareDocumentPosition(evidence) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBeTruthy();
  for (const [label, value] of [['Nama','Fathiya'], ['Jabatan','GA'], ['Divisi','HR-GA'], ['Nama barang item 1','Laptop'], ['Qty item 1','2'], ['Estimasi harga item 1','6199000']]) await (['Nama', 'Jabatan', 'Divisi'].includes(label) ? page.getByRole('textbox', { name: label, exact: true }) : page.getByLabel(label, { exact: true })).fill(value);
  await expect(page.getByLabel('Subtotal item 1', { exact: true })).toContainText('12.398.000');
  await expect(page.getByLabel('Total estimasi', { exact: true })).toHaveCount(0);
  await page.getByLabel('Nama barang item 1', { exact: true }).focus();
  const focus = await page.getByLabel('Nama barang item 1', { exact: true }).evaluate(node => ({ width: getComputedStyle(node).outlineWidth, style: getComputedStyle(node).outlineStyle }));
  expect(focus.style).not.toBe('none');
  expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
  const logo = sheet.getByRole('img', { name: 'Logo Cahaya Mas Cemerlang (CMC)', exact: true });
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const layout = await sheet.evaluate(node => {
    const inputs = ['requestDate', 'requesterName', 'jobTitle', 'division'].map(id => node.querySelector<HTMLInputElement>('#' + id)!);
    const noQty = Array.from(node.querySelectorAll('table[aria-label="Daftar barang"] th')).slice(0, 2);
    const signatures = Array.from(node.querySelectorAll('table[aria-label="Pengesahan permintaan barang"] tbody td'));
    return {
      inputStarts: inputs.map(input => input.getBoundingClientRect().left),
      colonStarts: inputs.map(input => input.previousElementSibling!.getBoundingClientRect().left),
      noQtyLines: noQty.map(cell => { const range = document.createRange(); range.selectNodeContents(cell); return range.getClientRects().length; }),
      signatureOffsets: signatures.map(cell => { const range = document.createRange(); range.selectNodeContents(cell.firstElementChild!); const text = range.getBoundingClientRect(); const box = cell.getBoundingClientRect(); return Math.abs((text.left + text.right - box.left - box.right) / 2); }),
    };
  });
  expect(new Set(layout.inputStarts).size).toBe(1);
  expect(new Set(layout.colonStarts).size).toBe(1);
  expect(layout.noQtyLines).toEqual([1, 1]);
  expect(layout.signatureOffsets.every(offset => offset < 2)).toBeTruthy();

  await page.getByRole('button', { name: 'Tambah barang' }).click();
  await page.getByLabel('Nama barang item 2', { exact: true }).fill('Mouse');
  await page.getByLabel('Estimasi harga item 2', { exact: true }).fill('150000');
  await expect(page.getByLabel('Subtotal item 2', { exact: true })).toContainText('150.000');
  await page.getByRole('button', { name: 'Simpan Pengajuan', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Item 2' })).toContainText('Item 2');
  await page.getByLabel('Pilih gambar item 1', { exact: true }).setInputFiles({ name: 'harga.png', mimeType: 'image/png', buffer: image });
  await expect(page.getByText('(1/3 gambar)', { exact: false })).toHaveCount(1);
  await page.getByRole('button', { name: 'Simpan Pengajuan', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Item 2' })).toContainText('Item 2');
  await page.getByLabel('Lampiran item 2', { exact: true }).evaluate((element, base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const clipboard = new DataTransfer(); clipboard.items.add(new File([bytes], 'paste.png', { type: 'image/png' }));
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }); Object.defineProperty(pasteEvent, 'clipboardData', { value: clipboard }); element.dispatchEvent(pasteEvent);
  }, image.toString('base64'));
  await expect(page.getByText('(1/3 gambar)', { exact: false })).toHaveCount(2);
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 768) await expect.poll(() => page.locator('aside').evaluate(node => node.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    const bounds = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, overflow: Array.from(document.querySelectorAll('body *')).filter(node => node.getBoundingClientRect().right > innerWidth).slice(0, 15).map(node => ({ tag: node.tagName, cls: node.className, width: node.getBoundingClientRect().width, right: node.getBoundingClientRect().right, overflow: getComputedStyle(node).overflowX })) }));
    await page.screenshot({ path: info.outputPath('ga-form-' + width + '.png'), fullPage: true });
    expect(bounds.scroll, JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.width);
  }
  let releaseFailure!: () => void;
  const failureBarrier = new Promise<void>(resolve => { releaseFailure = resolve; });
  const failFirstSave = async (route: Route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await failureBarrier;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Layanan sementara tidak tersedia. Coba kembali.' }) });
  };
  await page.route('**/api/v1/ga/requests', failFirstSave);
  await page.getByRole('button', { name: 'Simpan Pengajuan', exact: true }).click();
  try {
    await expect(page.getByRole('button', { name: 'Menyimpan...', exact: true })).toBeDisabled();
    await expect(page.getByLabel('Nama barang item 1', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Tambah barang', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Batal', exact: true })).toBeDisabled();
  } finally { releaseFailure(); }
  await expect(page.getByRole('alert').filter({ hasText: 'Layanan sementara tidak tersedia' })).toBeVisible();
  await expect(page.getByLabel('Nama barang item 1', { exact: true })).toHaveValue('Laptop');
  await expect(page.getByText('(1/3 gambar)', { exact: false })).toHaveCount(2);
  await page.unroute('**/api/v1/ga/requests', failFirstSave);
  await page.getByRole('button', { name: 'Simpan Pengajuan', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/ga\/requests\/[0-9a-f-]+\?saved=1/);
  await expect(page.getByText('Pengajuan dan seluruh lampiran berhasil disimpan.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cetak Formulir' })).toBeEnabled();
  await page.reload();
  await expect(page.getByText(/Rp\s*12\.398\.000/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buka bukti harga item 1, gambar 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cetak Formulir' })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('ga-detail.png'), fullPage: true });
  await page.evaluate(() => { (window as Window & { printCalls?: number }).printCalls = 0; window.print = () => { (window as Window & { printCalls?: number }).printCalls!++; }; });
  const pageCount = page.context().pages().length;
  await page.getByRole('button', { name: 'Cetak Formulir' }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { printCalls?: number }).printCalls)).toBe(1);
  expect(page.context().pages()).toHaveLength(pageCount);
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('heading', { name: 'Form Permintaan Barang', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cetak Formulir' })).toBeHidden();
  await page.screenshot({ path: info.outputPath('ga-print.png'), fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('link', { name: 'Daftar permintaan barang', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Fathiya', exact: true })).toBeVisible(); expect(errors).toEqual([]);
  await page.unrouteAll({ behavior: 'wait' });
});
