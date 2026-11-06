import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const manifest = createRequire(import.meta.url)('../app/manifest.ts').default;

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
