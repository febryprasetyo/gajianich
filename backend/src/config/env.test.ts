import { test } from 'node:test';
import assert from 'node:assert';
import { loadEnv } from './env';

test('loadEnv: loads valid development configuration successfully', () => {
  const env = loadEnv({
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/gajianich_dev_db',
    JWT_SECRET: 'dev-jwt-secret-do-not-use-in-production-1234',
    JWT_REFRESH_SECRET: 'dev-refresh-secret-do-not-use-in-production-1234',
    AGENT_API_KEY: 'gajianich_agent_secret_token_2026',
    NODE_ENV: 'development',
    PORT: '5000',
  });

  assert.strictEqual(env.port, 5000);
  assert.strictEqual(env.nodeEnv, 'development');
  assert.strictEqual(env.jwtSecret, 'dev-jwt-secret-do-not-use-in-production-1234');
});

test('loadEnv: in production rejects secrets shorter than 32 characters', () => {
  assert.throws(
    () => {
      loadEnv({
        DATABASE_URL: 'postgresql://gajianich_app:SuperSecureLongPassword2026!@localhost:5432/gajianich_prod_db',
        JWT_SECRET: 'short_secret_123',
        JWT_REFRESH_SECRET: 'a_very_long_random_refresh_secret_that_is_at_least_32_chars_long',
        AGENT_API_KEY: 'a_very_long_random_agent_secret_that_is_at_least_32_chars_long_1',
        NODE_ENV: 'production',
      });
    },
    /JWT_SECRET must be at least 32 characters long in production/
  );
});

test('loadEnv: in production rejects placeholder or dev words in secrets', () => {
  assert.throws(
    () => {
      loadEnv({
        DATABASE_URL: 'postgresql://gajianich_app:SuperSecureLongPassword2026!@localhost:5432/gajianich_prod_db',
        JWT_SECRET: 'replace-with-strong-prod-jwt-secret-min-32-chars-now',
        JWT_REFRESH_SECRET: 'a_very_long_random_refresh_secret_that_is_at_least_32_chars_long',
        AGENT_API_KEY: 'a_very_long_random_agent_secret_that_is_at_least_32_chars_long_1',
        NODE_ENV: 'production',
      });
    },
    /placeholder/
  );
});

test('loadEnv: in production rejects identical JWT and Refresh secrets', () => {
  const sharedSecret = 'f9c2d7658c14a2b978430e32fba5e1d48c9034e72a15f02bc91e7d4328b9c10a';
  assert.throws(
    () => {
      loadEnv({
        DATABASE_URL: 'postgresql://gajianich_app:SuperSecureLongPassword2026!@localhost:5432/gajianich_prod_db',
        JWT_SECRET: sharedSecret,
        JWT_REFRESH_SECRET: sharedSecret,
        AGENT_API_KEY: 'e1d48c9034e72a15f02bc91e7d4328b9c10af9c2d7658c14a2b978430e32fba5',
        NODE_ENV: 'production',
      });
    },
    /JWT_SECRET and JWT_REFRESH_SECRET must be distinct/
  );
});

test('loadEnv: in production rejects weak default postgres password in DATABASE_URL', () => {
  assert.throws(
    () => {
      loadEnv({
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/gajianich_prod_db',
        JWT_SECRET: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
        JWT_REFRESH_SECRET: 'aaaabbbbccccddddeeeeffff1111222233334444555566667777888899990000',
        AGENT_API_KEY: '99990000aaaabbbbccccddddeeeeffff11112222333344445555666677778888',
        NODE_ENV: 'production',
      });
    },
    /DATABASE_URL password must not use weak or default credentials/
  );
});

test('loadEnv: in production accepts robust distinct secrets and parses CORS origins', () => {
  const env = loadEnv({
    DATABASE_URL: 'postgresql://gajianich_app:StrongP@ssw0rdMin16Chars!@localhost:5432/gajianich_prod_db',
    JWT_SECRET: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
    JWT_REFRESH_SECRET: 'aaaabbbbccccddddeeeeffff1111222233334444555566667777888899990000',
    AGENT_API_KEY: '99990000aaaabbbbccccddddeeeeffff11112222333344445555666677778888',
    CORS_ALLOWED_ORIGINS: 'https://gajianich.company.com, https://app.company.com',
    NODE_ENV: 'production',
  });

  assert.strictEqual(env.nodeEnv, 'production');
  assert.deepStrictEqual(env.corsAllowedOrigins, ['https://gajianich.company.com', 'https://app.company.com']);
});

test('loadEnv: production rejects the untouched production template secrets', () => {
  assert.throws(() => loadEnv({
    DATABASE_URL: 'postgresql://gajianich_app:a83fca982736bd984f@localhost:5432/gajianich_prod_db',
    JWT_SECRET: 'generate-random-secret-min-32-chars-via-openssl-rand-hex-32',
    JWT_REFRESH_SECRET: 'generate-different-random-secret-min-32-chars-via-openssl-rand-hex-32',
    AGENT_API_KEY: 'generate-agent-api-key-min-32-chars-via-openssl-rand-hex-32',
    NODE_ENV: 'production',
  }), /placeholder/);
});
