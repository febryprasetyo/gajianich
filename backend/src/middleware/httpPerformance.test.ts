import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { gunzipSync } from 'node:zlib';
import { httpPerformanceMiddleware } from './httpPerformance.js';

async function startTestServer() {
  const app = express();
  app.set('etag', 'weak');
  app.use(httpPerformanceMiddleware());

  app.get('/api/v1/master/locations', (_req, res) => {
    res.status(200).json({ items: Array.from({ length: 80 }, (_, i) => ({ id: i + 1, name: `Location-${i + 1}-Long-Description` })) });
  });

  app.get('/api/v1/small', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as { port: number };
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test('compresses large JSON responses when client accepts gzip, sets Cache-Control & ETag, and returns 304 on If-None-Match', async () => {
  const srv = await startTestServer();
  try {
    const res1 = await fetch(`${srv.baseUrl}/api/v1/master/locations`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    assert.equal(res1.status, 200);
    assert.equal(res1.headers.get('cache-control'), 'private, no-cache');
    const etag = res1.headers.get('etag');
    assert.ok(etag, 'ETag header must be present');
    assert.ok(res1.headers.get('server-timing')?.includes('total;dur='));

    const body1 = await res1.json() as { items: Array<{ id: number }> };
    assert.equal(body1.items.length, 80);

    // Conditional request with If-None-Match should return 304 Not Modified
    const res304 = await fetch(`${srv.baseUrl}/api/v1/master/locations`, {
      headers: { 'If-None-Match': etag! },
    });
    assert.equal(res304.status, 304);

    // Small payload should not be gzipped
    const resSmall = await fetch(`${srv.baseUrl}/api/v1/small`, {
      headers: { 'Accept-Encoding': 'identity' },
    });
    assert.equal(resSmall.status, 200);
    assert.equal(resSmall.headers.get('content-encoding'), null);
  } finally {
    await srv.close();
  }
});
