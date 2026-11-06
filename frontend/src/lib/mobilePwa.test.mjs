import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const manifest = createRequire(import.meta.url)('../app/manifest.ts').default;
const { NextRequest } = createRequire(import.meta.url)('next/server');
const { proxy } = createRequire(import.meta.url)('../proxy.ts');

function launch(path, user) {
  const token = `test.${Buffer.from(JSON.stringify(user)).toString('base64url')}.test`;
  return proxy(new NextRequest(`https://gajianich.example${path}`, {
    headers: { cookie: `token=${token}` },
  }));
}

test('PWA starts at the account-aware entry point', () => {
  assert.equal(manifest().start_url, '/');
});

test('admin launches from the old mobile start URL reach their desktop workspace', () => {
  for (const [roleName, permissions, target] of [
    ['SuperAdmin', ['*'], '/dashboard/assets/overview'],
    ['Admin', [], '/dashboard/access'],
    ['HRD', ['attendance.view'], '/dashboard/attendance/overview'],
  ]) {
    for (const path of ['/m', '/m/beranda', '/m/beranda/']) {
      assert.equal(new URL(launch(path, { roleName, permissions }).headers.get('location')).pathname, target);
    }
  }
});

test('employee launches retain mobile access and required password changes take precedence', () => {
  for (const roleName of ['Employee', 'Karyawan']) {
    assert.equal(launch('/m/beranda', { roleName }).headers.get('location'), null);
    assert.equal(new URL(launch('/dashboard', { roleName }).headers.get('location')).pathname, '/m/beranda');
  }
  assert.equal(new URL(launch('/m/beranda', { roleName: 'Admin', mustChangePassword: true }).headers.get('location')).pathname, '/change-password');
});

test('admin direct links to mobile profile remain available', () => {
  assert.equal(launch('/m/profile', { roleName: 'SuperAdmin', permissions: ['*'] }).headers.get('location'), null);
});

test('installed PWA requests fullscreen and keeps login/password/mobile routes in scope', () => {
  const app = manifest();
  assert.equal(app.display, 'fullscreen');
  assert.deepEqual(app.display_override, ['fullscreen', 'standalone']);
  assert.equal(app.id, '/m/beranda');
  for (const route of ['/m/beranda', '/m/presensi', '/m/profile', '/login', '/change-password']) {
    assert.ok(route.startsWith(app.scope), `${route} must remain inside the installed app`);
  }
  assert.notEqual(app.scope, '');
});

test('install icons have the dimensions advertised by the manifest', async () => {
  for (const icon of manifest().icons) {
    const png = await readFile(new URL(`../../public${icon.src}`, import.meta.url));
    const size = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
    assert.equal(size, icon.sizes);
  }
});
