import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv } from './config/env';
import { createApp } from './app';

test('loadEnv rejects missing required settings', () => {
  assert.throws(() => loadEnv({}), /DATABASE_URL/);
});

test('loadEnv rejects invalid port or invalid URL', () => {
  assert.throws(() => loadEnv({
    DATABASE_URL: 'invalid-url',
    JWT_SECRET: 'secret',
    JWT_REFRESH_SECRET: 'refresh',
    PORT: 'not-a-number'
  }), /PORT|DATABASE_URL/);
});

test('loadEnv requires a dedicated agent API key', () => {
  assert.throws(() => loadEnv({
    DATABASE_URL: 'postgresql://postgres:password@localhost:5432/gajianich_test',
    JWT_SECRET: 'jwt-secret-key-12345',
    JWT_REFRESH_SECRET: 'jwt-refresh-key-12345',
    NODE_ENV: 'test',
  }), /AGENT_API_KEY/);
});

test('loadEnv parses valid configuration correctly', () => {
  const env = loadEnv({
    DATABASE_URL: 'postgresql://postgres:password@localhost:5432/gajianich_test',
    JWT_SECRET: 'jwt-secret-key-12345',
    JWT_REFRESH_SECRET: 'jwt-refresh-key-12345',
    PORT: '5001',
    NODE_ENV: 'test',
    AGENT_API_KEY: 'agent-secret-key-12345'
  });

  assert.equal(env.port, 5001);
  assert.equal(env.nodeEnv, 'test');
  assert.equal(env.databaseUrl, 'postgresql://postgres:password@localhost:5432/gajianich_test');
  assert.equal(env.jwtSecret, 'jwt-secret-key-12345');
  assert.equal(env.jwtRefreshSecret, 'jwt-refresh-key-12345');
  assert.equal(env.agentApiKey, 'agent-secret-key-12345');
});

test('GET /health/live returns 200 OK', async () => {
  const app = createApp({ databaseCheck: async () => {} });
  const server = app.listen(0);
  const address = server.address() as { port: number };

  try {
    const res = await fetch(`http://127.0.0.1:${address.port}/health/live`);
    assert.equal(res.status, 200);
    const body = await res.json() as { status: string };
    assert.equal(body.status.toLowerCase(), 'ok');
  } finally {
    server.close();
  }
});

test('GET /health/ready returns 200 when database connectivity succeeds', async () => {
  const app = createApp({ databaseCheck: async () => {} });
  const server = app.listen(0);
  const address = server.address() as { port: number };

  try {
    const res = await fetch(`http://127.0.0.1:${address.port}/health/ready`);
    assert.equal(res.status, 200);
    const body = await res.json() as { status: string };
    assert.equal(body.status.toLowerCase(), 'ready');
  } finally {
    server.close();
  }
});

test('GET /health/ready returns 503 without leaking error message when database check fails', async () => {
  const app = createApp({
    databaseCheck: async () => {
      throw new Error('Database password failed: secret123');
    }
  });
  const server = app.listen(0);
  const address = server.address() as { port: number };

  try {
    const res = await fetch(`http://127.0.0.1:${address.port}/health/ready`);
    assert.equal(res.status, 503);
    const body = await res.json() as { status: string; error?: string };
    assert.equal(body.status, 'NOT_READY');
    assert.equal(body.error, undefined);
  } finally {
    server.close();
  }
});

test('POST /api/v1/auth/login throttles excessive requests with 429', async () => {
  const app = createApp({ databaseCheck: async () => {} });
  const server = app.listen(0);
  const address = server.address() as { port: number };

  try {
    let lastStatus = 200;
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`http://127.0.0.1:${address.port}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.99.88.77',
        },
        body: JSON.stringify({ username: 'invalid_user', password: 'wrong_password' }),
      });
      lastStatus = res.status;
    }
    assert.equal(lastStatus, 429, '6th request must be throttled with HTTP 429');
  } finally {
    server.close();
  }
});

test('app accepts large JSON payload (> 100kb) up to configured 50mb limit without 413', async () => {
  const app = createApp({ databaseCheck: async () => {} });
  // Add a test route to receive large body
  app.post('/test-large-payload', (req, res) => {
    res.status(200).json({ receivedBytes: JSON.stringify(req.body).length, count: (req.body.items || []).length });
  });

  const server = app.listen(0);
  const address = server.address() as { port: number };

  try {
    // Generate an array of 6000 mock attendance-like items (~1.8 MB payload)
    const largePayload = {
      items: Array.from({ length: 6000 }, (_, idx) => ({
        id: idx + 1,
        employeeId: 1000 + (idx % 500),
        workDate: '2026-10-12',
        scanIn: '08:00',
        scanOut: '17:00',
        attendanceStatus: 'PRESENT',
        note: 'Mock record for stress testing body parser limit',
      })),
    };

    const serialized = JSON.stringify(largePayload);
    assert.ok(serialized.length > 1024 * 1024, `Payload size should be > 1MB (actual: ${serialized.length} bytes)`);

    const res = await fetch(`http://127.0.0.1:${address.port}/test-large-payload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: serialized,
    });

    assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}`);
    const data = await res.json() as { count: number };
    assert.equal(data.count, 6000);
  } finally {
    server.close();
  }
});

