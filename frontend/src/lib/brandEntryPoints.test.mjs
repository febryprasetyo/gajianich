import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('login presents the GAJIANICH brand instead of legacy branding', async () => {
  const source = await readFile(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /next\/image/);
  assert.match(source, /\/branding\/gajianich-cat\.png/);
  assert.match(source, /BRAND_NAME/);
  assert.match(source, /BRAND_TAGLINE/);
  assert.doesNotMatch(source, /Enterprise Asset & Service Management Portal|ShieldCheck|GajianichMascot/);
});
